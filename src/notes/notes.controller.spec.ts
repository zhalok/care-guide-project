import { Test } from '@nestjs/testing';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

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

      const result = await controller.findAllByUser(
        { id: 'user-1' },
        { cursor: 'abc', limit: '5' },
      );

      expect(service.findAllByUser).toHaveBeenCalledWith({
        userId: 'user-1',
        cursor: 'abc',
        limit: '5',
      });
      expect(result).toBe(page);
    });

    it('passes undefined cursor and limit when not provided', async () => {
      await controller.findAllByUser({ id: 'user-1' }, {});

      expect(service.findAllByUser).toHaveBeenCalledWith({
        userId: 'user-1',
        cursor: undefined,
        limit: undefined,
      });
    });

    it('ignores unrelated query properties', async () => {
      await controller.findAllByUser({ id: 'user-1' }, {
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
});
