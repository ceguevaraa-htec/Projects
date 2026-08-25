# Feature Specification: Notes Web UI

**Feature Branch**: `002-notes-web-ui`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Build a web-based user interface for the personal notes tracking
service, consuming the existing REST API. This is a multi-page site (standard HTML page
loads/links, no client-side routing). Pages: a list page, a create page, an edit page, and
delete from the list page. The UI must be usable on both mobile and desktop screen widths. If a
note referenced by the edit page or a delete action no longer exists, show a clear message.
Empty/missing title or content on create or edit is rejected with a clear, visible message."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse all captured notes (Priority: P1)

A user opens the site and sees every note they've saved — its title, a preview of its content,
and when it was last changed — so they can find what they're looking for at a glance.

**Why this priority**: Without a way to see what's already been captured, the UI has no value
on its own; browsing is the foundation every other page (create, edit, delete) is entered from.

**Independent Test**: With one or more notes already existing (created via the API or a prior
session), open the list page and confirm every note's title, content preview, and last-modified
time are visible — no create/edit/delete interaction required.

**Acceptance Scenarios**:

1. **Given** at least one note exists, **When** the user opens the list page, **Then** every
   note is shown with its title, a preview of its content, and its last-modified time.
2. **Given** no notes exist yet, **When** the user opens the list page, **Then** the page shows
   a clear "no notes yet" message instead of an empty or broken-looking page.
3. **Given** the list page is open, **When** the user views it on a narrow (mobile-width) or
   wide (desktop-width) screen, **Then** every note and control remains legible and reachable
   without horizontal scrolling.

---

### User Story 2 - Create a new note (Priority: P2)

A user goes from the list page to a create page, fills in a title and content, and submits it
to add a new note to their collection.

**Why this priority**: Creating notes through the UI (rather than only via the API) is what
makes this a usable product on its own, but the list page (P1) already delivers value by
displaying notes created through any means.

**Independent Test**: From the list page, navigate to the create page, submit a title and
content, and confirm the user lands back on the list page with the new note visible.

**Acceptance Scenarios**:

1. **Given** the user is on the list page, **When** they choose to create a new note, **Then**
   they are taken to a page with a title field and a content field.
2. **Given** the user is on the create page with a valid title and content entered, **When**
   they submit, **Then** the note is created, the user is returned to the list page, and the
   new note appears in it.
3. **Given** the user is on the create page, **When** they submit with an empty or missing
   title or content, **Then** the submission is rejected and a clear, visible message explains
   what's needed — without the user losing what they'd already typed.

---

### User Story 3 - Edit an existing note (Priority: P3)

A user opens an existing note for editing, changes its title and/or content, and saves the
change.

**Why this priority**: Correcting or expanding a note matters once a collection of notes
exists, but the UI is already useful for browsing and creating (P1, P2) without it.

**Independent Test**: From the list page, choose to edit an existing note, confirm its current
title and content are pre-filled, change one or both, submit, and confirm the list page now
shows the updated title/content preview and a refreshed last-modified time.

**Acceptance Scenarios**:

1. **Given** a note exists, **When** the user chooses to edit it, **Then** they are taken to a
   page pre-filled with that note's current title and content.
2. **Given** the user is on the edit page with a valid title and/or content entered, **When**
   they submit, **Then** the note's changes are saved, the user is returned to the list page,
   and the list shows the updated content and a refreshed last-modified time.
3. **Given** the user is on the edit page, **When** they submit with an empty title or content,
   **Then** the submission is rejected and a clear, visible message explains what's needed.
4. **Given** the note being edited has already been deleted (e.g., in another tab or session),
   **When** the user opens or submits the edit page for it, **Then** they see a clear message
   that the note no longer exists, instead of a broken or blank page.

---

### User Story 4 - Remove a note from the list (Priority: P4)

A user deletes a note directly from the list page, and it's gone from what they see without
needing to reload the page.

**Why this priority**: Cleaning up unwanted notes matters for a tidy collection, but browsing,
creating, and editing (P1-P3) already make the UI fully usable without it.

**Independent Test**: From the list page, delete an existing note and confirm it disappears
from the visible list without a full page reload being required to reflect the removal.

**Acceptance Scenarios**:

1. **Given** a note exists in the list, **When** the user deletes it, **Then** it is removed
   from the list as shown to the user without requiring a full page reload to reflect it.
2. **Given** a note has already been deleted (e.g., in another tab or session) before the user
   acts on it, **When** the user tries to delete it again, **Then** they see a clear message
   that the note no longer exists, instead of a broken page or a silent failure.

---

### Edge Cases

- What happens when a note's content is very long? The list page shows a truncated preview
  rather than the full content, so the list stays scannable. *(see Assumptions)*
- What happens when a user submits create/edit with a title or content that is only
  whitespace? Treated the same as empty — rejected with the same clear message.
- What happens if the user double-submits a create or edit form (e.g., double-clicks submit)?
  The UI prevents acting on the note being created/edited twice in a way that would confuse the
  user about which submission "won" (see Assumptions for disabling the control during submit).
- What happens if deleting a note fails for a reason other than "already gone" (e.g., the
  server is unreachable)? The user sees a clear error message and the note remains in the
  visible list (no false removal).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a list page that displays every existing note, showing each
  note's title, a preview of its content, and its last-modified time.
- **FR-002**: System MUST show a clear message on the list page when no notes exist, rather
  than an empty or broken-looking page.
- **FR-003**: System MUST provide, from the list page, a way to navigate to a page for creating
  a new note.
- **FR-004**: System MUST provide, for each note on the list page, a way to navigate to a page
  for editing that note and a way to delete that note.
- **FR-005**: System MUST provide a create page with a title field and a content field.
- **FR-006**: System MUST, on a valid create submission, create the note and return the user to
  the list page with the new note visible in it.
- **FR-007**: System MUST provide an edit page pre-filled with the current title and content of
  the note being edited.
- **FR-008**: System MUST, on a valid edit submission, save the change and return the user to
  the list page with the updated title/content preview and a refreshed last-modified time
  visible in it.
- **FR-009**: System MUST reject a create or edit submission whose title or content is empty,
  missing, or whitespace-only, and MUST show a clear, visible message explaining what's needed.
- **FR-010**: System MUST remove a deleted note from the list as shown to the user without
  requiring a full page reload to reflect the removal.
- **FR-011**: System MUST show a clear message, instead of a broken or blank page, when the
  edit page is opened or submitted for a note that no longer exists.
- **FR-012**: System MUST show a clear message, instead of a broken page or a silent failure,
  when a delete action targets a note that no longer exists.
- **FR-013**: System MUST remain usable and legible — every control reachable, no horizontal
  scrolling — at both mobile-width and desktop-width screens.

### Key Entities

- **Note**: The same entity the existing notes tracking service manages — a title, content, a
  last-modified time, and a unique identifier. This feature only adds a visual interface over
  it; it does not change what a note is or how it's stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can see every existing note's title, content preview, and last-modified
  time on the list page without any interaction beyond opening it.
- **SC-002**: A user can create a note and see it appear on the list page immediately after
  submitting, every time, without a manual refresh.
- **SC-003**: A user can edit a note and see the list page reflect the updated content and a
  refreshed last-modified time immediately after submitting, every time.
- **SC-004**: A user can delete a note and see it disappear from the list without a full page
  reload, every time.
- **SC-005**: 100% of attempts to edit or delete a note that no longer exists result in a clear
  message rather than a broken or blank page.
- **SC-006**: 100% of create/edit submissions with an empty, missing, or whitespace-only title
  or content are stopped with a clear explanatory message rather than an unexplained failure.
- **SC-007**: The interface remains fully usable — no horizontal scrolling, all controls
  legible and reachable — at both a mobile-width (~375px) and a desktop-width (~1280px+)
  viewport.

## Assumptions

- Deleting a note asks the user to confirm before it happens, since deletion is immediate and
  irreversible (no undo) — consistent with standard practice for destructive actions.
- The content preview shown on the list page is a truncated snippet of the full content (exact
  length is a presentation detail, not a behavioral requirement); the full content is only
  shown in full on the edit page.
- This UI has no accounts or sign-in, matching the underlying service: any user of the site can
  view, create, edit, or delete any note. Authentication is out of scope, per the project
  constitution.
- The UI is a thin presentation layer over the existing notes API — it does not introduce new
  data, new validation rules beyond what the API already enforces, or new note fields.
- "Last-modified time" is displayed in a human-readable form (e.g., a formatted date/time)
  rather than a raw machine timestamp; the exact format is a presentation detail.
- While a create or edit submission is in flight, the submit control is disabled to prevent a
  duplicate/double submission of the same data.
