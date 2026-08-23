import type { Note } from "../models/note.js";
import type { NotesRepository } from "../repositories/notes.repository.js";
import { logNoteAction } from "../logger.js";

/** Thrown when a request's data fails validation (e.g. empty title/content). */
export class ValidationError extends Error {}

/** Thrown when a note id doesn't match any existing note. */
export class NotFoundError extends Error {}

export interface NoteChanges {
  title?: string;
  content?: string;
}

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Business logic for notes (constitution Principle I: service layer).
 *
 * Owns validation and logging (constitution Principle III); delegates all
 * storage to the repository. Never touches HTTP request/response objects.
 */
export class NotesService {
  constructor(private readonly repository: NotesRepository) {}

  /** Create a note. Throws ValidationError if title/content is missing or empty (FR-002). */
  createNote(title: string, content: string): Note {
    if (!isNonEmpty(title) || !isNonEmpty(content)) {
      throw new ValidationError("title and content are required and must not be empty");
    }

    const now = new Date().toISOString();
    const note = this.repository.create(title, content, now);
    logNoteAction("create", note.id, now);
    return note;
  }

  /** List every stored note (FR-003). Read-only — not logged. */
  listNotes(): Note[] {
    return this.repository.findAll();
  }

  /** Get a single note by id (FR-004). Throws NotFoundError if it doesn't exist (FR-005). */
  getNoteById(id: string): Note {
    const note = this.repository.findById(id);
    if (!note) {
      throw new NotFoundError(`no note found with id "${id}"`);
    }
    return note;
  }

  /**
   * Update a note's title and/or content (FR-006, FR-007).
   *
   * Throws ValidationError if neither field is supplied (FR-010), or if a
   * supplied field is empty (FR-002). A same-value update is accepted and
   * still refreshes `updatedAt` (idempotent, per data-model.md). Throws
   * NotFoundError for an unknown id (FR-005).
   */
  updateNote(id: string, changes: NoteChanges): Note {
    if (changes.title === undefined && changes.content === undefined) {
      throw new ValidationError("at least one of title or content must be supplied");
    }
    if (changes.title !== undefined && !isNonEmpty(changes.title)) {
      throw new ValidationError("title must not be empty");
    }
    if (changes.content !== undefined && !isNonEmpty(changes.content)) {
      throw new ValidationError("content must not be empty");
    }

    if (!this.repository.findById(id)) {
      throw new NotFoundError(`no note found with id "${id}"`);
    }

    const now = new Date().toISOString();
    const updated = this.repository.update(id, changes, now);
    // Existence was just confirmed above, so this is always defined.
    logNoteAction("update", id, now);
    return updated as Note;
  }

  /**
   * Delete a note (FR-008). Throws NotFoundError for an unknown id (FR-005).
   */
  deleteNote(id: string): void {
    if (!this.repository.findById(id)) {
      throw new NotFoundError(`no note found with id "${id}"`);
    }

    this.repository.delete(id);
    logNoteAction("delete", id, new Date().toISOString());
  }
}
