import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

/** A user as returned by `.lean()` queries (plain object, includes `_id`). */
export type UserRecord = Omit<User, 'password'> & { _id: Types.ObjectId };

/** A user including the stored password hash; only used for authentication. */
export type UserCredentials = UserRecord & { password: string };

export interface UsersPage {
  items: UserRecord[];
  /** Pass as `cursor` to fetch the next page; null when there are no more. */
  nextCursor: string | null;
}

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  findById(id: string): Promise<UserRecord | null> {
    return this.userModel.findById(id).lean<UserRecord>().exec();
  }

  findByEmailWithPassword(email: string): Promise<UserCredentials | null> {
    return this.userModel
      .findOne({ email })
      .select('+password')
      .lean<UserCredentials>()
      .exec();
  }

  /**
   * Cursor-paginated users, newest first. `_id` is unique and monotonically
   * increasing, so it is a stable cursor. Fetches limit + 1 rows to know
   * whether another page exists.
   */
  async findPage(limit: number, cursor?: string): Promise<UsersPage> {
    const filter = cursor ? { _id: { $lt: cursor } } : {};
    const docs = await this.userModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean<UserRecord[]>()
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
