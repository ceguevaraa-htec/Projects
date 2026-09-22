---
description: "Task list for EPIC-0001: Employee Management"
---

# Tasks: Employee Management (EPIC-0001)

**Input**: Design documents from `/specs/001-employee-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/employee-management.md, quickstart.md — all present.

**Tests**: Included and NOT optional. Constitution Principle III (Test-First Development) is
NON-NEGOTIABLE for Domain Logic: unit tests must be written before their corresponding service
implementation, and integration tests must run against a real SQLite instance with cleanup
(NFR-0002). Every task below that creates a test is ordered before the task that makes it pass.

**Organization**: Tasks are grouped by user story (US1/US2/US3, matching spec.md's priorities
P1/P2/P3). Story-serving code lives in the shared `src/` layers described in plan.md — there is
no per-epic subfolder, since later epics extend the same repositories/domain/api directories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependency)
- **[Story]**: US1, US2, or US3 — omitted for Setup/Foundational/Polish tasks
- File paths match `plan.md`'s Project Structure exactly

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — no business logic yet.

- [X] T001 Initialize the Node.js/TypeScript project: `package.json`, `tsconfig.json`, and install
      `express`, `kysely`, `better-sqlite3`, `vitest`, `@types/express`, `@types/better-sqlite3`,
      `typescript` at the repository root (per plan.md Technical Context: TypeScript/Node/Express/
      Kysely/SQLite/Vitest only, no ORM beyond Kysely).
- [X] T002 Create the source tree skeleton exactly as defined in plan.md's Project Structure:
      `src/db/`, `src/repositories/`, `src/domain/errors/`, `src/api/routes/`,
      `src/api/middleware/`, `tests/unit/`, `tests/integration/`, `tests/contract/`.
- [X] T003 [P] Configure Vitest (`vitest.config.ts`) with coverage reporting enabled, so
      NFR-0001's >70% Domain Logic coverage target is measurable from the first test run.
- [X] T004 [P] Configure linting/formatting (e.g., ESLint + Prettier configs at repository root)
      consistent with a permissive-OSS-only toolchain (NFR-0008 — verify all added dev
      dependencies are MIT/Apache-2.0 licensed).

**Checkpoint**: Project scaffolding exists; no runtime code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure every user story depends on — database connection, schema,
error contract, logging, and the Express app shell. No user story task may begin before this
phase is complete.

**⚠️ CRITICAL**: This phase blocks all of Phase 3, 4, and 5.

- [X] T005 Implement the Kysely SQLite connection with busy-timeout configuration in
      `src/db/connection.ts` (per SDP NFR-0006 — shared across all future epics, not
      re-configured per feature).
- [X] T006 Define the Kysely database type (`Database` interface covering `employees`, `skills`,
      `employee_skills` tables for this epic) in `src/db/schema.ts`, field-matched to
      data-model.md.
- [X] T007 Write migration `0001_employee_management` in
      `src/db/migrations/0001_employee_management.ts` creating the `employees`, `skills`, and
      `employee_skills` tables per data-model.md (including the unique constraint on
      `skills.name` and the composite uniqueness of `(employee_id, skill_id)` on
      `employee_skills`).
- [X] T008 [P] Implement the typed exception hierarchy in `src/domain/errors/domain-errors.ts`:
      `EmployeeNotFoundError`, `SkillNotFoundError`, `EmployeeHasAssignmentsError`,
      `DuplicateSkillNameError`, `DuplicateEmployeeSkillError`, `EmployeeSkillNotFoundError`,
      and a base `ValidationError` — per research.md's error-handling decision and the error
      codes enumerated in `contracts/employee-management.md`.
- [X] T009 [P] Implement the Express error-handling middleware in
      `src/api/middleware/error-handler.ts`, mapping each exception type from T008 to its HTTP
      status and the `{ error_code, message }` envelope (NFR-0005/ADR-0009), exhaustively (a
      default/unhandled-exception branch must still produce a valid envelope, never a raw stack
      trace).
- [X] T010 [P] Implement the structured JSON request-logging middleware in
      `src/api/middleware/request-logger.ts` (timestamp, method, route, duration, status code —
      NFR-0003), applied globally.
- [X] T011 Assemble the Express app shell in `src/api/app.ts` (registers the middleware from
      T009/T010; route registration happens per-story below) and the entry point in
      `src/server.ts` (creates the app, starts listening — no business logic here).

**Checkpoint**: Database, error contract, logging, and app shell exist and are testable in
isolation. User story implementation can now begin.

---

## Phase 3: User Story 1 - Maintain the employee roster (Priority: P1) 🎯 MVP

**Goal**: A Manager can create, edit, and delete employees, with deletion blocked whenever the
employee has any assignment (FR-0001–FR-0003).

**Independent Test**: Create an employee, edit a field, delete an employee with no assignments
(succeeds), and attempt to delete an employee with a simulated assignment record (blocked with
`EMPLOYEE_HAS_ASSIGNMENTS`) — all verifiable without any skill or catalog data present.

### Tests for User Story 1 (write first — MUST fail before implementation exists)

- [X] T012 [P] [US1] Unit test in `tests/unit/employee.service.test.ts` for create/edit
      validation (required fields on create per FR-0001; partial update per FR-0002), and for
      `getEmployee`/`updateEmployee`/`deleteEmployee` called with a nonexistent `employeeId`
      (all three throw `EmployeeNotFoundError`).
- [X] T013 [P] [US1] Unit test in `tests/unit/employee.service.test.ts` for delete-eligibility:
      allowed when zero assignments exist, blocked (`EmployeeHasAssignmentsError`) when a
      future-only assignment exists — per spec.md's edge case that FR-0003 blocks on *any*
      assignment, not just active ones.
- [X] T014 [P] [US1] Integration test in `tests/integration/employees.api.test.ts` covering the
      full `POST /employees` → `PATCH /employees/{employeeId}` → `DELETE /employees/{employeeId}`
      cycle against a real, freshly-created temp-file SQLite database, torn down after the test
      file completes (NFR-0002); include `GET/PATCH/DELETE /employees/{employeeId}` with a
      nonexistent ID and confirm a `404 EmployeeNotFoundError` response for each.
- [X] T015 [P] [US1] Contract test in `tests/contract/openapi-conformance.test.ts` asserting
      `POST /employees`, `GET /employees`, `GET /employees/{employeeId}`,
      `PATCH /employees/{employeeId}`, and `DELETE /employees/{employeeId}` match the
      `Employee`/`EmployeeSummary`/`EmployeeCreateRequest`/`EmployeeUpdateRequest` schemas in
      `specs/contracts/openapi-spec.yaml` exactly (status codes and payload shape).

### Implementation for User Story 1

- [X] T016 [US1] Implement `src/repositories/employee.repository.ts`: Kysely queries only —
      `insert`, `update`, `findById`, `findAll` (with filter/sort params per the OpenAPI
      `GET /employees` query parameters), `delete`, and `hasAnyAssignments(employeeId)` (a query
      against the `assignments` table's existence — this epic does not own that table's schema,
      so this query must tolerate the table not yet existing during EPIC-0001-only test runs,
      returning `false` in that case).
- [X] T017 [US1] Implement `src/domain/employee.service.ts`: `createEmployee`,
      `updateEmployee`, and `deleteEmployee` (calling `hasAnyAssignments` and throwing
      `EmployeeHasAssignmentsError` per FR-0003 before calling the repository's delete), plus
      `getEmployee`/`listEmployees` pass-throughs with validation only where the schema requires
      it (uniqueness is not a rule for employees, unlike skills). `getEmployee`,
      `updateEmployee`, and `deleteEmployee` MUST each throw `EmployeeNotFoundError` when the
      repository's `findById` returns nothing, before attempting any further operation (e.g.,
      before the `hasAnyAssignments` check in `deleteEmployee`).
- [X] T018 [US1] Implement `src/api/routes/employees.routes.ts`: Express routes for
      `POST /employees`, `GET /employees`, `GET /employees/{employeeId}`,
      `PATCH /employees/{employeeId}`, `DELETE /employees/{employeeId}`, matching
      `specs/contracts/openapi-spec.yaml` request/response shapes exactly (per
      `contracts/employee-management.md`); wires to `employee.service.ts` only — no business
      logic in the route handler itself. The `error-handler.ts` middleware from T009 maps
      `EmployeeNotFoundError` to `404 NOT_FOUND` for all three single-resource routes.
- [X] T019 [US1] Register the employees router in `src/api/app.ts`.
- [X] T020 [US1] Run T012–T015 and confirm all pass; confirm Domain Logic coverage for
      `employee.service.ts` exceeds 70% (NFR-0001).

**Checkpoint**: User Story 1 is independently complete, testable, and deployable — the employee
roster is fully functional on its own.

---

## Phase 4: User Story 2 - Track each employee's skills and proficiency (Priority: P2)

> **Build-order note**: See the Implementation Strategy section at the end of this document —
> Phase 5 (User Story 3, skills catalog) is recommended to be built *before* this phase, since
> User Story 2 has a runtime dependency on a skill already existing. Phase numbering here
> reflects spec.md's priority order (P2 before P3), not the recommended build order.

**Goal**: A Manager can associate, update, and remove an employee's skills with proficiency
levels (FR-0004–FR-0005).

**Independent Test**: Add a skill (from the catalog) to an employee at a given proficiency,
change the proficiency, and remove the association — verifiable via the employee's own skill
list, without any assignment or project data present. Depends on User Story 3's skill-catalog
existing (a skill must exist to be associated), so implement Phase 5's skill-creation path (or a
minimal seed) before exercising this story end-to-end; the code in this phase has no structural
dependency on Phase 5's other operations (rename/deletion-impact/delete).

### Tests for User Story 2 (write first — MUST fail before implementation exists)

- [X] T021 [P] [US2] Unit test in `tests/unit/employee.service.test.ts` (or a new
      `employee-skill.service.test.ts` if the association logic is split out) for: successful
      association, duplicate association attempt (`DuplicateEmployeeSkillError`), associating a
      nonexistent `skillId` (`SkillNotFoundError`), associating a skill to a nonexistent
      `employeeId` (`EmployeeNotFoundError` — checked before the skill-existence check),
      updating/removing a nonexistent (employeeId, skillId) pair
      (`EmployeeSkillNotFoundError`).
- [X] T022 [P] [US2] Integration test in `tests/integration/employees.api.test.ts` covering
      `POST /employees/{employeeId}/skills` → `PATCH .../skills/{skillId}` →
      `DELETE .../skills/{skillId}` against a real SQLite database, including the duplicate-,
      nonexistent-employee-, and not-found-association edge cases, with cleanup (NFR-0002).
- [X] T023 [P] [US2] Contract test in `tests/contract/openapi-conformance.test.ts` asserting
      `POST/PATCH/DELETE /employees/{employeeId}/skills[/{skillId}]` match the
      `EmployeeSkill`/`EmployeeSkillCreateRequest` schemas in `openapi-spec.yaml` exactly.

### Implementation for User Story 2

- [X] T024 [US2] Extend `src/repositories/employee.repository.ts` (or add
      `employee-skill.repository.ts`) with Kysely queries: `insertEmployeeSkill`,
      `updateEmployeeSkillProficiency`, `deleteEmployeeSkill`, `findEmployeeSkill(employeeId,
      skillId)` — queries only, no business rules.
- [X] T025 [US2] Extend `src/domain/employee.service.ts` with `addEmployeeSkill` (checks the
      *employee* exists first, throwing `EmployeeNotFoundError` if not — before checking the
      skill exists via `skill.repository.ts` and that the association doesn't already exist,
      throwing `SkillNotFoundError`/`DuplicateEmployeeSkillError` as needed), `updateEmployeeSkill`,
      and `removeEmployeeSkill` (both throwing `EmployeeSkillNotFoundError` when the pair doesn't
      exist).
- [X] T026 [US2] Implement `src/api/routes/employee-skills.routes.ts`: Express routes for
      `POST /employees/{employeeId}/skills`, `PATCH /employees/{employeeId}/skills/{skillId}`,
      `DELETE /employees/{employeeId}/skills/{skillId}`, matching the OpenAPI shapes exactly.
- [X] T027 [US2] Register the employee-skills router in `src/api/app.ts`.
- [X] T028 [US2] Extend `GET /employees/{employeeId}` (from T018) to embed the employee's
      current skills (per the `Employee` schema's `skills` array) by joining through
      `employee_skills` and `skills`.
- [X] T029 [US2] Run T021–T023 and confirm all pass; confirm Domain Logic coverage remains
      above 70% including the new service methods (NFR-0001).

**Checkpoint**: User Stories 1 AND 2 both work independently and together — employees can be
created and given skill profiles.

---

## Phase 5: User Story 3 - Maintain the shared skills catalog (Priority: P3)

**Goal**: A Manager can create, rename, and delete catalog skills, with a mandatory
deletion-impact preview before any destructive delete (FR-0006–FR-0008).

**Independent Test**: Create a skill, rename it, preview the deletion impact of a skill in use,
and confirm the delete — verifiable via the catalog list and the deletion-impact response alone.

### Tests for User Story 3 (write first — MUST fail before implementation exists)

- [X] T030 [P] [US3] Unit test in `tests/unit/skill.service.test.ts` for: create with a unique
      name (succeeds), create with a colliding name (`DuplicateSkillNameError`), rename to a
      colliding name (`DuplicateSkillNameError`), deletion-impact computation for a skill with
      zero associations (returns `{ affectedEmployeeCount: 0, affectedProjectRoleCount: 0 }` —
      per data-model.md's flagged interim fallback, `affectedProjectRoleCount` is hardcoded to
      `0` in this epic and MUST be revisited when EPIC-0002 lands), deletion-impact for a
      skill associated with two employees (`affectedEmployeeCount: 2`), and
      `getSkill`/`renameSkill`/`getDeletionImpact`/`deleteSkill` each called with a nonexistent
      `skillId` (all four throw `SkillNotFoundError`).
- [X] T031 [P] [US3] Unit test in `tests/unit/skill.service.test.ts` for cascading delete:
      deleting a skill with existing `employee_skills` associations removes those associations
      as part of the same operation (FR-0008), not left orphaned.
- [X] T032 [P] [US3] Integration test in `tests/integration/skills.api.test.ts` covering
      `POST /skills` → `PATCH /skills/{skillId}` → `GET /skills/{skillId}/deletion-impact` →
      `DELETE /skills/{skillId}` against a real SQLite database, confirming a subsequently
      queried employee no longer lists the deleted skill, with cleanup (NFR-0002); include
      `GET/PATCH /skills/{skillId}`, `GET /skills/{skillId}/deletion-impact`, and
      `DELETE /skills/{skillId}` with a nonexistent ID and confirm a `404` `SkillNotFoundError`
      response for each.
- [X] T033 [P] [US3] Contract test in `tests/contract/openapi-conformance.test.ts` asserting
      `POST/PATCH /skills[/{skillId}]`, `GET /skills/{skillId}/deletion-impact`, and
      `DELETE /skills/{skillId}` match the `Skill`/`SkillDeletionImpact` schemas in
      `openapi-spec.yaml` exactly, including the `409 SKILL_NAME_NOT_UNIQUE` response.

### Implementation for User Story 3

- [X] T034 [US3] Implement `src/repositories/skill.repository.ts`: Kysely queries only —
      `insert`, `update`, `findById`, `findAll`, `findByName` (case-insensitive, for uniqueness
      checks), `delete` (cascading `employee_skills` deletion via a transaction),
      `countEmployeeAssociations(skillId)`, and a stubbed
      `countProjectRoleAssociations(skillId)` that returns `0` until EPIC-0002 exists (see
      data-model.md's flagged cross-epic follow-up — this stub MUST be replaced with a real
      query once the project-roles schema lands, not left as-is).
- [X] T035 [US3] Implement `src/domain/skill.service.ts`: `getSkill`, `renameSkill`,
      `getDeletionImpact`, and `deleteSkill` MUST each throw `SkillNotFoundError` when the
      repository's `findById` returns nothing, before any further operation. `createSkill`/
      `renameSkill` also check `findByName` and throw `DuplicateSkillNameError` on collision
      (FR-0006/FR-0007). `getDeletionImpact` implements the FR-0008 preview, and `deleteSkill`
      implements the FR-0008 confirmed delete, cascading via the repository transaction from
      T034.
- [X] T036 [US3] Implement `src/api/routes/skills.routes.ts`: Express routes for `POST /skills`,
      `GET /skills`, `PATCH /skills/{skillId}`, `GET /skills/{skillId}/deletion-impact`,
      `DELETE /skills/{skillId}`, matching the OpenAPI shapes exactly. The `error-handler.ts`
      middleware from T009 maps `SkillNotFoundError` to `404 NOT_FOUND` for all single-resource
      routes.
- [X] T037 [US3] Register the skills router in `src/api/app.ts`.
- [X] T038 [US3] Run T030–T033 and confirm all pass; confirm Domain Logic coverage for
      `skill.service.ts` exceeds 70% (NFR-0001).

**Checkpoint**: All three user stories work independently and together — EPIC-0001 is
functionally complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-epic validation that no single user story phase covers on its own.

- [X] T039 [P] Run the full `quickstart.md` validation guide end-to-end (all three scenarios)
      against a freshly-migrated database and confirm every documented expected outcome holds.
- [X] T040 [P] Run the complete Vitest suite with coverage and confirm overall Domain Logic
      coverage (`employee.service.ts` + `skill.service.ts` combined) exceeds 70% (NFR-0001).
- [X] T041 Verify every error response produced by this epic's endpoints (manually cross-check
      against `contracts/employee-management.md`'s error-code table) uses the `{ error_code,
      message }` envelope with no exceptions (NFR-0005/ADR-0009).
- [X] T042 Verify the structured JSON request-logging middleware (T010) emits a log line for
      every request across all endpoints added in Phases 3–5 (NFR-0003).
- [X] T043 Record, in a comment or follow-up note visible to whoever plans EPIC-0002 (e.g., a
      `TODO` referencing data-model.md's flagged note), that
      `countProjectRoleAssociations`/`affectedProjectRoleCount` must become a real query once
      the Project Management epic's schema exists — do not let this silently ship as permanent.
- [X] T044 Record, in a comment or follow-up note visible to whoever plans EPIC-0003 (e.g., a
      `TODO` in `employee.repository.ts` referencing data-model.md's flagged note), that
      `hasAnyAssignments` currently hardcodes `false` and must become a real existence query
      against the `assignments` table once the Assignment Engine epic's schema exists. Flag this
      more prominently than T043: because this stub gates FR-0003's actual delete protection
      rather than merely a display count, an overlooked stub here is a data-integrity risk (an
      employee with real assignment history could be deleted with no error), not just a cosmetic
      inaccuracy.

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational)**: strictly sequential; Phase 2 blocks everything else.
- **Phase 3 (US1)**: depends only on Phase 2. Can be implemented and shipped alone as the MVP.
- **Phase 4 (US2)**: depends on Phase 2 structurally, and on a skill existing at runtime to
  associate (satisfied by Phase 5's `createSkill`, or a minimal test-only seed) — but US2's own
  code (repository/service/routes) has no build-time dependency on US3's rename/deletion-impact/
  delete code. US2 and US3 may be implemented in either order or in parallel by different
  people; only the *runtime* exercise of US2 needs at least one skill to exist.
- **Phase 5 (US3)**: depends only on Phase 2.
- **Phase 6 (Polish)**: depends on all of Phases 3–5 being complete.

## Parallel Execution Examples

- Within Phase 2: T008, T009, T010 are `[P]` — different files, no shared dependency once T005–T007 land.
- Within Phase 3: T012, T013, T014, T015 are `[P]` — independent test files, all written before T016.
- Within Phase 4: T021, T022, T023 are `[P]` — independent test files.
- Within Phase 5: T030, T031, T032, T033 are `[P]` — independent test files.
- Phase 4 and Phase 5 implementation tasks (T024–T029 vs. T034–T038) may be worked in parallel
  by different people once Phase 2 is complete, since neither's implementation code depends on
  the other's.

## Implementation Strategy

**MVP first**: Complete Phase 1 → Phase 2 → Phase 3 (User Story 1) and stop there for the
smallest deployable increment — a working employee roster with safe deletion, no skills yet.

**Incremental delivery**: Add Phase 5 (User Story 3, skills catalog) next, since Phase 4 (User
Story 2) has a soft runtime dependency on a skill existing; then add Phase 4 to connect
employees to that catalog. Each phase boundary is a shippable, independently-testable increment,
consistent with spec.md's per-story "Independent Test" criteria.
