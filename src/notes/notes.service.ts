import { BadRequestException, Injectable } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { NotesRepository } from './notes.repository';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class NotesService {
  constructor(private readonly notesRepository: NotesRepository) {}

  async findAllByUser({
    userId,
    cursor,
    limit,
  }: {
    userId: string;
    cursor?: string;
    limit?: string;
  }) {
    const page = this.parsePageParams({ cursor, limit });
    return this.notesRepository.findPageByUser(userId, page.limit, page.cursor);
  }

  async findAll({ cursor, limit }: { cursor?: string; limit?: string }) {
    const page = this.parsePageParams({ cursor, limit });
    return await this.notesRepository.findPage(page.limit, page.cursor);
  }

  private parsePageParams({
    cursor,
    limit: rawLimit,
  }: {
    cursor?: string;
    limit?: string;
  }) {
    const limit = rawLimit === undefined ? DEFAULT_LIMIT : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new BadRequestException(
        `limit must be an integer between 1 and ${MAX_LIMIT}`,
      );
    }
    if (cursor !== undefined && !isValidObjectId(cursor)) {
      throw new BadRequestException('Invalid cursor');
    }
    return { limit, cursor };
  }
}
