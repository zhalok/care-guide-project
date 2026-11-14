import { UserRole } from '../users/schemas/user.schema';
import { isActionAllowed, ROLE_PERMISSIONS } from './permissions';

describe('permissions', () => {
  it.each([
    [UserRole.User, 'get-own-notes', true],
    [UserRole.User, 'get-all-notes', false],
    [UserRole.Admin, 'get-own-notes', true],
    [UserRole.Admin, 'get-all-notes', true],
    [UserRole.User, 'get-me', true],
    [UserRole.User, 'get-all-users', false],
    [UserRole.Admin, 'get-me', true],
    [UserRole.Admin, 'get-all-users', true],
  ] as const)('role %s / action %s -> %s', (role, action, expected) => {
    expect(isActionAllowed(role, action)).toBe(expected);
  });

  it('denies a role that is not in the map', () => {
    expect(isActionAllowed('ghost' as UserRole, 'get-own-notes')).toBe(false);
  });

  it('defines permissions for every UserRole', () => {
    for (const role of Object.values(UserRole)) {
      expect(ROLE_PERMISSIONS.has(role)).toBe(true);
    }
  });
});
