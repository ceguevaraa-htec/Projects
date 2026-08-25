# Quickstart: Notes Web UI

Validates this feature end-to-end against [contracts/pages.md](./contracts/pages.md) and the
acceptance scenarios in [spec.md](./spec.md). Complements — does not replace —
[001-notes-crud-service/quickstart.md](../001-notes-crud-service/quickstart.md), which
validates the underlying API directly.

## Prerequisites

- Dependencies installed (`npm install`), including `jsdom` (dev dependency for the automated
  frontend tests below).
- The `public/` directory exists and is served by the running server (per plan.md).

## Run

```bash
npm run dev      # starts the Express server; visiting http://localhost:$PORT/ shows the list page
```

```bash
npm test         # runs all Vitest suites, including tests/unit/frontend/
```

## Automated coverage (what this validates without a browser)

`tests/unit/frontend/format.test.ts`, `validation.test.ts`, and `list-dom.test.ts` (Vitest +
jsdom) cover: content-preview truncation, timestamp formatting, form validation (empty/
whitespace title or content, and edit's "at least one field" rule), and that removing a note
from the rendered list actually removes its DOM row. These are the same rules exercised
manually below — the manual pass additionally proves the full multi-page, real-network flow
that jsdom deliberately isn't used for (see research.md).

## Manual validation scenarios

Open a browser to `http://localhost:$PORT/` (replace `$PORT` with the server's port) and walk
through each scenario in order.

1. **Browse notes — empty state** (User Story 1, FR-002)
   - With no notes yet, load `/`. Expect a clear "no notes yet" message, not a blank page.

2. **Create a note** (User Story 2, FR-005, FR-006)
   - Click through to the create page. Submit with both fields filled in.
   - Expect: redirected to `/`, and the new note now appears with its title, a content
     preview, and a last-modified time.

3. **Client-side validation on create** (FR-009)
   - On the create page, submit with an empty title (content filled in).
   - Expect: a clear inline message; the page does not navigate away; the content you typed is
     still in the field.

4. **Browse notes — populated state** (User Story 1, FR-001)
   - Back on `/`, confirm the note from step 2 shows its title, a preview of its content
     (truncated with `…` if the content was long), and a formatted last-modified time.

5. **Edit a note** (User Story 3, FR-007, FR-008)
   - Click "edit" on the note from step 2. Expect the form pre-filled with its current title
     and content.
   - Change the content and submit. Expect: redirected to `/`, and the note now shows the
     updated content preview and a last-modified time later than before.

6. **Client-side validation on edit** (FR-009)
   - On the edit page for an existing note, clear the title field and submit.
   - Expect: a clear inline message; no navigation; your edits are not lost.

7. **Edit a note that no longer exists** (User Story 3 scenario 4, FR-011)
   - Open the edit page for a note (note its URL, e.g. `/edit.html?id=<id>`). In another tab,
     delete that same note from the list page (step 8 below), then submit the still-open edit
     form (or reload it).
   - Expect: a clear "note not found" message — not a broken or blank form.

8. **Delete a note** (User Story 4, FR-010)
   - On `/`, click "delete" on a note. Confirm the `confirm()` dialog.
   - Expect: the note's row disappears from the list immediately, with no full page reload.

9. **Delete a note that's already gone** (User Story 4 scenario 2, FR-012)
   - With the same note id no longer present server-side (e.g. deleted in another tab just
     before you click), click delete and confirm on a stale row.
   - Expect: a clear "already deleted" inline message, and the row is removed from view either
     way (it's gone regardless).

10. **Responsive layout** (FR-013, SC-007)
    - Resize the browser (or use dev tools device emulation) to ~375px wide, then ~1280px+
      wide, on the list, create, and edit pages.
    - Expect: no horizontal scrolling at either width; all text legible and all controls
      (links, buttons, form fields) reachable and usable at both widths.

## Expected outcome

All ten scenarios pass without needing the server restarted between them (aside from step 7/9's
deliberate "delete in another tab" setup), satisfying SC-001 through SC-007. Restarting the
server clears all notes (in-memory storage, unchanged from 001-notes-crud-service) — expected,
not a bug.
