import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Profile as GoogleOAuthProfile } from 'passport-google-oauth20';
import type { User } from '../../generated/prisma/client.js';
import type { AuthService } from '../auth.service.js';
import { GoogleStrategy } from './google.strategy.js';

describe('GoogleStrategy', () => {
  const configValues: Record<string, string> = {
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/redirect',
  };

  const authenticatedUser = {
    id: 'user-123',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    picture: 'https://example.com/ada.png',
    googleId: 'google-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies User;

  const authService = {
    validateGoogleUser: vi.fn().mockResolvedValue(authenticatedUser),
  };

  function createStrategy(
    values: Record<string, string> = configValues,
  ): GoogleStrategy {
    const configService = {
      get: (key: string) => values[key],
    } as unknown as ConfigService;

    return new GoogleStrategy(
      configService,
      authService as unknown as AuthService,
    );
  }

  it('persists a verified Google profile through AuthService', async () => {
    authService.validateGoogleUser.mockClear();
    const strategy = createStrategy();
    const profile = {
      id: 'google-123',
      emails: [{ value: 'ada@example.com', verified: true }],
      name: { givenName: 'Ada', familyName: 'Lovelace' },
      photos: [{ value: 'https://example.com/ada.png' }],
    } as GoogleOAuthProfile;

    await expect(
      strategy.validate('access-token', 'refresh-token', profile),
    ).resolves.toEqual(authenticatedUser);

    expect(authService.validateGoogleUser).toHaveBeenCalledWith({
      googleId: 'google-123',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      picture: 'https://example.com/ada.png',
    });
  });

  it('rejects profiles without a verified email', async () => {
    authService.validateGoogleUser.mockClear();
    const strategy = createStrategy();
    const profile = {
      id: 'google-123',
      emails: [{ value: 'ada@example.com', verified: false }],
    } as GoogleOAuthProfile;

    await expect(
      strategy.validate('access-token', 'refresh-token', profile),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.validateGoogleUser).not.toHaveBeenCalled();
  });

  it('fails clearly when a required Google setting is empty', () => {
    expect(() =>
      createStrategy({ ...configValues, GOOGLE_CLIENT_SECRET: '' }),
    ).toThrow('Missing required environment variable: GOOGLE_CLIENT_SECRET');
  });
});