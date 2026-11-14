import { Controller, Get, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { PageQueryDto } from '../common/page-query.dto';
import { Rbac } from '../rbac/rbac.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Rbac('get-all-users')
  findAll(@Query() query: PageQueryDto) {
    const { cursor, limit } = query;
    return this.usersService.findAll({ cursor, limit });
  }

  @Get('me')
  @Rbac('get-me')
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById({ id: user.id });
  }
}
