import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum UserRole {
  User = 'user',
  Admin = 'admin',
}

export type UserDocument = HydratedDocument<User>;

// The class name is the model name; Note.createdBy refs 'User'.
@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.User })
  role: UserRole;

  // Added by `timestamps: true`
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
