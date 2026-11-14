import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../users/schemas/user.schema';
import { Action } from './permissions';
import { RBAC_ACTION_KEY } from './rbac.constants';
import { RbacGuard } from './rbac.guard';

describe('RbacGuard', () => {
  const handler = () => undefined;
  const makeContext = (user?: { role: UserRole }) =>
    ({
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const makeGuard = (action?: Action) => {
    const reflector = new Reflector();
    const get = jest.spyOn(reflector, 'get').mockReturnValue(action);
    return { guard: new RbacGuard(reflector), get };
  };

  it("reads the action from the handler's metadata", () => {
    const { guard, get } = makeGuard('get-own-notes');

    guard.canActivate(makeContext({ role: UserRole.User }));

    expect(get).toHaveBeenCalledWith(RBAC_ACTION_KEY, handler);
  });

  it('allows a role that has the action', () => {
    const { guard } = makeGuard('get-all-notes');

    expect(guard.canActivate(makeContext({ role: UserRole.Admin }))).toBe(true);
  });

  it('forbids a role that lacks the action', () => {
    const { guard } = makeGuard('get-all-notes');

    expect(() =>
      guard.canActivate(makeContext({ role: UserRole.User })),
    ).toThrow(ForbiddenException);
  });

  it('forbids an unknown role', () => {
    const { guard } = makeGuard('get-own-notes');

    expect(() =>
      guard.canActivate(makeContext({ role: 'ghost' as UserRole })),
    ).toThrow(ForbiddenException);
  });

  it('responds 401 when there is no user on the request', () => {
    const { guard } = makeGuard('get-own-notes');

    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when the route has no action metadata', () => {
    const { guard } = makeGuard(undefined);

    expect(() =>
      guard.canActivate(makeContext({ role: UserRole.Admin })),
    ).toThrow(ForbiddenException);
  });
});
