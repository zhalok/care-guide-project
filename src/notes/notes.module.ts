import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotesController } from './notes.controller';
import { NotesRepository } from './notes.repository';
import { NotesService } from './notes.service';
import { Note as NoteSchemaClass, NoteSchema } from './schemas/note.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NoteSchemaClass.name, schema: NoteSchema },
    ]),
  ],
  controllers: [NotesController],
  providers: [NotesService, NotesRepository],
})
export class NotesModule {}
