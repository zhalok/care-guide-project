import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { Action } from './permissions';
import { RBAC_ACTION_KEY } from './rbac.constants';
import { RbacGuard } from './rbac.guard';

/**
 * Restricts a route to roles allowed to perform `action` (see ROLE_PERMISSIONS).
 * Relies on the auth middleware having set `req.user`.
 */
export const Rbac = (action: Action) =>
  applyDecorators(SetMetadata(RBAC_ACTION_KEY, action), UseGuards(RbacGuard));
