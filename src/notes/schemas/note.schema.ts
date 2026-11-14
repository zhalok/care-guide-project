import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type NoteDocument = HydratedDocument<Note>;

@Schema({ collection: 'notes', timestamps: true })
export class Note {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  content: string;

  /** Owner of the note; used for permission checks. */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: Types.ObjectId;

  // Added by `timestamps: true`
  createdAt: Date;
  updatedAt: Date;
}

export const NoteSchema = SchemaFactory.createForClass(Note);

// Serves "a user's notes, newest first, paged by _id cursor" straight from the
// index (equality on createdBy, then _id in descending order), with no
// in-memory sort. It also covers plain createdBy lookups, so a separate
// single-field index on createdBy would be redundant.
NoteSchema.index({ createdBy: 1, _id: -1 });
