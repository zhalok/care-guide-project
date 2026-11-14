import { Injectable } from '@nestjs/common';
import { parsePageParams } from '../common/pagination';
import { NotesRepository } from './notes.repository';
import { Traced } from '../tracing/traced.decorator';

@Injectable()
@Traced('service')
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
    const page = parsePageParams({ cursor, limit });
    return this.notesRepository.findPageByUser(userId, page.limit, page.cursor);
  }

  async findAll({ cursor, limit }: { cursor?: string; limit?: string }) {
    const page = parsePageParams({ cursor, limit });
    return await this.notesRepository.findPage(page.limit, page.cursor);
  }
}
