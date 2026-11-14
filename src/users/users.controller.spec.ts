import type { AuthenticatedUser } from '../auth/authenticated-user';
import { UserRole } from './schemas/user.schema';
import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const authUser: AuthenticatedUser = {
  id: 'user-1',
  name: 'Ann',
  email: 'ann@example.com',
  role: UserRole.User,
};

describe('UsersController', () => {
  let controller: UsersController;
  const service = { findAll: jest.fn(), findById: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();
    controller = moduleRef.get(UsersController);
  });

  it('findAll passes only cursor and limit to the service', async () => {
    const page = { items: [], nextCursor: null };
    service.findAll.mockResolvedValue(page);

    const result = await controller.findAll({
      cursor: 'abc',
      limit: '5',
      other: 'x',
    } as never);

    expect(service.findAll).toHaveBeenCalledWith({
      cursor: 'abc',
      limit: '5',
    });
    expect(result).toBe(page);
  });

  it('findMe looks up the authenticated user by id', async () => {
    const user = { name: 'A' };
    service.findById.mockResolvedValue(user);

    const result = await controller.findMe(authUser);

    expect(service.findById).toHaveBeenCalledWith({ id: 'user-1' });
    expect(result).toBe(user);
  });
});
