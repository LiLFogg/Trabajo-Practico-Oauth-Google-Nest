import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { GoogleProfile } from '../src/users/interfaces/google-profile.interface.js';
import { UsersService } from '../src/users/users.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.GOOGLE_CLIENT_ID ||= 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET ||= 'test-client-secret';
    process.env.GOOGLE_CALLBACK_URL ||=
      'http://localhost:3000/auth/google/redirect';
    process.env.JWT_SECRET ||= 'e2e-only-secret-not-for-real-use-2026';
    process.env.JWT_EXPIRES_IN ||= '1h';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('redirects the Google login route to the OAuth provider', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/google')
      .expect(302);

    expect(response.headers.location).toContain('accounts.google.com');
    expect(response.headers.location).toContain(
      encodeURIComponent('http://localhost:3000/auth/google/redirect'),
    );
  });

  it('rejects a profile request without a token', async () => {
    await request(app.getHttpServer()).get('/users/profile').expect(401);
  });

  it('rejects an invalid token', async () => {
    await request(app.getHttpServer())
      .get('/users/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('allows access with a valid application JWT', async () => {
    const token = await app.get(AuthService).generateJwt({
      id: 'e2e-profile-user',
      email: 'profile@example.com',
    });

    await request(app.getHttpServer())
      .get('/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ id: 'e2e-profile-user', email: 'profile@example.com' });
  });

  it('rejects an expired token', async () => {
    const token = await app
      .get(JwtService)
      .signAsync(
        { sub: 'e2e-profile-user', email: 'profile@example.com' },
        { expiresIn: -1 },
      );

    await request(app.getHttpServer())
      .get('/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('persists and reuses a Google user', async () => {
    const usersService = app.get(UsersService);
    const prismaService = app.get(PrismaService);
    const profile: GoogleProfile = {
      googleId: `e2e-google-${crypto.randomUUID()}`,
      email: `e2e-${crypto.randomUUID()}@example.com`,
      firstName: 'Integration',
      lastName: 'Test',
      picture: null,
    };
    let userId: string | undefined;

    try {
      const createdUser = await usersService.findOrCreateFromGoogle(profile);
      userId = createdUser.id;
      const reusedUser = await usersService.findOrCreateFromGoogle(profile);

      expect(reusedUser.id).toBe(createdUser.id);
      await expect(
        prismaService.user.findUnique({ where: { googleId: profile.googleId } }),
      ).resolves.toMatchObject({
        id: createdUser.id,
        email: profile.email,
      });
    } finally {
      if (userId) {
        await prismaService.user.delete({ where: { id: userId } });
      }
    }
  });

  it('links an existing local account by normalized email', async () => {
    const usersService = app.get(UsersService);
    const prismaService = app.get(PrismaService);
    const profile: GoogleProfile = {
      googleId: `e2e-google-${crypto.randomUUID()}`,
      email: ` E2E-${crypto.randomUUID()}@Example.com `,
      firstName: 'Integration',
      lastName: 'Link',
      picture: null,
    };
    const existingUser = await prismaService.user.create({
      data: { email: profile.email.trim().toLowerCase() },
    });

    try {
      const linkedUser = await usersService.findOrCreateFromGoogle(profile);
      const persistedUser = await prismaService.user.findUnique({
        where: { id: existingUser.id },
      });

      expect(linkedUser.id).toBe(existingUser.id);
      expect(persistedUser).toMatchObject({
        googleId: profile.googleId,
        firstName: profile.firstName,
        lastName: profile.lastName,
      });
    } finally {
      await prismaService.user.delete({ where: { id: existingUser.id } });
    }
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
