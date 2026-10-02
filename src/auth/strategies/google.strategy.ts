import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import type { Profile as GoogleOAuthProfile } from 'passport-google-oauth20';
import type { User } from '../../generated/prisma/client.js';
import { AuthService } from '../auth.service.js';

function getRequiredGoogleConfig(
  configService: ConfigService,
  key: string,
): string {
  const value = configService.get<string>(key)?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: getRequiredGoogleConfig(configService, 'GOOGLE_CLIENT_ID'),
      clientSecret: getRequiredGoogleConfig(
        configService,
        'GOOGLE_CLIENT_SECRET',
      ),
      callbackURL: getRequiredGoogleConfig(
        configService,
        'GOOGLE_CALLBACK_URL',
      ),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleOAuthProfile,
  ): Promise<User> {
    const email = profile.emails?.find((entry) => entry.verified)?.value;

    if (!email) {
      throw new UnauthorizedException('Google did not provide a verified email');
    }

    return this.authService.validateGoogleUser({
      googleId: profile.id,
      email,
      firstName: profile.name?.givenName ?? null,
      lastName: profile.name?.familyName ?? null,
      picture: profile.photos?.[0]?.value ?? null,
    });
  }
}