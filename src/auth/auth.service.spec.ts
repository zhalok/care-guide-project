import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { UserRole } from '../users/schemas/user.schema';
import { UserCredentials, UsersRepository } from '../users/users.repository';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersRepository = { findByEmailWithPassword: jest.fn() };
  const jwtService = { signAsync: jest.fn() };
  let user: UserCredentials;

  beforeEach(async () => {
    jest.resetAllMocks();
    user = {
      _id: new Types.ObjectId(),
      name: 'Ann',
      email: 'ann@example.com',
      role: UserRole.User,
      password: await bcrypt.hash('correct-password', 4),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jwtService.signAsync.mockResolvedValue('signed.jwt.token');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: usersRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('issues a JWT whose subject is the user id when credentials match', async () => {
    usersRepository.findByEmailWithPassword.mockResolvedValue(user);

    const result = await service.login({
      email: 'ann@example.com',
      password: 'correct-password',
    });

    expect(result).toEqual({ accessToken: 'signed.jwt.token' });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: String(user._id),
    });
  });

  it('normalizes the email (trim + lowercase) before lookup', async () => {
    usersRepository.findByEmailWithPassword.mockResolvedValue(user);

    await service.login({
      email: '  Ann@Example.COM ',
      password: 'correct-password',
    });

    expect(usersRepository.findByEmailWithPassword).toHaveBeenCalledWith(
      'ann@example.com',
    );
  });

  it('rejects a wrong password without issuing a token', async () => {
    usersRepository.findByEmailWithPassword.mockResolvedValue(user);

    await expect(
      service.login({ email: 'ann@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects an unknown email with the same error as a wrong password', async () => {
    usersRepository.findByEmailWithPassword.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@example.com', password: 'whatever' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 5, '', '   '])(
    'rejects an invalid email (%p)',
    async (email) => {
      await expect(service.login({ email, password: 'x' })).rejects.toThrow(
        BadRequestException,
      );
      expect(usersRepository.findByEmailWithPassword).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null, 5, ''])(
    'rejects an invalid password (%p)',
    async (password) => {
      await expect(
        service.login({ email: 'ann@example.com', password }),
      ).rejects.toThrow(BadRequestException);
      expect(usersRepository.findByEmailWithPassword).not.toHaveBeenCalled();
    },
  );
});
