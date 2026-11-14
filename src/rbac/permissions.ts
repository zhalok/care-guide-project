import { UserRole } from '../users/schemas/user.schema';

/** Every action that can be guarded with `@Rbac(...)`. */
export type Action = 'get-own-notes' | 'get-all-notes';

/** Which actions each role may perform. A role missing from the map can do nothing. */
export const ROLE_PERMISSIONS = new Map<UserRole, readonly Action[]>([
  [UserRole.User, ['get-own-notes']],
  [UserRole.Admin, ['get-own-notes', 'get-all-notes']],
]);

export function isActionAllowed(role: UserRole, action: Action): boolean {
  return ROLE_PERMISSIONS.get(role)?.includes(action) ?? false;
}
