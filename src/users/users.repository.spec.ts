import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { User, UserRole } from './schemas/user.schema';
import { UserRecord, UsersRepository } from './users.repository';

const makeUser = (name: string): UserRecord => ({
  _id: new Types.ObjectId(),
  name,
  email: `${name}@example.com`,
  role: UserRole.User,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let exec: jest.Mock;
  let limit: jest.Mock;
  let sort: jest.Mock;
  let find: jest.Mock;
  let findById: jest.Mock;

  beforeEach(async () => {
    exec = jest.fn();
    const lean = jest.fn().mockReturnValue({ exec });
    limit = jest.fn().mockReturnValue({ lean });
    sort = jest.fn().mockReturnValue({ limit });
    find = jest.fn().mockReturnValue({ sort });
    findById = jest.fn().mockReturnValue({ lean });

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: getModelToken(User.name), useValue: { find, findById } },
      ],
    }).compile();
    repository = moduleRef.get(UsersRepository);
  });

  describe('findById', () => {
    it('looks the user up by id', async () => {
      const user = makeUser('a');
      exec.mockResolvedValue(user);

      expect(await repository.findById('u1')).toBe(user);
      expect(findById).toHaveBeenCalledWith('u1');
    });

    it('returns null when not found', async () => {
      exec.mockResolvedValue(null);

      expect(await repository.findById('u1')).toBeNull();
    });
  });

  describe('findPage', () => {
    it('queries newest first, fetching limit + 1 rows', async () => {
      exec.mockResolvedValue([]);

      await repository.findPage(10);

      expect(find).toHaveBeenCalledWith({});
      expect(sort).toHaveBeenCalledWith({ _id: -1 });
      expect(limit).toHaveBeenCalledWith(11);
    });

    it('adds the cursor as an _id upper bound', async () => {
      exec.mockResolvedValue([]);
      const cursor = new Types.ObjectId().toHexString();

      await repository.findPage(10, cursor);

      expect(find).toHaveBeenCalledWith({ _id: { $lt: cursor } });
    });

    it('returns a null nextCursor when there is no further page', async () => {
      const users = [makeUser('a'), makeUser('b')];
      exec.mockResolvedValue(users);

      expect(await repository.findPage(2)).toEqual({
        items: users,
        nextCursor: null,
      });
    });

    it('trims the extra row and returns the last item id as nextCursor', async () => {
      const users = [makeUser('a'), makeUser('b'), makeUser('c')];
      exec.mockResolvedValue(users);

      const page = await repository.findPage(2);

      expect(page.items).toEqual([users[0], users[1]]);
      expect(page.nextCursor).toBe(String(users[1]._id));
    });
  });
});
