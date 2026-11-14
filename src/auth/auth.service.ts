import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';
import type { JwtPayload } from './authenticated-user';
import { Traced } from '../tracing/traced.decorator';

// Compared against when the email is unknown so response time doesn't reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
@Traced('service')
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login({
    email,
    password,
  }: {
    email: unknown;
    password: unknown;
  }): Promise<{ accessToken: string }> {
    if (typeof email !== 'string' || email.trim() === '') {
      throw new BadRequestException('email must be a non-empty string');
    }
    if (typeof password !== 'string' || password === '') {
      throw new BadRequestException('password must be a non-empty string');
    }

    const user = await this.usersRepository.findByEmailWithPassword(
      email.trim().toLowerCase(),
    );
    const passwordMatches = await bcrypt.compare(
      password,
      user?.password ?? DUMMY_HASH,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: String(user._id),
      email: user.email,
      role: user.role,
    };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }
}
