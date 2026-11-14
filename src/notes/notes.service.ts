import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { Note } from './entities/note.entity';
import { NotesRepository } from './notes.repository';

@Injectable()
export class NotesService {
  constructor(private readonly notesRepository: NotesRepository) {}

  findAll(): Note[] {
    return this.notesRepository.findAll();
  }

  findOne(id: string): Note {
    const note = this.notesRepository.findById(id);
    if (!note) throw new NotFoundException(`Note ${id} not found`);
    return note;
  }

  create(dto: CreateNoteDto): Note {
    return this.notesRepository.create(dto);
  }

  update(id: string, dto: UpdateNoteDto): Note {
    const note = this.notesRepository.update(id, dto);
    if (!note) throw new NotFoundException(`Note ${id} not found`);
    return note;
  }

  remove(id: string): void {
    if (!this.notesRepository.delete(id)) {
      throw new NotFoundException(`Note ${id} not found`);
    }
  }
}
