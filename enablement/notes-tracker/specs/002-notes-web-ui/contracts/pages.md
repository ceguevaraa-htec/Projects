# UI Contract: Notes Web Pages

These pages are static files served by the existing Express app and consume the existing REST
API defined in
[001-notes-crud-service/contracts/notes-api.md](../../001-notes-crud-service/contracts/notes-api.md).
This document specifies each page's URL, on-load behavior, and outcomes — not new backend
endpoints.

## `GET /` — list page (`public/index.html`)

**On load**: calls `GET /notes`.

- Success (`200`) with a non-empty array → renders each note's title, a truncated content
  preview (~100 chars + `…` if cut off), and a formatted last-modified time (FR-001).
- Success (`200`) with an empty array → shows a "no notes yet" message (FR-002).
- Request failure (network/server error) → shows a clear error message.

**Controls**:
- A link to `/create.html` (FR-003).
- Per note: a link to `/edit.html?id=<id>` (FR-004) and a delete button.

**Delete button behavior** (this feature's FR-010, FR-012):
1. `confirm()` — cancelled → no action.
2. Confirmed → `DELETE /notes/:id`.
   - `204` → remove that note's row from the DOM directly (no reload).
   - `404` → show a clear inline message ("already deleted") and remove the row anyway.
   - Other error → show a clear error message; leave the row in place.

## `GET /create.html` — create page

**Form fields**: `title` (text input), `content` (textarea).

**On submit**:
1. Client-side validation: `title` and `content` both required, non-empty after trim (FR-009).
   - Fails → show inline message next to the relevant field(s); do not navigate; keep entered
     values.
2. Passes → `POST /notes` with `{ title, content }`.
   - `201` → redirect to `/` (list page now shows the new note) (FR-006).
   - `400` (server-side validation, e.g. a race where the same rule fails server-side) → show
     the server's error message inline; keep entered values.
   - Other error → show a clear error message; keep entered values.

## `GET /edit.html?id=<id>` — edit page

**On load**: reads `id` from the query string, calls `GET /notes/:id`.

- `200` → pre-fill the form with the note's current `title` and `content` (FR-007).
- `404` → show a clear "note not found" message instead of a broken/empty form (FR-011).
- Other error → show a clear error message.

**Form fields**: same as create page, pre-filled.

**On submit**:
1. Client-side validation: same rule as create (FR-009); additionally, at least one of
   `title`/`content` must be supplied, matching 001-notes-crud-service FR-010.
   - Fails → show inline message; do not navigate; keep entered values.
2. Passes → `PATCH /notes/:id` with the changed field(s).
   - `200` → redirect to `/` (list page shows updated content + refreshed last-modified time)
     (FR-008).
   - `400` → show the server's error message inline; keep entered values.
   - `404` (note deleted between page load and submit) → show a clear "note no longer exists"
     message (FR-011).
   - Other error → show a clear error message; keep entered values.

## Cross-cutting

- All three pages share `public/styles.css`: responsive via flexbox/grid and one media query
  breakpoint (~600–768px), remaining usable with no horizontal scrolling at ~375px and
  ~1280px+ viewports (FR-013).
- No page introduces new backend requirements — every network call targets an endpoint already
  defined in `001-notes-crud-service/contracts/notes-api.md`.
