---

description: "Task list template for feature implementation"
---

# Tasks: Notes Web UI

**Input**: Design documents from `/specs/002-notes-web-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pages.md, quickstart.md

**Tests**: Included, but scoped per plan.md's research decision — Vitest+jsdom unit tests
cover the frontend's pure/DOM logic (truncation, timestamp formatting, form validation,
list rendering/row removal). Full multi-page network/navigation flows are validated manually
via quickstart.md, not with additional automated tests (see research.md for why).

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- File paths are exact, per plan.md's Project Structure

## Path Conventions

Single project (per plan.md): a new `public/` directory at repo root, served by the existing
Express app; frontend tests under `tests/unit/frontend/`.

---

## Phase 1: Setup

**Purpose**: Directories and the one new dependency this feature needs

- [X] T001 Create `public/`, `public/js/`, and `tests/unit/frontend/` directories
- [X] T002 Add `jsdom` as a dev dependency (`npm install -D jsdom`) for the frontend unit tests

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared modules and server wiring every page needs

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement `public/js/api.js`: fetch wrappers `listNotes()`, `getNote(id)`,
      `createNote({title, content})`, `updateNote(id, changes)`, `deleteNote(id)` against the
      existing REST API (`/notes`), per contracts/pages.md and
      001-notes-crud-service/contracts/notes-api.md — each resolves to the parsed JSON body on
      success or throws an error carrying the response status and server error message on
      failure
- [X] T004 [P] Implement `public/js/format.js`: pure `truncateContent(content, maxLength = 100)`
      (appends `…` only when actually cut off) and `formatTimestamp(isoString)` (renders a
      human-readable date/time), per data-model.md
- [X] T005 [P] Implement `public/js/validation.js`: pure `validateNoteForm({ title, content },
      { requireBoth })` returning a list of field-level error messages — `requireBoth: true`
      (create) requires both non-empty after trim; `requireBoth: false` (edit) requires at
      least one of the two present and non-empty after trim — per data-model.md and FR-009/
      001-notes-crud-service FR-010
- [X] T006 Add `public/styles.css`: one shared, hand-written responsive stylesheet (flexbox/
      grid layout, one media query breakpoint in the ~600–768px range) used by all three pages,
      switching from a wide/multi-column desktop layout to a stacked single-column mobile
      layout, per plan.md and constitution v1.1.0's frontend constraint
- [X] T007 Modify `src/app.ts` to serve `public/` as static files (`express.static`), mounted
      so `/` resolves to `public/index.html`, alongside the existing `/notes` API mount

**Checkpoint**: Foundation ready — page implementation can now begin

---

## Phase 3: User Story 1 - Browse all captured notes (Priority: P1) 🎯 MVP

**Goal**: Opening the site shows every existing note's title, content preview, and
last-modified time (or a clear empty-state message).

**Independent Test**: With notes already existing via the API, load the list page and confirm
every note's title, preview, and last-modified time are visible; with none, confirm the
empty-state message appears — per spec.md User Story 1.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, and confirm they fail before implementing this phase.

- [X] T008 [P] [US1] Unit tests for `format.js` in `tests/unit/frontend/format.test.ts`:
      `truncateContent` leaves content ≤100 chars unchanged (no ellipsis), truncates longer
      content to ~100 chars with a trailing `…`; `formatTimestamp` renders a non-empty
      human-readable string from a sample ISO timestamp
- [X] T009 [P] [US1] jsdom tests for list rendering/removal in
      `tests/unit/frontend/list-dom.test.ts`: a `renderNoteList(notes, container)`-style
      function renders one row per note (title, truncated preview, formatted time) into a
      container element; given an empty array, it renders the "no notes yet" message instead;
      a `removeNoteRow(container, id)`-style function removes exactly the row for that id and
      leaves the others

### Implementation for User Story 1

- [X] T010 [US1] Implement `public/index.html`: page skeleton with a container element for the
      note list/empty-state message and a link to `create.html`, per contracts/pages.md
- [X] T011 [US1] Implement `public/js/list.js`: on load, calls `api.js`'s `listNotes()`; on
      success renders notes via the render function from T009 (using `format.js`'s
      `truncateContent`/`formatTimestamp`) or the empty-state message for an empty array; on
      failure shows a clear error message; renders, per note, an edit link to
      `edit.html?id=<id>` and a delete button (delete *behavior* wired in Phase 6/T018) —
      depends on T003, T004, T009, T010

**Checkpoint**: User Story 1 is fully functional and independently testable — notes can be
browsed, including the empty state.

---

## Phase 4: User Story 2 - Create a new note (Priority: P2)

**Goal**: A user can navigate to a create page, submit a title and content, and land back on
the list page with the new note visible.

**Independent Test**: From the list page, open the create page, submit valid title/content,
and confirm the browser lands back on the list page showing the new note — per spec.md User
Story 2.

### Tests for User Story 2 ⚠️

- [X] T012 [P] [US2] Unit tests for `validation.js` in create mode
      (`requireBoth: true`) in `tests/unit/frontend/validation.test.ts`: rejects an empty,
      missing, or whitespace-only title; rejects the same for content; passes when both are
      present and non-empty

### Implementation for User Story 2

- [X] T013 [US2] Implement `public/create.html`: a form with a title input, a content
      textarea, a submit control, and an element for inline validation/error messages, per
      contracts/pages.md
- [X] T014 [US2] Implement `public/js/create.js`: on submit, calls `validateNoteForm` (T005,
      `requireBoth: true`) — on failure shows the message(s) inline without navigating and
      without clearing the fields; on pass, calls `api.js`'s `createNote()` — on success
      (`201`) redirects to `/`; on a `400`/other failure shows the server's error message
      inline and keeps the entered values — depends on T003, T005, T013

**Checkpoint**: User Stories 1 and 2 both work independently — notes can be browsed and
created through the UI.

---

## Phase 5: User Story 3 - Edit an existing note (Priority: P3)

**Goal**: A user can open an existing note pre-filled for editing, change it, and see the
update reflected on the list page.

**Independent Test**: From the list page, edit an existing note, confirm the form is
pre-filled, change and submit it, and confirm the list page shows the updated content and a
refreshed last-modified time — per spec.md User Story 3.

### Tests for User Story 3 ⚠️

- [X] T015 [P] [US3] Unit tests for `validation.js` in edit mode (`requireBoth: false`) in
      `tests/unit/frontend/validation.test.ts`: passes when only title is supplied (and
      non-empty), passes when only content is supplied, rejects when neither is supplied,
      rejects when a supplied field is empty/whitespace-only

### Implementation for User Story 3

- [X] T016 [US3] Implement `public/edit.html`: same form shape as `create.html`, plus an
      element for a "note not found" message, per contracts/pages.md
- [X] T017 [US3] Implement `public/js/edit.js`: on load, reads `id` from the URL query string
      and calls `api.js`'s `getNote(id)` — on success pre-fills the form; on `404` shows a
      clear "note not found" message instead of a broken form. On submit, calls
      `validateNoteForm` (T005, `requireBoth: false`) — on failure shows inline message(s)
      without navigating; on pass, calls `api.js`'s `updateNote(id, changes)` — on success
      (`200`) redirects to `/`; on `404` shows "note no longer exists"; on `400`/other failure
      shows the server's error message inline and keeps entered values — depends on T003,
      T005, T016

**Checkpoint**: User Stories 1, 2, and 3 all work independently — notes can be browsed,
created, and edited through the UI.

---

## Phase 6: User Story 4 - Remove a note from the list (Priority: P4)

**Goal**: A user can delete a note from the list page and see it disappear without a full page
reload.

**Independent Test**: From the list page, delete an existing note and confirm it disappears
from the visible list without a page reload; attempt to delete an already-gone note and
confirm a clear message rather than a broken page — per spec.md User Story 4.

**Note on tests**: the DOM-removal mechanism itself is already covered by T009's
`removeNoteRow` test. This phase's `confirm()`-gated click handling and the 404-vs-other-error
branching are UI-wiring covered by quickstart.md scenario 8/9 (manual), consistent with
plan.md's testing-scope decision — no additional jsdom test is added here to avoid re-testing
`confirm()`/`fetch` mocking beyond what's valuable.

### Implementation for User Story 4

- [X] T018 [US4] Wire delete button click handling into `public/js/list.js`: on click, calls
      `confirm()` — cancelled means no action; confirmed calls `api.js`'s `deleteNote(id)` — on
      success (`204`) removes that note's row via the T009 removal function; on `404` shows a
      clear "already deleted" inline message and removes the row anyway; on other failure
      shows a clear error message and leaves the row in place — depends on T003, T009, T011

**Checkpoint**: All four user stories (browse, create, edit, delete) are independently
functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation spanning all pages, and documentation

- [X] T019 [P] Verify responsive behavior of `public/styles.css` across `index.html`,
      `create.html`, and `edit.html` at ~375px and ~1280px+ viewport widths (browser dev tools
      device emulation) — no horizontal scrolling, all controls reachable and legible — per
      FR-013/SC-007
- [X] T020 [P] Run every manual scenario in quickstart.md (empty state, create, create
      validation, browse populated, edit, edit validation, stale-note edit, delete, stale-note
      delete, responsive check) against the running dev server, confirming behavior matches
      contracts/pages.md
- [X] T021 Update `README.md` to document the web UI: how to reach it (`/` after `npm run
      dev`), what the three pages do, and that it's a thin client over the existing REST API

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; independent of US1 (create.js doesn't
  call list.js), though in practice you'd want US1 in place to see the created note appear
- **User Story 3 (Phase 5)**: Depends on Foundational; independent of US1/US2's files
  (edit.js is its own file), though again you'd want US1 to see the result
- **User Story 4 (Phase 6)**: Depends on Foundational AND on `public/js/list.js` existing
  (T011, US1) and its render/remove function (T009) — this is the one story that isn't
  file-independent from another, since delete wiring lives inside `list.js`
- **Polish (Phase 7)**: Depends on all four user stories being complete

### Within Each User Story

- Tests are written first and must fail before their implementation tasks are done
- HTML page skeleton before the JS file that drives it
- Shared modules (`api.js`, `format.js`, `validation.js` — Phase 2) before any page that calls
  them

### Parallel Opportunities

- T004 and T005 (Foundational) can run in parallel with each other and with T006
- T008 and T009 (US1 tests) can run in parallel — different files
- T012 (US2) and T015 (US3) both touch `validation.test.ts` but test different modes — write
  sequentially in the same file rather than truly in parallel, despite the `[P]` marker
  reflecting "different story, no code dependency" rather than "different file"
- T019 and T020 (Polish) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch both test tasks for User Story 1 together:
Task: "Unit tests for format.js in tests/unit/frontend/format.test.ts"
Task: "jsdom tests for list rendering/removal in tests/unit/frontend/list-dom.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything else)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run `tests/unit/frontend/format.test.ts` and `list-dom.test.ts`, and
   quickstart.md scenarios 1 and 4 (empty state, populated browse)
5. This is a usable MVP — notes created via the API are browsable through the UI

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → browsable MVP
3. Add User Story 2 → validate independently (US1 still works) → notes creatable through the UI
4. Add User Story 3 → validate independently (US1+US2 still work) → notes editable
5. Add User Story 4 → validate independently (US1-US3 still work) → notes deletable
6. Polish: responsive check, full quickstart.md pass, README update

---

## Notes

- [P] tasks touch different files and have no unmet dependencies (see the validation.test.ts
  caveat above for the one exception)
- [Story] label maps each task to its user story for traceability
- Tests here are scoped to what plan.md's research decision calls for — pure/DOM logic only;
  full page-navigation flows are covered by quickstart.md, not additional automated tests
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before moving to the next
