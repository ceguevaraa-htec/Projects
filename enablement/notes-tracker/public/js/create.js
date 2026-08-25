import { createNote } from "./api.js";
import { validateNoteForm } from "./validation.js";

const form = document.getElementById("create-form");
const errorEl = document.getElementById("form-error");

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");

    const title = document.getElementById("title").value;
    const content = document.getElementById("content").value;

    const errors = validateNoteForm({ title, content }, { requireBoth: true });
    if (errors.length > 0) {
      // Inline message; do not navigate away; entered values are untouched
      // (we never clear the form on a failed submission).
      showError(errors.join(" "));
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      await createNote({ title, content });
      window.location.href = "/";
    } catch (err) {
      showError(err.message);
    } finally {
      submitButton.disabled = false;
    }
  });
}
