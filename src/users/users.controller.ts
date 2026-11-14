import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { PageQueryDto } from '../common/page-query.dto';
import { Rbac } from '../rbac/rbac.decorator';
import { UserResponseDto, UsersPageDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired token.' })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Rbac('get-all-users')
  @ApiOperation({
    summary: 'List all users',
    description:
      'Cursor-paginated, newest first. Requires the `get-all-users` action (admin).',
  })
  @ApiOkResponse({ type: UsersPageDto })
  @ApiBadRequestResponse({ description: 'Invalid `limit` or `cursor`.' })
  @ApiForbiddenResponse({ description: 'Role lacks `get-all-users`.' })
  findAll(@Query() query: PageQueryDto) {
    const { cursor, limit } = query;
    return this.usersService.findAll({ cursor, limit });
  }

  @Get('me')
  @Rbac('get-me')
  @ApiOperation({
    summary: 'Get the current user',
    description: 'Requires the `get-me` action.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Role lacks `get-me`.' })
  @ApiNotFoundResponse({ description: 'The user no longer exists.' })
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById({ id: user.id });
  }
}
