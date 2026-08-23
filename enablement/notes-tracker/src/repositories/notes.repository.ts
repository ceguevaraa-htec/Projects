import { randomUUID } from "node:crypto";
import type { Note } from "../models/note.js";

/**
 * In-memory data access for notes (constitution Principle I: repository layer).
 *
 * No validation, no logging, no business logic — just CRUD over a `Map`.
 * Data does not survive a process restart (constitution Principle IV).
 */
export class NotesRepository {
  private readonly notes = new Map<string, Note>();

  /**
   * Stores a new note with a generated id. `updatedAt` is supplied by the
   * caller (the service layer computes "now" per data-model.md) rather than
   * generated here, so the repository stays a pure data store.
   */
  create(title: string, content: string, updatedAt: string): Note {
    const note: Note = { id: randomUUID(), title, content, updatedAt };
    this.notes.set(note.id, note);
    return note;
  }

  findAll(): Note[] {
    return Array.from(this.notes.values());
  }

  findById(id: string): Note | undefined {
    return this.notes.get(id);
  }

  /**
   * Applies a partial change to an existing note and stamps `updatedAt`.
   * Returns `undefined` if no note exists with the given id.
   */
  update(
    id: string,
    changes: { title?: string; content?: string },
    updatedAt: string,
  ): Note | undefined {
    const existing = this.notes.get(id);
    if (!existing) {
      return undefined;
    }
    // Only overwrite fields actually present in `changes` — an explicit
    // `undefined` value must not blank out an existing field.
    const updated: Note = {
      ...existing,
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.content !== undefined ? { content: changes.content } : {}),
      updatedAt,
    };
    this.notes.set(id, updated);
    return updated;
  }

  /** Returns true if a note existed and was removed. */
  delete(id: string): boolean {
    return this.notes.delete(id);
  }
}
