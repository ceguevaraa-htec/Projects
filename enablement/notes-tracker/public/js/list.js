import { deleteNote, listNotes } from "./api.js";
import { formatTimestamp, truncateContent } from "./format.js";

/**
 * Renders one row per note into `container` (title, truncated preview,
 * formatted last-modified time, an edit link, and a delete button). Renders
 * the empty-state message instead when `notes` is empty.
 *
 * Pure DOM manipulation — no fetching, no event wiring — so it's directly
 * unit-testable (tests/unit/frontend/list-dom.test.ts).
 */
export function renderNoteList(notes, container) {
  container.innerHTML = "";

  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No notes yet. Create one to get started.";
    container.appendChild(empty);
    return;
  }

  for (const note of notes) {
    container.appendChild(renderNoteCard(note));
  }
}

function renderNoteCard(note) {
  const li = document.createElement("li");
  li.className = "note-card";
  li.dataset.noteId = note.id;

  const title = document.createElement("h2");
  title.textContent = note.title;

  const preview = document.createElement("p");
  preview.className = "preview";
  preview.textContent = truncateContent(note.content, 100);

  const updatedAt = document.createElement("p");
  updatedAt.className = "updated-at";
  updatedAt.textContent = `Last modified: ${formatTimestamp(note.updatedAt)}`;

  const actions = document.createElement("div");
  actions.className = "actions";

  const editLink = document.createElement("a");
  editLink.className = "button";
  editLink.href = `/edit.html?id=${encodeURIComponent(note.id)}`;
  editLink.textContent = "Edit";

  // Delete is rendered here but not yet wired to a click handler — that's
  // added in the bootstrap logic below (see the "Delete handling" section),
  // kept separate so this render function stays pure and unit-testable.
  // Only `data-action` is set here (not `data-note-id`) so `[data-note-id]`
  // unambiguously identifies just the row, not the button inside it — the
  // click handler reads the id from the row via `.closest("[data-note-id]")`.
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger";
  deleteButton.dataset.action = "delete";
  deleteButton.textContent = "Delete";

  actions.append(editLink, deleteButton);
  li.append(title, preview, updatedAt, actions);
  return li;
}

/** Removes exactly the row for `id` from `container`, if present. */
export function removeNoteRow(container, id) {
  const row = container.querySelector(`[data-note-id="${id}"]`);
  if (row) {
    row.remove();
  }
}

function showPageMessage(message) {
  const el = document.getElementById("page-message");
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
}

async function bootstrap() {
  const container = document.getElementById("note-list");
  if (!container) {
    // Not on the list page (or this module was imported for its exports
    // only, e.g. by a test) — nothing to bootstrap.
    return;
  }

  try {
    const notes = await listNotes();
    renderNoteList(notes, container);
  } catch (err) {
    showPageMessage(`Could not load notes: ${err.message}`);
  }

  // Delete handling: one delegated click listener on the container, since
  // rows are re-rendered wholesale on load (event delegation survives that,
  // per-button listeners wouldn't need to but this is simpler either way).
  container.addEventListener("click", async (event) => {
    const button = event.target.closest('[data-action="delete"]');
    if (!button) {
      return;
    }
    const row = button.closest("[data-note-id]");
    const id = row?.dataset.noteId;
    if (!id) {
      return;
    }

    if (!window.confirm("Delete this note? This cannot be undone.")) {
      return;
    }

    button.disabled = true;
    try {
      await deleteNote(id);
      removeNoteRow(container, id);
    } catch (err) {
      if (err.status === 404) {
        // Already gone — it's gone either way, so remove it from view too.
        showPageMessage("This note was already deleted.");
        removeNoteRow(container, id);
      } else {
        showPageMessage(`Could not delete note: ${err.message}`);
        button.disabled = false;
      }
    }
  });
}

bootstrap();
