import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../generated/prisma/client.js';
import type { GoogleProfile } from '../users/interfaces/google-profile.interface.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  validateGoogleUser(profile: GoogleProfile): Promise<User> {
    return this.usersService.findOrCreateFromGoogle(profile);
  }

  generateJwt(user: Pick<User, 'id' | 'email'>): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id, email: user.email });
  }
}