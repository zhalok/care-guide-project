import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { PageQueryDto } from '../common/page-query.dto';
import { Rbac } from '../rbac/rbac.decorator';
import { NotesPageDto } from './dto/note-response.dto';
import { NotesService } from './notes.service';

@ApiTags('notes')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired token.' })
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @Rbac('get-own-notes')
  @ApiOperation({
    summary: "List the current user's notes",
    description:
      'Cursor-paginated, newest first. Requires the `get-own-notes` action.',
  })
  @ApiOkResponse({ type: NotesPageDto })
  @ApiBadRequestResponse({ description: 'Invalid `limit` or `cursor`.' })
  @ApiForbiddenResponse({ description: 'Role lacks `get-own-notes`.' })
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
  @ApiOperation({
    summary: "List every user's notes",
    description:
      'Cursor-paginated, newest first, not filtered by owner. Requires the `get-all-notes` action (admin).',
  })
  @ApiOkResponse({ type: NotesPageDto })
  @ApiBadRequestResponse({ description: 'Invalid `limit` or `cursor`.' })
  @ApiForbiddenResponse({ description: 'Role lacks `get-all-notes`.' })
  findAll(@Query() query: PageQueryDto) {
    const { cursor, limit } = query;
    return this.notesService.findAll({ cursor, limit });
  }
}
