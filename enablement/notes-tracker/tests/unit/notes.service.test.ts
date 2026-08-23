import { beforeEach, describe, expect, it } from "vitest";
import { NotesRepository } from "../../src/repositories/notes.repository.js";
import { NotesService, NotFoundError, ValidationError } from "../../src/services/notes.service.js";

describe("NotesService", () => {
  let service: NotesService;

  beforeEach(() => {
    service = new NotesService(new NotesRepository());
  });

  describe("createNote (US1)", () => {
    it("stores a note and returns it with a generated id and updatedAt", () => {
      const note = service.createNote("Groceries", "Milk, eggs, bread");

      expect(note.id).toBeTruthy();
      expect(note.title).toBe("Groceries");
      expect(note.content).toBe("Milk, eggs, bread");
      expect(note.updatedAt).toBeTruthy();
    });

    it("rejects an empty title", () => {
      expect(() => service.createNote("", "content")).toThrow(ValidationError);
    });

    it("rejects an empty content", () => {
      expect(() => service.createNote("title", "")).toThrow(ValidationError);
    });

    it("rejects a whitespace-only title", () => {
      expect(() => service.createNote("   ", "content")).toThrow(ValidationError);
    });
  });

  describe("listNotes (US1)", () => {
    it("returns every created note", () => {
      service.createNote("First", "one");
      service.createNote("Second", "two");

      const notes = service.listNotes();

      expect(notes).toHaveLength(2);
      expect(notes.map((n) => n.title).sort()).toEqual(["First", "Second"]);
    });

    it("returns an empty array when no notes exist", () => {
      expect(service.listNotes()).toEqual([]);
    });
  });

  describe("getNoteById (US1)", () => {
    it("returns the matching note", () => {
      const created = service.createNote("Title", "Content");

      const found = service.getNoteById(created.id);

      expect(found).toEqual(created);
    });

    it("throws NotFoundError for an unknown id", () => {
      expect(() => service.getNoteById("does-not-exist")).toThrow(NotFoundError);
    });
  });

  describe("updateNote (US2)", () => {
    it("updates only the supplied fields and refreshes updatedAt", async () => {
      const created = service.createNote("Original title", "Original content");
      await new Promise((r) => setTimeout(r, 2));

      const updated = service.updateNote(created.id, { content: "New content" });

      expect(updated.title).toBe("Original title");
      expect(updated.content).toBe("New content");
      expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    it("treats a same-value update as valid and still refreshes updatedAt", async () => {
      const created = service.createNote("Title", "Content");
      await new Promise((r) => setTimeout(r, 2));

      const updated = service.updateNote(created.id, {
        title: "Title",
        content: "Content",
      });

      expect(updated.title).toBe("Title");
      expect(updated.content).toBe("Content");
      expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    it("rejects an empty title", () => {
      const created = service.createNote("Title", "Content");

      expect(() => service.updateNote(created.id, { title: "" })).toThrow(ValidationError);
    });

    it("rejects an empty content", () => {
      const created = service.createNote("Title", "Content");

      expect(() => service.updateNote(created.id, { content: "" })).toThrow(ValidationError);
    });

    it("rejects an update supplying neither title nor content (FR-010)", () => {
      const created = service.createNote("Title", "Content");

      expect(() => service.updateNote(created.id, {})).toThrow(ValidationError);
    });

    it("throws NotFoundError for an unknown id and changes nothing", () => {
      expect(() => service.updateNote("does-not-exist", { title: "x" })).toThrow(NotFoundError);
      expect(service.listNotes()).toEqual([]);
    });
  });

  describe("deleteNote (US3)", () => {
    it("removes an existing note so it can no longer be retrieved", () => {
      const created = service.createNote("Title", "Content");

      service.deleteNote(created.id);

      expect(() => service.getNoteById(created.id)).toThrow(NotFoundError);
      expect(service.listNotes()).toEqual([]);
    });

    it("throws NotFoundError for an unknown id and removes nothing", () => {
      service.createNote("Title", "Content");

      expect(() => service.deleteNote("does-not-exist")).toThrow(NotFoundError);
      expect(service.listNotes()).toHaveLength(1);
    });
  });
});
