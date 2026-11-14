import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { Note } from './entities/note.entity';

/** In-memory store. Swap the internals for a real DB later without touching the service. */
@Injectable()
export class NotesRepository {
  private readonly notes = new Map<string, Note>();

  findAll(): Note[] {
    return [...this.notes.values()];
  }

  findById(id: string): Note | undefined {
    return this.notes.get(id);
  }

  create(dto: CreateNoteDto): Note {
    const now = new Date();
    const note: Note = {
      id: randomUUID(),
      title: dto.title,
      content: dto.content,
      createdAt: now,
      updatedAt: now,
    };
    this.notes.set(note.id, note);
    return note;
  }

  update(id: string, dto: UpdateNoteDto): Note | undefined {
    const existing = this.notes.get(id);
    if (!existing) return undefined;
    const updated: Note = { ...existing, ...dto, updatedAt: new Date() };
    this.notes.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.notes.delete(id);
  }
}
