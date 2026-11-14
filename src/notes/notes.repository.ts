import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Note as NoteSchemaClass, NoteDocument } from './schemas/note.schema';
import { Traced } from '../tracing/traced.decorator';

/** A note as returned by `.lean()` queries (plain object, includes `_id`). */
export type NoteRecord = NoteSchemaClass & { _id: Types.ObjectId };

export interface NotesPage {
  items: NoteRecord[];
  /** Pass as `cursor` to fetch the next page; null when there are no more. */
  nextCursor: string | null;
}

@Injectable()
@Traced('repository')
export class NotesRepository {
  constructor(
    @InjectModel(NoteSchemaClass.name)
    private readonly noteModel: Model<NoteDocument>,
  ) {}

  /** Cursor-paginated notes owned by one user, newest first. */
  findPageByUser(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<NotesPage> {
    return this.findPageWhere({ createdBy: userId }, limit, cursor);
  }

  /** Cursor-paginated notes across all users, newest first. */
  findPage(limit: number, cursor?: string): Promise<NotesPage> {
    return this.findPageWhere({}, limit, cursor);
  }

  /**
   * `_id` is unique and monotonically increasing, so it is a stable cursor even
   * as notes are added. Fetches limit + 1 rows to know whether another page exists.
   */
  private async findPageWhere(
    where: QueryFilter<NoteDocument>,
    limit: number,
    cursor?: string,
  ): Promise<NotesPage> {
    const filter = cursor ? { ...where, _id: { $lt: cursor } } : where;
    const docs = await this.noteModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean<NoteRecord[]>()
      .exec();
    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? String(last._id) : null,
    };
  }
}
