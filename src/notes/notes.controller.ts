import { Controller, Get, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ListNotesQueryDto } from './dto/list-notes-query.dto';
import { NotesService } from './notes.service';

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  findAllByUser(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotesQueryDto,
  ) {
    const { cursor, limit } = query;
    return this.notesService.findAllByUser({
      userId: user.id,
      cursor,
      limit,
    });
  }

  @Get('all')
  findAll(@Query() query: ListNotesQueryDto) {
    const { cursor, limit } = query;
    return this.notesService.findAll({ cursor, limit });
  }
}
