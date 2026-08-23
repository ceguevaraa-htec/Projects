# Feature Specification: Personal Notes Tracking Service

**Feature Branch**: `001-notes-crud-service`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Build a simple backend service for managing personal notes. Users can create, view, update, and delete notes (each with a title and content), with each note tracking when it was last modified."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture and recall notes (Priority: P1)

A user writes down a note (a title and some content) so they don't lose the thought, and can
later look it up — either by browsing everything they've captured or by opening one specific
note.

**Why this priority**: Capturing and recalling notes is the entire reason this service exists.
Without both halves (write it down, read it back), there is no usable product — this is the
minimum viable slice.

**Independent Test**: Can be fully tested by submitting a new note with a title and content,
then confirming it appears both in the full list of notes and when retrieved individually —
without needing update or delete to exist.

**Acceptance Scenarios**:

1. **Given** no notes exist yet, **When** a user creates a note with a title and content,
   **Then** the note is stored and a unique identifier is returned for it.
2. **Given** one or more notes exist, **When** a user requests the full list of notes,
   **Then** every stored note is returned, including its title, content, and last-modified time.
3. **Given** a note exists, **When** a user requests that note by its identifier,
   **Then** the note's title, content, and last-modified time are returned.
4. **Given** a user requests a note by an identifier that does not exist, **When** the request
   is made, **Then** the user is told the note was not found (no matching note is returned).

---

### User Story 2 - Correct or expand a note (Priority: P2)

A user revisits a note and changes its title and/or content because the information changed or
they want to add more detail, without having to delete and recreate it.

**Why this priority**: Notes are rarely perfect on the first try; being able to fix or extend
one is the second most common action after capturing and recalling, but the service is already
usable (P1) without it.

**Independent Test**: Can be fully tested by creating a note, submitting a change to its title
and/or content, and confirming the stored note now reflects the new values and an updated
last-modified time.

**Acceptance Scenarios**:

1. **Given** a note exists, **When** a user updates its title and/or content, **Then** the
   stored note reflects the new values and its last-modified time is updated to the time of the
   change.
2. **Given** a user attempts to update a note by an identifier that does not exist, **When**
   the request is made, **Then** the user is told the note was not found and no note is changed.

---

### User Story 3 - Remove a note (Priority: P3)

A user deletes a note they no longer need so it stops appearing in their list of notes.

**Why this priority**: Cleaning up unwanted notes matters for a tidy, trustworthy notes
collection, but the service delivers its core value (capture, recall, correct) without it.

**Independent Test**: Can be fully tested by creating a note, deleting it by its identifier,
and confirming it no longer appears in the list or when retrieved individually.

**Acceptance Scenarios**:

1. **Given** a note exists, **When** a user deletes it by its identifier, **Then** the note is
   removed and no longer appears in the list of notes or in an individual lookup.
2. **Given** a user attempts to delete a note by an identifier that does not exist, **When**
   the request is made, **Then** the user is told the note was not found and nothing is
   removed.

---

### Edge Cases

- What happens when a user submits a note with an empty or missing title, or empty or missing
  content? The system rejects the request and reports that the title and content are required.
- What happens when a user submits an update that supplies the same title and/or content the
  note already has? The system accepts it as a valid, successful update; the note's content
  stays the same, but its last-modified time is still refreshed to the time of that update,
  consistent with any other successful update. *(see Assumptions)*
- What happens when a user submits an update with neither a title nor a content field present
  at all? The system rejects the request as invalid — an update must supply at least one field
  to change.
- What happens when the service restarts? All previously captured notes are gone — this is
  expected behavior for this iteration of the service. *(see Assumptions)*
- What happens if two changes to the same note happen in quick succession? The most recently
  applied change is what's stored, and its last-modified time reflects that most recent change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to create a note by supplying a title and content, and
  MUST assign the new note a unique identifier.
- **FR-002**: System MUST reject creation of a note whose title or content is missing or empty,
  and MUST inform the user why the request was rejected.
- **FR-003**: System MUST allow a user to retrieve the full list of existing notes, including
  each note's identifier, title, content, and last-modified time.
- **FR-004**: System MUST allow a user to retrieve a single existing note by its identifier,
  including its title, content, and last-modified time.
- **FR-005**: System MUST inform the user when a requested note identifier does not match any
  existing note (for retrieval, update, and deletion).
- **FR-006**: System MUST allow a user to update an existing note's title and/or content by its
  identifier.
- **FR-007**: System MUST record the time of the most recent change whenever a note's title or
  content is successfully created or updated.
- **FR-008**: System MUST allow a user to delete an existing note by its identifier, after which
  that note no longer appears in the list of notes or in individual lookups.
- **FR-009**: System MUST treat each note's title, content, last-modified time, and identifier
  as the complete, authoritative record of that note — no note data is retained outside of what
  is returned through create, view, update, and delete.
- **FR-010**: System MUST reject an update request that supplies neither a title nor content
  field to change, and MUST inform the user that at least one field is required.

### Key Entities

- **Note**: A single piece of personal information a user has captured. Attributes: a unique
  identifier, a title, content (free-form text), and a last-modified timestamp reflecting when
  the note was created or most recently changed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can capture a new note and immediately retrieve it back (individually or
  in the full list) with matching title and content, every time.
- **SC-002**: 100% of attempts to view, update, or delete a note that doesn't exist result in a
  clear "not found" outcome rather than an unexplained failure or an incorrect note being
  returned/changed.
- **SC-003**: After updating a note, retrieving that note reflects the new title/content and a
  last-modified time no earlier than the time the update was made, every time.
- **SC-004**: After deleting a note, it no longer appears in the full list or in an individual
  lookup, every time.
- **SC-005**: A user can go from having zero notes to having created, viewed, updated, and
  deleted a note within a single short session, with each action's result immediately visible
  in the next action.

## Assumptions

- This is a single-user service with no accounts, sign-in, or ownership distinctions between
  notes — every note is visible to and manageable by anyone using the service. Authentication
  and authorization are explicitly out of scope, per project constitution.
- Notes exist only for the lifetime of a running instance of the service; there is no
  requirement for notes to survive a restart (no persistent storage), per project constitution.
- An update that supplies the same title/content the note already has is treated as a valid,
  successful update (idempotent), not an error.
- There is no limit on the number of notes a user can create, and no maximum length is imposed
  on title or content beyond requiring both to be non-empty.
- Notes are flat, independent records — there is no folder/tag/category structure, and no
  relationships between notes.
- "View" covers both listing all notes and retrieving one note by identifier; both are
  read-only and have no side effects.
