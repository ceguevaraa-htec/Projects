---
description: "Task list for EPIC-0003: Assignment Engine"
---

# Tasks: Assignment Engine (EPIC-0003)

**Input**: Design documents from `/specs/003-assignment-engine/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/assignment-engine.md, quickstart.md — all present. EPIC-0001 and EPIC-0002 already implemented and passing.

**Tests**: Included and NOT optional. Constitution Principle III (Test-First Development) is
NON-NEGOTIABLE — unchanged from EPIC-0001/EPIC-0002's precedent.

**Organization**: Tasks are grouped by user story (US1/US2/US3, matching spec.md's priorities
P1/P2/P3), plus a dedicated Phase 5 for the four cross-epic stub discharges (explicit,
first-class tasks per plan.md/research.md, not folded into other phases). This epic **extends**
the existing `src/` tree in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependency)
- **[Story]**: US1, US2, or US3 — omitted for Setup/Foundational/Discharge/Polish tasks
- File paths match `plan.md`'s Project Structure exactly

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new dependencies or scaffolding are needed — EPIC-0001/EPIC-0002 already
installed the full stack. This phase only confirms that baseline still holds.

- [X] T001 Confirm the existing test suite (both prior epics) still passes (`npm test`) before
      starting any EPIC-0003 changes, establishing a clean baseline.

**Checkpoint**: Baseline confirmed; no scaffolding changes needed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, the shared date utility, and error-hierarchy extensions every user story
depends on. No user story task may begin before this phase is complete.

**⚠️ CRITICAL**: This phase blocks all of Phase 3, 4, and 5.

- [X] T002 Extend `src/db/schema.ts`'s `Database` interface with `AssignmentTable`, field-matched
      to data-model.md.
- [X] T003 Write migration `0003_assignment_engine` in
      `src/db/migrations/0003_assignment_engine.ts` creating the `assignments` table per
      data-model.md, with `employee_id` and `project_role_id` foreign keys using
      `ON DELETE RESTRICT` (per research.md's rationale — a deliberate departure from this
      codebase's prior `CASCADE`-based FKs).
- [X] T004 Register migration `0003_assignment_engine` in `src/db/migrations/index.ts`'s
      migration registry, alongside the existing `0001`/`0002` entries.
- [X] T005 [P] Implement `src/domain/date-utils.ts`: `isInFuture(date: string): boolean` and
      `rangesOverlap(rangeA: {start: string; end: string}, rangeB: {start: string; end: string}):
      boolean`, both at calendar-day granularity, local timezone, per research.md. This MUST be
      the only place "today" or "overlap" is computed anywhere in this epic.
- [X] T006 [P] Write `tests/unit/date-utils.test.ts` covering boundary cases: a date exactly
      today (`isInFuture` returns `false`), a date tomorrow (`true`), a date yesterday
      (`false`); `rangesOverlap` for identical ranges, full containment, partial overlap,
      single-day overlap (one range's end equals the other's start), and zero overlap —
      targeting 100% branch coverage on both functions. Run this task's tests and confirm they
      pass before any other task depends on `date-utils.ts`.
- [X] T007 [P] Extend the typed exception hierarchy in `src/domain/errors/domain-errors.ts`: add
      `CapacityExceededError`, `ProjectNotActiveError`, `AssignmentNotEditableError`,
      `AssignmentNotCancellableError`, `AssignmentNotFoundError` — per research.md and the error
      codes enumerated in `contracts/assignment-engine.md`. Reuse the existing
      `EmployeeNotFoundError`/`ProjectRoleNotFoundError`/`ValidationError` as-is.
- [X] T008 [P] Extend `tests/helpers/fakes.ts` with `FakeAssignmentRepository` (in-memory test
      double implementing the `AssignmentRepository` interface defined in T013), mirroring the
      existing fakes' pattern, exposing enough surface (insert/find/delete plus a way to seed
      assignments directly) for `assignment.service.test.ts` to exercise capacity and
      future-past rules without a real database.

**Checkpoint**: Schema, the shared date utility (with its own passing tests), error contract,
and test doubles exist. User story implementation can now begin.

---

## Phase 3: User Story 1 - Create a capacity-safe assignment (Priority: P1) 🎯 MVP

**Goal**: A Manager can create an assignment with hard-blocked capacity validation and
active-project restriction (FR-0013–FR-0015).

**Independent Test**: Create a valid assignment (succeeds), attempt one that would push an
employee over 100% capacity on overlapping dates (blocked), and attempt one against a
non-Active project (blocked) — all verifiable without editing/cancellation or skill-match data.

### Tests for User Story 1 (write first — MUST fail before implementation exists)

- [X] T009 [P] [US1] Unit test in `tests/unit/assignment.service.test.ts` for creation
      validation: required fields, `capacityPercent` must be an integer >0 and ≤100, `endDate`
      not before `startDate`, and the resolved-gap rule that the request's `projectId` must
      match the target role's actual parent project (`ValidationError` on mismatch).
- [X] T010 [P] [US1] Unit test in `tests/unit/assignment.service.test.ts` for capacity
      validation using `date-utils.ts`'s `rangesOverlap`: an assignment that keeps the
      employee's overlapping-date total at or below 100% succeeds; one that would exceed it
      throws `CapacityExceededError`; a non-overlapping assignment for the same employee
      succeeds regardless of the other assignment's capacity.
- [X] T011 [P] [US1] Unit test in `tests/unit/assignment.service.test.ts` for the active-project
      restriction: creation against a role whose project is Active succeeds; creation against
      Draft/Completed/Cancelled projects each throw `ProjectNotActiveError`.
- [X] T012 [P] [US1] Integration test in `tests/integration/assignments.api.test.ts` covering
      `POST /assignments` end-to-end against a real, freshly-created temp-file SQLite database
      (employee + Active project + role all created first via existing endpoints), including
      the capacity-exceeded and project-not-active rejection cases, with cleanup (NFR-0002).
- [X] T013 [P] [US1] Contract test in `tests/contract/openapi-conformance.test.ts` asserting
      `POST /assignments` and `GET /assignments/{assignmentId}` match the
      `Assignment`/`AssignmentCreateRequest` schemas in `specs/contracts/openapi-spec.yaml`
      exactly (status codes and payload shape, including `employeeName`/`projectName`/
      `roleName`/`temporalStatus`).

### Implementation for User Story 1

- [X] T014 [US1] Implement `src/repositories/assignment.repository.ts`: Kysely queries only —
      `insert`, `findById` (joined with employee/project/role names for the `Assignment`
      response shape), `findAllForEmployee(employeeId)` (used by capacity validation and by
      `getCurrentUtilization`), `delete`, `update`. Define the `AssignmentRepository` interface
      here (consumed by T008's fake).
- [X] T015 [US1] Implement `src/domain/assignment.service.ts`'s `createAssignment`: validates
      input (T009's rules), validates the `projectId`/role-parent-project match, validates the
      target project is Active (`ProjectNotActiveError` via the existing `ProjectRepository`),
      computes the employee's overlapping-date capacity sum via `date-utils.ts`'s
      `rangesOverlap` against `findAllForEmployee` (`CapacityExceededError` if it would exceed
      100), and calls the repository's `insert`.
- [X] T016 [US1] Implement `src/api/routes/assignments.routes.ts`: `POST /assignments` and
      `GET /assignments/{assignmentId}`, matching `specs/contracts/openapi-spec.yaml` exactly;
      wires to `assignment.service.ts` only.
- [X] T017 [US1] Register the assignments router in `src/api/app.ts` (construct
      `AssignmentRepository`/`AssignmentService` alongside the existing wiring; `AssignmentService`
      takes `EmployeeRepository`/`ProjectRepository`/`SkillRepository` as needed for validation).
- [X] T018 [US1] Run T009–T013 and confirm all pass; confirm Domain Logic coverage for
      `assignment.service.ts` exceeds 70% (NFR-0001).

**Checkpoint**: User Story 1 is independently complete, testable, and deployable — capacity-safe
assignment creation is fully functional on its own.

---

## Phase 4: User Story 2 - Edit or cancel a future-dated assignment only (Priority: P2)

**Goal**: A Manager can edit or cancel an assignment only while its start date is in the future
(FR-0016–FR-0017).

**Independent Test**: Create a future-dated assignment, edit it successfully, then confirm both
edit and cancel are rejected once the assignment's start date is today or in the past —
independently verifiable without the skill-match feature.

### Tests for User Story 2 (write first — MUST fail before implementation exists)

- [X] T019 [P] [US2] Unit test in `tests/unit/assignment.service.test.ts` for edit: a future-
      dated assignment's role/capacity/dates can be changed, re-running T010/T011's validation
      (excluding the assignment being edited from its own capacity check, per data-model.md);
      editing throws `AssignmentNotFoundError` for a nonexistent id.
- [X] T020 [P] [US2] Unit test in `tests/unit/assignment.service.test.ts` for the future/past
      gate: editing an assignment whose (persisted, pre-edit) `startDate` is today or in the
      past throws `AssignmentNotEditableError`, using `date-utils.ts`'s `isInFuture` — not an
      inline date comparison.
- [X] T021 [P] [US2] Unit test in `tests/unit/assignment.service.test.ts` for cancel: a future-
      dated assignment can be deleted, freeing its capacity for subsequent checks; cancelling an
      assignment whose `startDate` is today or in the past throws
      `AssignmentNotCancellableError`; cancelling a nonexistent id throws
      `AssignmentNotFoundError`.
- [X] T022 [P] [US2] Integration test in `tests/integration/assignments.api.test.ts` covering
      `PATCH /assignments/{assignmentId}` and `DELETE /assignments/{assignmentId}` end-to-end,
      including both the future-dated-success and past/current-rejection cases. **Seeding the
      past-dated case**: creation has no future-only restriction (only edit/cancel do, per
      FR-0016/FR-0017 — see data-model.md's Validation rules), so the past-dated assignment is
      created via a normal `POST /assignments` request with a `startDate` in the past, through
      `supertest` like every other assignment in this file — no raw Kysely seeding, no
      service-layer bypass, and no new test helper are needed. (An earlier draft of this task
      incorrectly assumed the API couldn't create one; it can.) Use the shared `createTestDb()`
      helper from `tests/helpers/db.ts` (same pattern as `employees.api.test.ts`/
      `projects.api.test.ts`) for the database itself, with cleanup (NFR-0002).
- [X] T023 [P] [US2] Contract test in `tests/contract/openapi-conformance.test.ts` asserting
      `PATCH /assignments/{assignmentId}` and `DELETE /assignments/{assignmentId}` match the
      `AssignmentUpdateRequest` schema and the `409 ASSIGNMENT_NOT_EDITABLE`/
      `409 ASSIGNMENT_NOT_CANCELLABLE` `ErrorResponse` shapes exactly.

### Implementation for User Story 2

- [X] T024 [US2] Implement `src/domain/assignment.service.ts`'s `updateAssignment`: loads the
      existing assignment (`AssignmentNotFoundError` if missing), checks
      `date-utils.ts`'s `isInFuture` against its *persisted* `startDate`
      (`AssignmentNotEditableError` if not future), re-runs T015's active-project and capacity
      validation (excluding this assignment from its own overlap check), then persists.
- [X] T025 [US2] Implement `src/domain/assignment.service.ts`'s `cancelAssignment`: loads the
      existing assignment (`AssignmentNotFoundError` if missing), checks `isInFuture`
      (`AssignmentNotCancellableError` if not future), then calls the repository's `delete`.
- [X] T026 [US2] Extend `src/api/routes/assignments.routes.ts` with `PATCH
      /assignments/{assignmentId}` and `DELETE /assignments/{assignmentId}`, matching the
      OpenAPI shapes exactly.
- [X] T027 [US2] Run T019–T023 and confirm all pass; confirm Domain Logic coverage for
      `assignment.service.ts` remains above 70% including the new methods (NFR-0001).

**Checkpoint**: User Stories 1 AND 2 both work independently and together — capacity-safe
creation plus history-preserving edit/cancel are fully functional.

---

## Phase 5: User Story 3 - Advisory skill-match signal on the candidates list (Priority: P3)

**Goal**: A Manager can view every employee as a candidate for a role, each annotated with an
accurate, non-filtering match tier (FR-0018), and with a real `currentUtilizationPercent` via
the shared `getCurrentUtilization` function.

**Independent Test**: Request the candidate list for a role with required skills and confirm
every employee appears (none filtered) with the correct tier, independent of whether any
assignment is ever created from that list.

### Tests for User Story 3 (write first — MUST fail before implementation exists)

- [X] T028 [P] [US3] Unit test in `tests/unit/assignment.service.test.ts` for
      `getMatchTier`/candidate listing: `strong` when every required skill is at
      Intermediate/Expert; `partial` when some-but-not-all required skills are present, or all
      are present but at least one only Beginner; `no_match` when none are present; `no_requirement`
      when the role has zero required skills; the candidate list never omits an employee
      regardless of tier.
- [X] T029 [P] [US3] Unit test in `tests/unit/assignment.service.test.ts` for
      `getCurrentUtilization(employeeId)`: sums capacity only across assignments whose date
      range includes today (via `date-utils.ts`), returns `0` for an employee with no current
      assignments, and is the single function whose result both the candidate list and (per
      Phase 6) the Employee response path use — no duplicate summation logic exists elsewhere.
- [X] T030 [P] [US3] Integration test in `tests/integration/assignments.api.test.ts` (or a new
      `tests/integration/candidates.api.test.ts`) covering
      `GET /projects/{projectId}/roles/{roleId}/candidates` end-to-end against a real database,
      confirming all tiers and the non-filtering guarantee, with cleanup (NFR-0002).
- [X] T031 [P] [US3] Contract test in `tests/contract/openapi-conformance.test.ts` asserting
      `GET /projects/{projectId}/roles/{roleId}/candidates` matches the `CandidateEmployee`
      array shape in `openapi-spec.yaml` exactly.

### Implementation for User Story 3

- [X] T032 [US3] Implement `src/domain/assignment.service.ts`'s `getCurrentUtilization(employeeId):
      Promise<number>` — the ONE shared implementation (per research.md/data-model.md), using
      `assignment.repository.ts`'s `findAllForEmployee` filtered via `date-utils.ts` for "date
      range includes today," then summed.
- [X] T033 [US3] Implement `src/domain/assignment.service.ts`'s `listCandidates(projectId, roleId)`:
      loads the role's required skills (via the existing `ProjectRepository`), lists all
      employees (via the existing `EmployeeRepository`) with their skills (via the existing
      `SkillRepository`), computes each employee's `matchTier` per data-model.md's rules and
      `currentUtilizationPercent` via T032's shared function — never filtering any employee out.
- [X] T034 [US3] Add `GET /projects/{projectId}/roles/{roleId}/candidates` to
      `src/api/routes/projects.routes.ts` (nested under the existing project-role routes, per
      contracts/assignment-engine.md), wiring to `assignment.service.ts`'s `listCandidates`.
- [X] T035 [US3] Run T028–T031 and confirm all pass; confirm Domain Logic coverage for
      `assignment.service.ts` remains above 70% including the new methods (NFR-0001).

**Checkpoint**: All three user stories work independently and together — EPIC-0003 is
functionally complete except for the cross-epic stub discharges (Phase 6).

---

## Phase 6: Cross-Epic Stub Discharge (first-class, not an afterthought)

**Purpose**: Replace all four interim stubs/forward-references flagged in EPIC-0001 and
EPIC-0002 with real logic, now that `assignments` exists — per plan.md's Summary and
research.md's explicit decision to treat this as planned scope, not a side-effect of the
migration task.

**⚠️ Depends on**: Phase 2 (schema/date-utils) and Phase 3's `assignment.repository.ts`
(T014) — but not on Phases 4/5, so this phase may run in parallel with them once T014 lands.

- [X] T036 [P] Discharge EPIC-0001 T044: change `src/repositories/employee.repository.ts`'s
      `hasAnyAssignments(employeeId)` from its hardcoded `false` to
      `SELECT EXISTS(SELECT 1 FROM assignments WHERE employee_id = ?)` via Kysely. Remove the
      "interim EPIC-0001-only stub" JSDoc comment (it is no longer a stub).
- [X] T037 [P] Add a case to `tests/integration/employees.api.test.ts` (EPIC-0001, existing
      file) creating a real assignment and confirming `DELETE /employees/{employeeId}` returns
      `409 EMPLOYEE_HAS_ASSIGNMENTS` end-to-end — mirroring EPIC-0002's T022/T023 pattern. No
      corresponding unit test addition is needed: `EmployeeService`'s logic is unchanged (only
      `employee.repository.ts`'s query changes from stub to real), and
      `FakeEmployeeRepository.assignmentsByEmployeeId` already let EPIC-0001's own unit tests
      exercise the blocked branch — this integration test is the only genuinely new coverage.
- [X] T038 [P] Update `specs/001-employee-management/data-model.md`'s flagged note on
      `hasAnyAssignments` to `✅ RESOLVED by EPIC-0003`, referencing this task and
      `specs/003-assignment-engine/tasks.md` T036, mirroring the RESOLVED annotation EPIC-0002
      added for `affectedProjectRoleCount`. Update `specs/001-employee-management/tasks.md` T044
      with the same resolution note EPIC-0002's tasks.md T043 received.
- [X] T039 [P] Discharge EPIC-0002 T033 (part 1): change
      `src/repositories/project.repository.ts`'s `hasAnyAssignments(projectId)` from hardcoded
      `false` to a real query joining `assignments` through `project_roles` to find any
      assignment whose role belongs to the project. Remove the stub JSDoc comment.
- [X] T040 [P] Discharge EPIC-0002 T033 (part 2): change
      `src/repositories/project.repository.ts`'s `roleHasAnyAssignments(roleId)` from hardcoded
      `false` to `SELECT EXISTS(SELECT 1 FROM assignments WHERE project_role_id = ?)`. Remove
      the stub JSDoc comment.
- [X] T041 [P] Add cases to `tests/integration/projects.api.test.ts` (EPIC-0002, existing file)
      confirming `DELETE /projects/{projectId}` and `DELETE /projects/{projectId}/roles/{roleId}`
      return `409 PROJECT_HAS_ASSIGNMENTS`/`409 ROLE_HAS_ASSIGNMENTS` end-to-end — mirroring
      EPIC-0002's own T022/T023 pattern, now applied one epic later to itself. No corresponding
      unit test addition is needed: `ProjectService`'s logic is unchanged (only
      `project.repository.ts`'s queries change from stub to real), and
      `FakeProjectRepository.assignmentsByProjectId`/`assignmentsByRoleId` already let
      EPIC-0002's own unit tests exercise both blocked branches — these integration tests are
      the only genuinely new coverage.
- [X] T042 [P] Update `specs/002-project-management/data-model.md`'s two flagged notes (on
      `Project.hasAnyAssignments` and `ProjectRole.roleHasAnyAssignments`) to
      `✅ RESOLVED by EPIC-0003`, referencing T039/T040. Update
      `specs/002-project-management/tasks.md` T033 with the same resolution-note treatment.
- [X] T043 [P] Discharge the discovered fourth item: change
      `src/api/routes/employees.routes.ts`'s hardcoded `currentUtilizationPercent: 0` (in all
      three response sites — create, get-by-id, update) to call T032's shared
      `assignmentService.getCurrentUtilization(employeeId)`, and replace the hardcoded
      `assignments: []` with the employee's real assignment list via
      `assignment.repository.ts`'s `findAllForEmployee`. This requires `employees.routes.ts` to
      receive an `AssignmentService` instance — extend its router factory signature and update
      `app.ts`'s wiring accordingly.
- [X] T044 [P] Add a test case to `tests/integration/employees.api.test.ts` (EPIC-0001, existing
      file) confirming `GET /employees/{employeeId}` reflects a real, non-zero
      `currentUtilizationPercent` and a non-empty `assignments` array once a current assignment
      exists — mirroring EPIC-0002's T023 pattern for its own analogous discharge.
- [X] T045 Update `specs/001-employee-management/data-model.md`'s `currentUtilizationPercent`
      field note to `✅ RESOLVED by EPIC-0003`, referencing T043, since this was a documented
      forward-reference even though not named in this epic's original planning input (see
      plan.md/research.md for why it was folded in).

**Checkpoint**: All four cross-epic follow-ups are discharged and verified, with both prior
epics' documentation updated to reflect resolution — the full assignment-protection story
(FR-0003, FR-0011, FR-0012) is now genuinely enforced end-to-end, not just structurally present.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Whole-epic validation that no single user story or discharge phase covers on its
own.

- [X] T046 [P] Run the full `quickstart.md` validation guide end-to-end (all four scenarios)
      against a freshly-migrated database and confirm every documented expected outcome holds.
- [X] T047 [P] Run the complete Vitest suite (all three epics) with coverage and confirm overall
      Domain Logic coverage remains above 70% (NFR-0001), and that `date-utils.ts` specifically
      is at or near 100% branch coverage.
- [X] T048 Verify every error response produced by this epic's endpoints (manually cross-check
      against `contracts/assignment-engine.md`'s error-code table) uses the `{ error_code,
      message }` envelope with no exceptions (NFR-0005/ADR-0009).
- [X] T049 Verify the existing structured JSON request-logging middleware (reused unchanged)
      emits a log line for every request across all endpoints added in Phases 3–6 (NFR-0003).
- [X] T050 Grep the entire `src/` tree for any date-comparison logic (string/Date comparisons
      involving "today," "now," or overlap checks) outside `date-utils.ts` and confirm none
      exists — the explicit verification that NFR-0009's centralization requirement was
      actually honored, not just stated in research.md.

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational)**: strictly sequential; Phase 2 blocks everything else.
- **Phase 3 (US1)**: depends only on Phase 2. Can be implemented and shipped alone as the MVP —
  capacity-safe assignment creation, no edit/cancel/candidates yet.
- **Phase 4 (US2)**: depends on Phase 2 and Phase 3 (edits/cancels operate on assignments that
  must already be creatable).
- **Phase 5 (US3)**: depends on Phase 2 only for `date-utils.ts`, but `getCurrentUtilization`
  (T032) and the candidates endpoint are independent of Phases 3/4's edit/cancel logic — US3 may
  be implemented in parallel with Phase 4 by a different person once Phase 3's
  `assignment.repository.ts` (T014) exists.
- **Phase 6 (Discharge)**: depends on Phase 2 (schema) and T014 (repository query surface), but
  not on Phases 4/5 — may run in parallel with them.
- **Phase 7 (Polish)**: depends on all of Phases 3–6 being complete.

## Parallel Execution Examples

- Within Phase 2: T005/T006 (date-utils + its tests), T007, T008 are `[P]` once T002–T004 land.
- Within Phase 3: T009–T013 are `[P]` — independent test files/cases, all written before T014.
- Within Phase 4: T019–T023 are `[P]`.
- Within Phase 5: T028–T031 are `[P]`.
- Within Phase 6: T036–T045 are almost entirely `[P]` — each touches a different file or a
  distinct, non-overlapping section of a shared file (e.g., T039 and T040 both touch
  `project.repository.ts` but different methods; sequence those two if working solo, parallelize
  only across people).
- Phase 5 (US3) and Phase 4 (US2) may be worked in parallel by different people once Phase 3 is
  complete, since neither's implementation code depends on the other's.
- Phase 6 (Discharge) may be worked in parallel with Phase 4 and/or Phase 5 by a third person,
  once T014 (assignment repository) exists.

## Implementation Strategy

**MVP first**: Complete Phase 1 → Phase 2 → Phase 3 (User Story 1) and stop there for the
smallest deployable increment — capacity-safe assignment creation, the platform's core
guarantee, with no edit/cancel/candidates/discharge yet.

**Incremental delivery**: Add Phase 4 (edit/cancel) next for full assignment lifecycle
management, then Phase 5 (candidates) and Phase 6 (discharge) — these two may be done in either
order or in parallel, since neither depends on the other. Phase 6 in particular should not be
deferred past the epic's completion: it is what makes FR-0003/FR-0011/FR-0012's protections
real rather than structurally-present-but-inert, and both prior epics' documentation remains
inconsistent (flagged-but-unresolved) until it lands.
