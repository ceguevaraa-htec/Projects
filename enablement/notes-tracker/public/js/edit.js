import { getNote, updateNote } from "./api.js";
import { validateNoteForm } from "./validation.js";

const form = document.getElementById("edit-form");
const errorEl = document.getElementById("form-error");
const notFoundEl = document.getElementById("not-found-message");

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

function getNoteIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

async function loadNote(id) {
  try {
    const note = await getNote(id);
    document.getElementById("title").value = note.title;
    document.getElementById("content").value = note.content;
  } catch (err) {
    if (err.status === 404) {
      notFoundEl.hidden = false;
      form.hidden = true;
    } else {
      showError(`Could not load note: ${err.message}`);
      form.hidden = true;
    }
  }
}

if (form) {
  const noteId = getNoteIdFromUrl();

  loadNote(noteId);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");

    const titleInput = document.getElementById("title").value;
    const contentInput = document.getElementById("content").value;
    // Only include a field as "supplied" if the user actually changed it
    // away from empty — for this simple form, both fields are always
    // present in the DOM, so we submit both as long as at least one is
    // non-empty; validateNoteForm enforces the "at least one" / non-empty
    // rules from data-model.md.
    const changes = { title: titleInput, content: contentInput };

    const errors = validateNoteForm(changes, { requireBoth: false });
    if (errors.length > 0) {
      showError(errors.join(" "));
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      await updateNote(noteId, changes);
      window.location.href = "/";
    } catch (err) {
      if (err.status === 404) {
        notFoundEl.hidden = false;
        form.hidden = true;
      } else {
        showError(err.message);
      }
    } finally {
      submitButton.disabled = false;
    }
  });
}
