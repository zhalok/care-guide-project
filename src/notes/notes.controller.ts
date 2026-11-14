import { Controller, Get, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { PageQueryDto } from '../common/page-query.dto';
import { Rbac } from '../rbac/rbac.decorator';
import { NotesService } from './notes.service';

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @Rbac('get-own-notes')
  findAllByUser(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryDto,
  ) {
    const { cursor, limit } = query;
    return this.notesService.findAllByUser({
      userId: user.id,
      cursor,
      limit,
    });
  }

  @Get('all')
  @Rbac('get-all-notes')
  findAll(@Query() query: PageQueryDto) {
    const { cursor, limit } = query;
    return this.notesService.findAll({ cursor, limit });
  }
}
