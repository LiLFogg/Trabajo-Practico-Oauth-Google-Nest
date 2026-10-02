import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { User } from '../generated/prisma/client.js';
import { AuthService } from './auth.service.js';

interface GoogleAuthenticatedRequest extends Request {
  user: User;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  startGoogleAuth(): string {
    return 'Redirecting to Google';
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async handleGoogleRedirect(@Req() request: GoogleAuthenticatedRequest): Promise<{
    message: string;
    access_token: string;
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'picture'>;
  }> {
    return {
      message: 'Google user authenticated and persisted',
      access_token: await this.authService.generateJwt(request.user),
      user: {
        id: request.user.id,
        email: request.user.email,
        firstName: request.user.firstName,
        lastName: request.user.lastName,
        picture: request.user.picture,
      },
    };
  }
}