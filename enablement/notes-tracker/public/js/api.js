/**
 * Thin fetch wrappers over the existing notes REST API.
 * See specs/001-notes-crud-service/contracts/notes-api.md for the full contract.
 *
 * Each function resolves to the parsed JSON body on success, or throws an
 * Error (with a `.status` property) carrying the server's error message on
 * failure, so callers can branch on status (400/404/other) uniformly.
 */

async function parseErrorMessage(response) {
  try {
    const body = await response.json();
    if (body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // response had no JSON body — fall through to a generic message
  }
  return `request failed with status ${response.status}`;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function listNotes() {
  const res = await fetch("/notes");
  if (!res.ok) {
    throw httpError(res.status, await parseErrorMessage(res));
  }
  return res.json();
}

export async function getNote(id) {
  const res = await fetch(`/notes/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw httpError(res.status, await parseErrorMessage(res));
  }
  return res.json();
}

export async function createNote({ title, content }) {
  const res = await fetch("/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) {
    throw httpError(res.status, await parseErrorMessage(res));
  }
  return res.json();
}

export async function updateNote(id, changes) {
  const res = await fetch(`/notes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (!res.ok) {
    throw httpError(res.status, await parseErrorMessage(res));
  }
  return res.json();
}

export async function deleteNote(id) {
  const res = await fetch(`/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    throw httpError(res.status, await parseErrorMessage(res));
  }
}
