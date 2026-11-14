import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const repository = { findPage: jest.fn(), findById: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('findAll', () => {
    it('uses the default limit of 20', async () => {
      repository.findPage.mockResolvedValue({ items: [], nextCursor: null });

      await service.findAll({});

      expect(repository.findPage).toHaveBeenCalledWith(20, undefined);
    });

    it('passes the parsed limit and cursor to the repository', async () => {
      const page = { items: [], nextCursor: null };
      repository.findPage.mockResolvedValue(page);
      const cursor = new Types.ObjectId().toHexString();

      const result = await service.findAll({ limit: '5', cursor });

      expect(repository.findPage).toHaveBeenCalledWith(5, cursor);
      expect(result).toBe(page);
    });

    it.each([{ limit: '0' }, { limit: '101' }, { cursor: 'nope' }])(
      'rejects invalid params %p',
      async (params) => {
        await expect(service.findAll(params)).rejects.toThrow(
          BadRequestException,
        );
        expect(repository.findPage).not.toHaveBeenCalled();
      },
    );
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      const user = { name: 'A' };
      repository.findById.mockResolvedValue(user);

      expect(await service.findById({ id: 'u1' })).toBe(user);
      expect(repository.findById).toHaveBeenCalledWith('u1');
    });

    it('throws NotFoundException when the user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById({ id: 'u1' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
