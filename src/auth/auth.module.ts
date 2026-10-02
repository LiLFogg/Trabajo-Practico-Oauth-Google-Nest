import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { GoogleStrategy } from './strategies/google.strategy.js';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET')?.trim();
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN')?.trim();

        if (!secret) {
          throw new Error('Missing required environment variable: JWT_SECRET');
        }

        if (!expiresIn || !/^\d+(s|m|h|d)$/.test(expiresIn)) {
          throw new Error(
            'JWT_EXPIRES_IN must be a duration such as 15m, 1h, or 1d',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as NonNullable<JwtSignOptions['expiresIn']>,
          },
        };
      },
    }),
    PassportModule.register({ session: false }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy],
})
export class AuthModule {}