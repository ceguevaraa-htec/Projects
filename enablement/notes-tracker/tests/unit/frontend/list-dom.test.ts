// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { removeNoteRow, renderNoteList } from "../../../public/js/list.js";

describe("renderNoteList", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("renders one row per note with title, preview, and formatted time", () => {
    const notes = [
      { id: "1", title: "First", content: "Hello", updatedAt: "2026-08-24T09:16:36.902Z" },
      { id: "2", title: "Second", content: "World", updatedAt: "2026-08-24T09:17:00.000Z" },
    ];

    renderNoteList(notes, container);

    const rows = container.querySelectorAll("[data-note-id]");
    expect(rows).toHaveLength(2);
    expect(container.textContent).toContain("First");
    expect(container.textContent).toContain("Hello");
    expect(container.textContent).toContain("Second");
  });

  it("renders the empty-state message for an empty array", () => {
    renderNoteList([], container);

    expect(container.querySelectorAll("[data-note-id]")).toHaveLength(0);
    expect(container.textContent?.toLowerCase()).toContain("no notes yet");
  });
});

describe("removeNoteRow", () => {
  it("removes exactly the row for the given id and leaves the others", () => {
    const container = document.createElement("div");
    renderNoteList(
      [
        { id: "1", title: "First", content: "a", updatedAt: "2026-08-24T09:16:36.902Z" },
        { id: "2", title: "Second", content: "b", updatedAt: "2026-08-24T09:17:00.000Z" },
      ],
      container,
    );

    removeNoteRow(container, "1");

    const rows = container.querySelectorAll("[data-note-id]");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-note-id")).toBe("2");
  });
});
