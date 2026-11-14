import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UserRole } from '../users/schemas/user.schema';
import { UsersRepository } from '../users/users.repository';
import { AuthMiddleware } from './auth.middleware';
import type { AuthenticatedRequest } from './authenticated-user';

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  const jwtService = { verifyAsync: jest.fn() };
  const usersRepository = { findById: jest.fn() };
  const next = jest.fn();
  const userId = new Types.ObjectId();

  const makeReq = (authorization?: string) =>
    ({ headers: { authorization } }) as unknown as AuthenticatedRequest;
  const run = (req: AuthenticatedRequest) =>
    middleware.use(req, {} as never, next);

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthMiddleware,
        { provide: JwtService, useValue: jwtService },
        { provide: UsersRepository, useValue: usersRepository },
      ],
    }).compile();
    middleware = moduleRef.get(AuthMiddleware);
  });

  it('attaches the user to the request and calls next for a valid token', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: String(userId) });
    usersRepository.findById.mockResolvedValue({
      _id: userId,
      name: 'Ann',
      email: 'ann@example.com',
      role: UserRole.Admin,
    });
    const req = makeReq('Bearer good.token');

    await run(req);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('good.token');
    expect(usersRepository.findById).toHaveBeenCalledWith(String(userId));
    expect(req.user).toEqual({
      id: String(userId),
      name: 'Ann',
      email: 'ann@example.com',
      role: UserRole.Admin,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('accepts a case-insensitive Bearer scheme', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: String(userId) });
    usersRepository.findById.mockResolvedValue({
      _id: userId,
      name: 'A',
      email: 'a@x.com',
      role: UserRole.User,
    });

    await run(makeReq('bearer good.token'));

    expect(next).toHaveBeenCalled();
  });

  it.each([
    ['no header', undefined],
    ['wrong scheme', 'Basic abc'],
    ['empty token', 'Bearer '],
    ['scheme only', 'Bearer'],
  ])('rejects a request with %s', async (_name, header) => {
    await expect(run(makeReq(header))).rejects.toThrow(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token that fails verification (bad signature or expired)', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(run(makeReq('Bearer bad'))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(usersRepository.findById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token whose subject is not a valid id', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'not-an-id' });

    await expect(run(makeReq('Bearer t'))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(usersRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects when the user no longer exists in the database', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: String(userId) });
    usersRepository.findById.mockResolvedValue(null);
    const req = makeReq('Bearer t');

    await expect(run(req)).rejects.toThrow(
      new UnauthorizedException('User no longer exists'),
    );
    expect(req.user).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });
});
