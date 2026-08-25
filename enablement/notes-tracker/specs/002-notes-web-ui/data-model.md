# Data Model: Notes Web UI

## No new persisted entity

This feature introduces no new server-side entity and does not change the `Note` entity
defined in [001-notes-crud-service/data-model.md](../001-notes-crud-service/data-model.md)
(`id`, `title`, `content`, `updatedAt`). The UI is a presentation layer over the existing
notes API; nothing new is stored, and no new field is ever sent to or accepted by the backend.

## Browser-only derived values

These exist only transiently in the browser (computed from a fetched `Note`), are never sent
back to the API, and are not persisted anywhere:

| Value | Derived from | Rule |
|---|---|---|
| Content preview | `Note.content` | Truncated to ~100 characters; if cut off, an ellipsis (`…`) is appended. If `content` is ≤100 characters, shown in full with no ellipsis. |
| Formatted last-modified time | `Note.updatedAt` | The ISO 8601 timestamp rendered as a human-readable date/time string for display (exact format is a presentation detail, per spec.md Assumptions). |

## Form state (client-side only)

The create and edit pages hold a small, transient, in-memory form state while the user is
filling out the page — never persisted beyond the page's lifetime:

| Field | Type | Notes |
|---|---|---|
| `title` | `string` | Bound to the title input. Validated client-side (non-empty after trim) before a request is sent (FR-009). |
| `content` | `string` | Bound to the content textarea. Same validation rule as `title`. |
| `id` (edit page only) | `string` | Read from the `?id=` URL query parameter on page load; identifies which note `PATCH /notes/:id` targets. Never rendered as an editable field. |

### Validation rules (client-side, mirrors FR-009 / 001-notes-crud-service FR-002 / FR-010)

- `title` and `content` must both be non-empty after trimming whitespace to submit successfully
  (create: both required; edit: at least one of the two must be supplied — matching
  001-notes-crud-service FR-010's "at least one field" rule — and any field that IS supplied
  must be non-empty).
- Client-side validation is a first line of defense for immediate feedback (spec FR-009); the
  backend's own validation (already implemented in 001-notes-crud-service) remains the
  authority — a validation error returned by the API (`400`) is also shown to the user using
  the same inline-message mechanism as the client-side check.

### State transitions (page-level, not data-level)

- **List page load** → fetch succeeds → render notes (or "no notes yet" message per FR-002) |
  fetch fails → show a clear error message.
- **Create/Edit submit** → client validation fails → show inline message, keep entered values,
  do not navigate | client validation passes → `POST`/`PATCH` → success → redirect to list page
  | `400` from server → show inline message, keep entered values | `404` from server (edit
  only, note deleted mid-edit) → show "note no longer exists" message (FR-011).
- **Delete click** → `confirm()` cancelled → no change | confirmed → `DELETE` → `204` → remove
  the note's row from the DOM (this feature's FR-010) | `404` → show inline message, remove the
  row anyway (FR-012, spec Edge Cases: it's gone either way) | other error → show error message,
  leave the row in place (spec Edge Cases).
