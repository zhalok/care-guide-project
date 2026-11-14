import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/authenticated-user';
import { Action, isActionAllowed } from './permissions';
import { RBAC_ACTION_KEY } from './rbac.constants';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.get<Action | undefined>(
      RBAC_ACTION_KEY,
      context.getHandler(),
    );
    // Fail closed: a guarded route with no action is a misconfiguration.
    if (!action) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) {
      throw new UnauthorizedException('Not authenticated');
    }

    if (!isActionAllowed(user.role, action)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
