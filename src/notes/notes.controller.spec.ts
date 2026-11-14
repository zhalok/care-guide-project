import type { AuthenticatedUser } from '../auth/authenticated-user';
import { UserRole } from '../users/schemas/user.schema';
import { Test } from '@nestjs/testing';
import { RBAC_ACTION_KEY } from '../rbac/rbac.constants';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

const authUser: AuthenticatedUser = {
  id: 'user-1',
  name: 'Ann',
  email: 'ann@example.com',
  role: UserRole.User,
};

describe('NotesController', () => {
  let controller: NotesController;
  const service = {
    findAllByUser: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [NotesController],
      providers: [{ provide: NotesService, useValue: service }],
    }).compile();
    controller = moduleRef.get(NotesController);
  });

  describe('findAllByUser', () => {
    it("passes the authenticated user's id and the destructured query to the service", async () => {
      const page = { items: [], nextCursor: null };
      service.findAllByUser.mockResolvedValue(page);

      const result = await controller.findAllByUser(authUser, {
        cursor: 'abc',
        limit: '5',
      });

      expect(service.findAllByUser).toHaveBeenCalledWith({
        userId: 'user-1',
        cursor: 'abc',
        limit: '5',
      });
      expect(result).toBe(page);
    });

    it('passes undefined cursor and limit when not provided', async () => {
      await controller.findAllByUser(authUser, {});

      expect(service.findAllByUser).toHaveBeenCalledWith({
        userId: 'user-1',
        cursor: undefined,
        limit: undefined,
      });
    });

    it('ignores unrelated query properties', async () => {
      await controller.findAllByUser(authUser, {
        cursor: 'abc',
        userId: 'someone-else',
      } as never);

      expect(service.findAllByUser).toHaveBeenCalledWith({
        userId: 'user-1',
        cursor: 'abc',
        limit: undefined,
      });
    });
  });

  describe('findAll', () => {
    it('passes only cursor and limit to the service', async () => {
      const page = { items: [], nextCursor: null };
      service.findAll.mockResolvedValue(page);

      const result = await controller.findAll({ cursor: 'abc', limit: '5' });

      expect(service.findAll).toHaveBeenCalledWith({
        cursor: 'abc',
        limit: '5',
      });
      expect(result).toBe(page);
    });
  });

  describe('RBAC metadata', () => {
    it.each([
      ['findAllByUser', 'get-own-notes'],
      ['findAll', 'get-all-notes'],
    ] as const)('%s requires the %s action', (method, action) => {
      const handler = Object.getOwnPropertyDescriptor(
        NotesController.prototype,
        method,
      )?.value as object;
      expect(Reflect.getMetadata(RBAC_ACTION_KEY, handler)).toBe(action);
    });
  });
});
