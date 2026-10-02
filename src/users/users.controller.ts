import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

interface AuthenticatedRequest extends Request {
	user: AuthenticatedUser;
}

@Controller('users')
export class UsersController {
	@Get('profile')
	@UseGuards(JwtAuthGuard)
	getProfile(@Req() request: AuthenticatedRequest): AuthenticatedUser {
		return request.user;
	}
}