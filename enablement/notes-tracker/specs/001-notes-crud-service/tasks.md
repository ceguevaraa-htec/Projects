---

description: "Task list template for feature implementation"
---

# Tasks: Personal Notes Tracking Service

**Input**: Design documents from `/specs/001-notes-crud-service/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/notes-api.md, quickstart.md

**Tests**: Included. Constitution Principle II requires a service-layer unit test for every
feature; plan.md additionally requires a router-level integration test (via supertest) per
endpoint. Both are mandatory, not optional, for this feature.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact, per plan.md's Project Structure

## Path Conventions

Single backend project (per plan.md): `src/` and `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project directories per plan.md: `src/models/`, `src/repositories/`,
      `src/services/`, `src/routers/`, `tests/unit/`, `tests/integration/`
- [X] T002 Initialize TypeScript/Node.js project: `package.json`, `tsconfig.json`, with
      `express` as a runtime dependency and `typescript`, `vitest`, `supertest`,
      `@types/express`, `@types/supertest`, `@types/node` as dev dependencies
- [X] T003 [P] Add npm scripts to `package.json`: `dev` (run `src/server.ts` via a TS runner),
      `build` (tsc), `test` (`vitest run`)
- [X] T004 [P] Add `vitest.config.ts` at repo root configured to discover tests under `tests/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared building blocks every user story needs. Repository and logger are single,
already-complete modules (all note operations share the same `Map`) — splitting them per story
would fragment one cohesive file, so they land here in full.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Define the `Note` type in `src/models/note.ts`: `{ id: string; title: string;
      content: string; updatedAt: string }`, per data-model.md
- [X] T006 [P] Implement a minimal structured logger in `src/logger.ts` exposing a function that
      writes one line per call containing `{ action, noteId, timestamp }`, for use by the
      service layer only (constitution Principle III)
- [X] T007 Implement the notes repository in `src/repositories/notes.repository.ts`: an
      in-memory `Map<string, Note>` with `create(title, content): Note`,
      `findAll(): Note[]`, `findById(id): Note | undefined`,
      `update(id, changes): Note | undefined`, `delete(id): boolean` — data access only, no
      validation, no logging (constitution Principle I)
- [X] T008 Create the Express app skeleton in `src/app.ts`: JSON body parsing middleware, an
      error-response helper that emits `{ "error": "..." }`, and a mount point for the notes
      router (router itself added in later phases)
- [X] T009 Create the process entrypoint in `src/server.ts` that imports the app from
      `src/app.ts` and starts it listening on a configurable port

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Capture and recall notes (Priority: P1) 🎯 MVP

**Goal**: A user can create a note (title + content) and read it back, individually or in the
full list.

**Independent Test**: Submit a new note via `POST /notes`, then confirm it's returned by both
`GET /notes` and `GET /notes/:id`, per spec.md User Story 1.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, and confirm they fail before implementing this phase.

- [X] T010 [P] [US1] Unit tests for create/list/get in
      `tests/unit/notes.service.test.ts`: successful create returns a note with a generated
      `id` and `updatedAt`; create rejects empty/missing `title` or `content` (FR-002);
      `listNotes` returns all created notes; `getNoteById` returns the matching note or a
      not-found result for an unknown id (FR-004, FR-005)
- [X] T011 [P] [US1] Integration tests for `POST /notes`, `GET /notes`, `GET /notes/:id` in
      `tests/integration/notes.router.test.ts` using supertest against the app from
      `src/app.ts`: asserts `201` + body shape on valid create, `400` on empty
      title/content, `200` + array on list, `200` + note on valid get, `404` on unknown id,
      per contracts/notes-api.md

### Implementation for User Story 1

- [X] T012 [US1] Implement `createNote(title, content)`, `listNotes()`, and
      `getNoteById(id)` in `src/services/notes.service.ts`: validate `title`/`content` are
      non-empty on create (throw/return a validation error otherwise), delegate storage to the
      repository from T007, and call the logger from T006 once per successful create with
      `{ action: "create", noteId, timestamp }` (constitution Principle III; reads are not
      logged)
- [X] T013 [US1] Implement `POST /notes`, `GET /notes`, `GET /notes/:id` in
      `src/routers/notes.router.ts`: parse the request, call the corresponding service
      function from T012, and map its result to `201`/`200`/`400`/`404` per
      contracts/notes-api.md — no validation or logging logic in the router itself
      (constitution Principle I)
- [X] T014 [US1] Mount the notes router from T013 onto the Express app in `src/app.ts` at the
      `/notes` base path

**Checkpoint**: User Story 1 is fully functional and independently testable — a user can
create and recall notes end-to-end.

---

## Phase 4: User Story 2 - Correct or expand a note (Priority: P2)

**Goal**: A user can change an existing note's title and/or content without recreating it.

**Independent Test**: Create a note, `PATCH` a change to its title/content, and confirm the
stored note reflects the new values with a refreshed `updatedAt`, per spec.md User Story 2.

### Tests for User Story 2 ⚠️

- [X] T015 [P] [US2] Unit tests for update in `tests/unit/notes.service.test.ts`: a valid
      partial update (title only, content only, or both) changes only the supplied field(s) and
      refreshes `updatedAt` (FR-006, FR-007); an update supplying the same title/content the
      note already has still succeeds and still refreshes `updatedAt` (idempotent, per
      data-model.md); an update supplying an empty `title` or `content` is rejected (FR-002); an
      update supplying neither `title` nor `content` is rejected (FR-010); updating an unknown
      id returns a not-found result and changes nothing (FR-005)
- [X] T016 [P] [US2] Integration tests for `PATCH /notes/:id` in
      `tests/integration/notes.router.test.ts`: asserts `200` + updated body (with refreshed
      `updatedAt`) on a valid update, including a same-value update; `400` on an empty supplied
      field and on a body with neither field present (FR-010); `404` on unknown id, per
      contracts/notes-api.md

### Implementation for User Story 2

- [X] T017 [US2] Implement `updateNote(id, changes)` in `src/services/notes.service.ts`:
      reject a `changes` object with neither `title` nor `content` present (FR-010), validate
      any supplied `title`/`content` is non-empty, leave omitted fields unchanged, always set
      `updatedAt` to the current time on a successful update — including a same-value update
      (idempotent, per data-model.md) — return a not-found result for an unknown id, and log
      `{ action: "update", noteId, timestamp }` on success (depends on T012 for shared
      validation helpers/conventions)
- [X] T018 [US2] Implement `PATCH /notes/:id` in `src/routers/notes.router.ts`, mapping
      `updateNote`'s result to `200`/`400`/`404` per contracts/notes-api.md, including the
      `400` case where the request body has neither field (FR-010) (depends on T013 for the
      router file's existing structure)

**Checkpoint**: User Stories 1 and 2 both work independently — notes can be captured, recalled,
and corrected.

---

## Phase 5: User Story 3 - Remove a note (Priority: P3)

**Goal**: A user can delete a note they no longer need.

**Independent Test**: Create a note, delete it by id, and confirm it no longer appears in the
list or in an individual lookup, per spec.md User Story 3.

### Tests for User Story 3 ⚠️

- [X] T019 [P] [US3] Unit tests for delete in `tests/unit/notes.service.test.ts`: deleting an
      existing id removes it (subsequent `getNoteById` returns not-found) (FR-008); deleting an
      unknown id returns a not-found result and removes nothing (FR-005)
- [X] T020 [P] [US3] Integration tests for `DELETE /notes/:id` in
      `tests/integration/notes.router.test.ts`: asserts `204` with no body on valid delete,
      `404` on unknown id, and that a follow-up `GET /notes/:id` for the deleted id returns
      `404`, per contracts/notes-api.md

### Implementation for User Story 3

- [X] T021 [US3] Implement `deleteNote(id)` in `src/services/notes.service.ts`: delegate
      removal to the repository, return a not-found result for an unknown id, and log
      `{ action: "delete", noteId, timestamp }` on success (depends on T012 for shared
      conventions)
- [X] T022 [US3] Implement `DELETE /notes/:id` in `src/routers/notes.router.ts`, mapping
      `deleteNote`'s result to `204`/`404` per contracts/notes-api.md (depends on T013 for the
      router file's existing structure)

**Checkpoint**: All user stories (create/recall, update, delete) are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and documentation that spans all user stories

- [X] T023 [P] Run every scenario in `quickstart.md` against the running dev server (`npm run
      dev` + the curl commands) and confirm the observed status codes/bodies match
      contracts/notes-api.md
- [X] T024 [P] Add a `README.md` at repo root documenting how to install, run (`npm run dev`),
      test (`npm test`), and the five available endpoints
- [X] T025 Review the logger output (T006) across `createNote`, `updateNote`, and `deleteNote`
      to confirm every successful mutation logs exactly one entry with `action`, `noteId`, and
      `timestamp`, and that no read-only operation logs anything (constitution Principle III
      compliance pass)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; T017/T018 build on the service/router
  files T012/T013 create, but do not require US1's tests to pass first
- **User Story 3 (Phase 5)**: Depends on Foundational; T021/T022 build on the same shared files
  as US2
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Tests are written first and must fail before their implementation tasks are done
- Service-layer task before router task (router calls the service)
- Router task before the "mount"/next-story task that extends the same file

### Parallel Opportunities

- T003 and T004 (Setup) can run in parallel
- T006 (logger) can run in parallel with T005 (model) and T007 (repository) in Foundational
- Within each user story, the unit test task and the integration test task (e.g. T010 + T011)
  can run in parallel — different files
- T023 and T024 (Polish) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch both test tasks for User Story 1 together:
Task: "Unit tests for create/list/get in tests/unit/notes.service.test.ts"
Task: "Integration tests for POST/GET/GET:id in tests/integration/notes.router.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything else)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run `tests/unit/notes.service.test.ts` and
   `tests/integration/notes.router.test.ts` for US1, and the create/recall scenario in
   quickstart.md
5. This is a usable MVP — notes can be captured and recalled

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → MVP
3. Add User Story 2 → validate independently (US1 still passes)
4. Add User Story 3 → validate independently (US1 + US2 still pass)
5. Polish: quickstart.md full run, README, logging compliance pass

---

## Notes

- [P] tasks touch different files and have no unmet dependencies
- [Story] label maps each task to its user story for traceability
- Tests are mandatory here (constitution Principle II + plan.md), not optional — confirm each
  fails before writing the corresponding implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before moving to the next
