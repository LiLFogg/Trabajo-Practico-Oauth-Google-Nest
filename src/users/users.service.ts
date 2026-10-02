import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GoogleProfile } from './interfaces/google-profile.interface.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      this.throwForUniqueConflict(error);
      throw error;
    }
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    try {
      return await this.prisma.user.update({ where: { id }, data });
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException(`User with id ${id} was not found`);
      }

      this.throwForUniqueConflict(error);
      throw error;
    }
  }

  linkGoogleAccount(userId: string, profile: GoogleProfile): Promise<User> {
    return this.update(userId, {
      googleId: profile.googleId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      picture: profile.picture,
    });
  }

  async findOrCreateFromGoogle(profile: GoogleProfile): Promise<User> {
    const normalizedProfile = {
      ...profile,
      email: this.normalizeEmail(profile.email),
    };

    const googleUser = await this.findByGoogleId(normalizedProfile.googleId);
    if (googleUser) {
      return this.updateProfile(googleUser.id, normalizedProfile);
    }

    const emailUser = await this.findByEmail(normalizedProfile.email);
    if (emailUser) {
      return this.linkGoogleAccount(emailUser.id, normalizedProfile);
    }

    try {
      return await this.create({
        email: normalizedProfile.email,
        googleId: normalizedProfile.googleId,
        firstName: normalizedProfile.firstName,
        lastName: normalizedProfile.lastName,
        picture: normalizedProfile.picture,
      });
    } catch (error) {
      if (!this.isPrismaError(error, 'P2002')) {
        throw error;
      }

      const concurrentGoogleUser = await this.findByGoogleId(
        normalizedProfile.googleId,
      );
      if (concurrentGoogleUser) {
        return this.updateProfile(concurrentGoogleUser.id, normalizedProfile);
      }

      const concurrentEmailUser = await this.findByEmail(
        normalizedProfile.email,
      );
      if (concurrentEmailUser && !concurrentEmailUser.googleId) {
        return this.linkGoogleAccount(
          concurrentEmailUser.id,
          normalizedProfile,
        );
      }

      throw new ConflictException('Google account is already linked');
    }
  }

  private updateProfile(userId: string, profile: GoogleProfile): Promise<User> {
    return this.update(userId, {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      picture: profile.picture,
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isPrismaError(
    error: unknown,
    code: string,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }

  private throwForUniqueConflict(error: unknown): void {
    if (this.isPrismaError(error, 'P2002')) {
      throw new ConflictException('A user with this email or Google ID exists');
    }
  }
}