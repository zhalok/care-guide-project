import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { NotesRepository, NoteRecord } from './notes.repository';
import { Note } from './schemas/note.schema';

const makeNote = (title: string): NoteRecord => ({
  _id: new Types.ObjectId(),
  title,
  content: 'content',
  createdBy: new Types.ObjectId(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('NotesRepository', () => {
  let repository: NotesRepository;
  let exec: jest.Mock;
  let limit: jest.Mock;
  let sort: jest.Mock;
  let find: jest.Mock;

  beforeEach(async () => {
    exec = jest.fn();
    const lean = jest.fn().mockReturnValue({ exec });
    limit = jest.fn().mockReturnValue({ lean });
    sort = jest.fn().mockReturnValue({ limit });
    find = jest.fn().mockReturnValue({ sort });

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotesRepository,
        { provide: getModelToken(Note.name), useValue: { find } },
      ],
    }).compile();
    repository = moduleRef.get(NotesRepository);
  });

  describe('findPage', () => {
    it('queries all users, newest first, fetching limit + 1 rows', async () => {
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
      const notes = [makeNote('a'), makeNote('b')];
      exec.mockResolvedValue(notes);

      const page = await repository.findPage(2);

      expect(page).toEqual({ items: notes, nextCursor: null });
    });

    it('trims the extra row and returns the last item id as nextCursor', async () => {
      const notes = [makeNote('a'), makeNote('b'), makeNote('c')];
      exec.mockResolvedValue(notes);

      const page = await repository.findPage(2);

      expect(page.items).toEqual([notes[0], notes[1]]);
      expect(page.nextCursor).toBe(String(notes[1]._id));
    });

    it('handles an empty result', async () => {
      exec.mockResolvedValue([]);

      expect(await repository.findPage(5)).toEqual({
        items: [],
        nextCursor: null,
      });
    });
  });

  describe('findPageByUser', () => {
    it('filters by createdBy', async () => {
      exec.mockResolvedValue([]);

      await repository.findPageByUser('user-1', 10);

      expect(find).toHaveBeenCalledWith({ createdBy: 'user-1' });
    });

    it('combines the createdBy filter with the cursor', async () => {
      exec.mockResolvedValue([]);
      const cursor = new Types.ObjectId().toHexString();

      await repository.findPageByUser('user-1', 10, cursor);

      expect(find).toHaveBeenCalledWith({
        createdBy: 'user-1',
        _id: { $lt: cursor },
      });
    });

    it('paginates the same way as findPage', async () => {
      const notes = [makeNote('a'), makeNote('b'), makeNote('c')];
      exec.mockResolvedValue(notes);

      const page = await repository.findPageByUser('user-1', 2);

      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBe(String(notes[1]._id));
    });
  });
});
