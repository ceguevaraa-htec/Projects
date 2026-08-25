import { describe, expect, it } from "vitest";
import { validateNoteForm } from "../../../public/js/validation.js";

describe("validateNoteForm — create mode (requireBoth: true)", () => {
  it("passes when both title and content are present and non-empty", () => {
    const errors = validateNoteForm(
      { title: "Groceries", content: "Milk" },
      { requireBoth: true },
    );
    expect(errors).toEqual([]);
  });

  it("rejects a missing title", () => {
    const errors = validateNoteForm({ content: "Milk" }, { requireBoth: true });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects an empty title", () => {
    const errors = validateNoteForm({ title: "", content: "Milk" }, { requireBoth: true });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a whitespace-only title", () => {
    const errors = validateNoteForm({ title: "   ", content: "Milk" }, { requireBoth: true });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects an empty content", () => {
    const errors = validateNoteForm({ title: "Groceries", content: "" }, { requireBoth: true });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("validateNoteForm — edit mode (requireBoth: false)", () => {
  it("passes when only title is supplied and non-empty", () => {
    const errors = validateNoteForm({ title: "New title" }, { requireBoth: false });
    expect(errors).toEqual([]);
  });

  it("passes when only content is supplied and non-empty", () => {
    const errors = validateNoteForm({ content: "New content" }, { requireBoth: false });
    expect(errors).toEqual([]);
  });

  it("passes when both are supplied and non-empty", () => {
    const errors = validateNoteForm(
      { title: "New title", content: "New content" },
      { requireBoth: false },
    );
    expect(errors).toEqual([]);
  });

  it("rejects when neither title nor content is supplied", () => {
    const errors = validateNoteForm({}, { requireBoth: false });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects when the supplied title is empty/whitespace-only", () => {
    const errors = validateNoteForm({ title: "   " }, { requireBoth: false });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects when the supplied content is empty/whitespace-only", () => {
    const errors = validateNoteForm({ content: "" }, { requireBoth: false });
    expect(errors.length).toBeGreaterThan(0);
  });
});
