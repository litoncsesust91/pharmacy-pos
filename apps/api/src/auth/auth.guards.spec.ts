import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PermissionsGuard } from './auth.guards.js';

function contextFor(user: unknown): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('allows a user with every required permission', () => {
    const reflector = {
      getAllAndOverride: () => ['branch.read', 'branch.manage'],
    };
    const guard = new PermissionsGuard(reflector as never);

    expect(
      guard.canActivate(
        contextFor({ permissions: ['branch.read', 'branch.manage'] }),
      ),
    ).toBe(true);
  });

  it('denies a user missing a required permission', () => {
    const reflector = { getAllAndOverride: () => ['branch.manage'] };
    const guard = new PermissionsGuard(reflector as never);

    expect(() => guard.canActivate(contextFor({ permissions: ['branch.read'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies protected access without an authenticated user', () => {
    const reflector = { getAllAndOverride: () => ['branch.read'] };
    const guard = new PermissionsGuard(reflector as never);

    expect(() => guard.canActivate(contextFor(undefined))).toThrow(UnauthorizedException);
  });
});
