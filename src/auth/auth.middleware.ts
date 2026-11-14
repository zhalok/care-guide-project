import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { UsersRepository } from '../users/users.repository';
import type { AuthenticatedRequest, JwtPayload } from './authenticated-user';

/**
 * Verifies the bearer JWT, confirms the user still exists, and attaches the
 * user to the request as `req.user` for `@CurrentUser()`.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async use(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!isValidObjectId(payload.sub)) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.usersRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    req.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    };
    next();
  }
}
