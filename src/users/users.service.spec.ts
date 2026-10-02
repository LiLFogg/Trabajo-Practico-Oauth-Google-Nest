import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GoogleProfile } from './interfaces/google-profile.interface.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  const profile: GoogleProfile = {
    googleId: 'google-123',
    email: 'Student@Example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    picture: 'https://example.com/ada.png',
  };

  const user = {
    id: 'user-123',
    email: 'student@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    picture: 'https://example.com/ada.png',
    googleId: 'google-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies User;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('updates and reuses the user found by Google ID', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(user);
    prisma.user.update.mockResolvedValue(user);

    await expect(service.findOrCreateFromGoogle(profile)).resolves.toEqual(
      user,
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        email: 'student@example.com',
        firstName: profile.firstName,
        lastName: profile.lastName,
        picture: profile.picture,
      },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('links a matching email to the Google account', async () => {
    const localUser = { ...user, googleId: null };
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(localUser);
    prisma.user.update.mockResolvedValue(user);

    await expect(service.findOrCreateFromGoogle(profile)).resolves.toEqual(
      user,
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: localUser.id },
      data: {
        googleId: profile.googleId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        picture: profile.picture,
      },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates a user when neither Google ID nor email exists', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValue(user);

    await expect(service.findOrCreateFromGoogle(profile)).resolves.toEqual(
      user,
    );

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'student@example.com',
        googleId: profile.googleId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        picture: profile.picture,
      },
    });
  });

  it('reports a conflict when Google ID and email belong to different users', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...user, googleId: 'another-google-id' });
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    );
    await expect(service.findOrCreateFromGoogle(profile)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});