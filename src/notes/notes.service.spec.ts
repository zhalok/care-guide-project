import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { NotesRepository } from './notes.repository';
import { NotesService } from './notes.service';

describe('NotesService', () => {
  let service: NotesService;
  const repository = {
    findPage: jest.fn(),
    findPageByUser: jest.fn(),
  };
  const page = { items: [], nextCursor: null };

  beforeEach(async () => {
    jest.resetAllMocks();
    repository.findPage.mockResolvedValue(page);
    repository.findPageByUser.mockResolvedValue(page);

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: NotesRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(NotesService);
  });

  describe.each([
    [
      'findAllByUser',
      (params: { cursor?: string; limit?: string }) =>
        service.findAllByUser({ userId: 'user-1', ...params }),
    ],
    [
      'findAll',
      (params: { cursor?: string; limit?: string }) => service.findAll(params),
    ],
  ])('%s pagination params', (_name, call) => {
    it('rejects a non-numeric limit', async () => {
      await expect(call({ limit: 'abc' })).rejects.toThrow(BadRequestException);
    });

    it.each(['0', '-1', '101', '1.5'])('rejects limit %s', async (limit) => {
      await expect(call({ limit })).rejects.toThrow(BadRequestException);
    });

    it.each(['1', '100'])('accepts limit %s', async (limit) => {
      await expect(call({ limit })).resolves.toEqual(page);
    });

    it('rejects a malformed cursor', async () => {
      await expect(call({ cursor: 'not-an-object-id' })).rejects.toThrow(
        new BadRequestException('Invalid cursor'),
      );
    });

    it('does not hit the repository when validation fails', async () => {
      await call({ limit: '0' }).catch(() => undefined);

      expect(repository.findPage).not.toHaveBeenCalled();
      expect(repository.findPageByUser).not.toHaveBeenCalled();
    });
  });

  describe('findAllByUser', () => {
    it('uses a default limit of 20 when none is given', async () => {
      await service.findAllByUser({ userId: 'user-1' });

      expect(repository.findPageByUser).toHaveBeenCalledWith(
        'user-1',
        20,
        undefined,
      );
    });

    it('passes the user id, parsed limit and cursor to the repository', async () => {
      const cursor = new Types.ObjectId().toHexString();

      const result = await service.findAllByUser({
        userId: 'user-1',
        limit: '5',
        cursor,
      });

      expect(repository.findPageByUser).toHaveBeenCalledWith(
        'user-1',
        5,
        cursor,
      );
      expect(result).toBe(page);
    });
  });

  describe('findAll', () => {
    it('uses a default limit of 20 when none is given', async () => {
      await service.findAll({});

      expect(repository.findPage).toHaveBeenCalledWith(20, undefined);
    });

    it('passes the parsed limit and cursor without any user filter', async () => {
      const cursor = new Types.ObjectId().toHexString();

      const result = await service.findAll({ limit: '5', cursor });

      expect(repository.findPage).toHaveBeenCalledWith(5, cursor);
      expect(repository.findPageByUser).not.toHaveBeenCalled();
      expect(result).toBe(page);
    });
  });
});
