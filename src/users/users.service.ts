import { Injectable, NotFoundException } from '@nestjs/common';
import { parsePageParams } from '../common/pagination';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll({ cursor, limit }: { cursor?: string; limit?: string }) {
    const page = parsePageParams({ cursor, limit });
    return this.usersRepository.findPage(page.limit, page.cursor);
  }

  async findById({ id }: { id: string }) {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
