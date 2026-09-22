---
description: "Task list for EPIC-0002: Project Management"
---

# Tasks: Project Management (EPIC-0002)

**Input**: Design documents from `/specs/002-project-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/project-management.md, quickstart.md — all present. EPIC-0001 already implemented and passing.

**Tests**: Included and NOT optional. Constitution Principle III (Test-First Development) is
NON-NEGOTIABLE for Domain Logic — unchanged from EPIC-0001's precedent.

**Organization**: Tasks are grouped by user story (US1/US2, matching spec.md's priorities
P1/P2). This epic **extends** EPIC-0001's existing `src/` tree in place — new files land in the
same `src/repositories/`, `src/domain/`, `src/api/routes/` directories; `skill.repository.ts`
and `skill.service.ts` are modified, not duplicated.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependency)
- **[Story]**: US1 or US2 — omitted for Setup/Foundational/Polish tasks
- File paths match `plan.md`'s Project Structure exactly

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new dependencies or scaffolding are needed — EPIC-0001 already installed the
full stack and created the directory tree. This phase only confirms that baseline still holds.

- [X] T001 Confirm EPIC-0001's existing test suite still passes (`npm test`) before starting
      any EPIC-0002 changes, establishing a clean baseline.

**Checkpoint**: Baseline confirmed; no scaffolding changes needed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and error-hierarchy extensions every user story depends on. No user story
task may begin before this phase is complete.

**⚠️ CRITICAL**: This phase blocks all of Phase 3 and 4.

- [X] T002 Extend `src/db/schema.ts`'s `Database` interface with `ProjectTable`,
      `ProjectRoleTable`, and `ProjectRoleSkillTable` (the `project_role_skills` join table),
      field-matched to data-model.md. Add a `ProjectStatus` type alongside the existing
      `Seniority`/`Proficiency` types.
- [X] T003 Write migration `0002_project_management` in
      `src/db/migrations/0002_project_management.ts` creating `projects`, `project_roles`, and
      `project_role_skills` per data-model.md (composite/foreign keys: `project_role_skills`
      references both `project_roles.id` and the existing `skills.id` from migration 0001, both
      `ON DELETE CASCADE`).
- [X] T004 Register migration `0002_project_management` in
      `src/db/migrations/index.ts`'s migration registry, alongside the existing `0001` entry.
- [X] T005 [P] Extend the typed exception hierarchy in `src/domain/errors/domain-errors.ts`:
      add `ProjectNotFoundError`, `ProjectRoleNotFoundError`, `ProjectHasAssignmentsError`,
      `ProjectRoleHasAssignmentsError`, `InvalidStatusTransitionError`,
      `ProjectNotEditableError` — per research.md's error-handling decisions and the error codes
      enumerated in `contracts/project-management.md`. Reuse the existing `SkillNotFoundError`
      and `ValidationError` as-is; do not create parallel versions.
- [X] T006 [P] Extend `tests/helpers/fakes.ts` with `FakeProjectRepository` (in-memory test
      double implementing the `ProjectRepository` interface defined in T012), mirroring
      `FakeEmployeeRepository`'s pattern, including a settable `assignmentsByProjectId` /
      `assignmentsByRoleId` set so the "blocked" branches are unit-testable per research.md.

**Checkpoint**: Schema, error contract, and test doubles exist. User story implementation can
now begin.

---

## Phase 3: User Story 1 - Maintain the project roster with a status lifecycle (Priority: P1) 🎯 MVP

**Goal**: A Manager can create, edit, and delete projects, moving each through the status
lifecycle Draft→Active→{Completed,Cancelled}/Draft→Cancelled, with deletion blocked whenever
the project has any assignment (FR-0009, FR-0012).

**Independent Test**: Create a project in Draft, transition it through the allowed status
graph, edit its dates, delete a project with no assignments (succeeds), and attempt to delete
one with a simulated assignment record (blocked) — all verifiable without any required-role
data present.

### Tests for User Story 1 (write first — MUST fail before implementation exists)

- [X] T007 [P] [US1] Unit test in `tests/unit/project.service.test.ts` for create/edit
      validation (required fields on create per FR-0009; `startDate` not after `endDate`), and
      for `getProject`/`updateProject`/`deleteProject` called with a nonexistent `projectId`
      (all three throw `ProjectNotFoundError`).
- [X] T008 [P] [US1] Unit test in `tests/unit/project.service.test.ts` for the status-transition
      graph: every valid transition (Draft→Active, Draft→Cancelled, Active→Completed,
      Active→Cancelled) succeeds; every invalid transition (e.g., Completed→Active,
      Cancelled→Draft, Draft→Completed) throws `InvalidStatusTransitionError`.
- [X] T009 [P] [US1] Unit test in `tests/unit/project.service.test.ts` for delete-eligibility:
      allowed when zero assignments exist, blocked (`ProjectHasAssignmentsError`) when a
      future-only assignment exists — per spec.md's edge case mirroring FR-0003's employee rule.
- [X] T010 [P] [US1] Integration test in `tests/integration/projects.api.test.ts` covering the
      full `POST /projects` → `PATCH /projects/{projectId}` (status transitions) →
      `DELETE /projects/{projectId}` cycle against a real, freshly-created temp-file SQLite
      database, torn down after the test file completes (NFR-0002); include
      `GET/PATCH/DELETE /projects/{projectId}` with a nonexistent ID and confirm a `404
      ProjectNotFoundError` response for each, and an invalid status transition confirming `409
      INVALID_STATUS_TRANSITION`.
- [X] T011 [P] [US1] Contract test in `tests/contract/openapi-conformance.test.ts` asserting
      `POST /projects`, `GET /projects`, `GET /projects/{projectId}`,
      `PATCH /projects/{projectId}`, and `DELETE /projects/{projectId}` match the
      `Project`/`ProjectSummary`/`ProjectCreateRequest`/`ProjectUpdateRequest` schemas in
      `specs/contracts/openapi-spec.yaml` exactly (status codes and payload shape).

### Implementation for User Story 1

- [X] T012 [US1] Implement `src/repositories/project.repository.ts`: Kysely queries only —
      `insert`, `update`, `findById` (embedding required roles per the `Project` schema's
      `requiredRoles` array), `findAll` (with filter/sort params per the OpenAPI `GET /projects`
      query parameters), `delete`, and `hasAnyAssignments(projectId)` (mirrors EPIC-0001's
      `Employee.hasAnyAssignments` stub exactly — hardcoded to `false` until EPIC-0003, per
      data-model.md's flagged cross-epic follow-up).
- [X] T013 [US1] Implement `src/domain/project.service.ts`: `createProject`, `getProject`,
      `listProjects`, `updateProject` (validating the status-transition graph before persisting
      any status change, throwing `InvalidStatusTransitionError` on an invalid one), and
      `deleteProject` (calling `hasAnyAssignments` and throwing `ProjectHasAssignmentsError` per
      FR-0012 before calling the repository's delete). `getProject`, `updateProject`, and
      `deleteProject` MUST each throw `ProjectNotFoundError` when the repository's `findById`
      returns nothing, before attempting any further operation.
- [X] T014 [US1] Implement `src/api/routes/projects.routes.ts` (project-level routes only in
      this task; role routes added in US2): Express routes for `POST /projects`,
      `GET /projects`, `GET /projects/{projectId}`, `PATCH /projects/{projectId}`,
      `DELETE /projects/{projectId}`, matching `specs/contracts/openapi-spec.yaml` shapes
      exactly; wires to `project.service.ts` only — no business logic in the route handler
      itself.
- [X] T015 [US1] Register the projects router in `src/api/app.ts` (construct
      `ProjectRepository`/`ProjectService` alongside the existing employee/skill wiring).
- [X] T016 [US1] Run T007–T011 and confirm all pass; confirm Domain Logic coverage for
      `project.service.ts` exceeds 70% (NFR-0001).

**Checkpoint**: User Story 1 is independently complete, testable, and deployable — the project
roster with its status lifecycle is fully functional on its own.

---

## Phase 4: User Story 2 - Define and manage a project's required roles (Priority: P2)

**Goal**: A Manager can add, edit, and remove a project's required roles (name, capacity %,
required skills), with removal blocked when assignments reference the role, and all role
management blocked once the project is Completed or Cancelled (FR-0010, FR-0011).

**Independent Test**: Add a required role (with capacity % and optional required skills from
the existing EPIC-0001 catalog) to a project, edit its capacity %, and remove it — verifiable
via the project's own required-roles list, without any assignment data present.

### Tests for User Story 2 (write first — MUST fail before implementation exists)

- [X] T017 [P] [US2] Unit test in `tests/unit/project.service.test.ts` for: successful role
      creation with valid `capacityPercent` (1–100) and required skills; rejection of
      `capacityPercent: 0` or `>100` (`ValidationError`); rejection of a nonexistent
      `requiredSkillIds` entry (`SkillNotFoundError`, reusing EPIC-0001's error — verified via a
      fake `SkillRepository` returning `undefined`); `addProjectRole`/`updateProjectRole`/
      `removeProjectRole` called with a nonexistent `roleId` (`ProjectRoleNotFoundError`).
- [X] T018 [P] [US2] Unit test in `tests/unit/project.service.test.ts` for role
      removal-eligibility: allowed when zero assignments reference the role, blocked
      (`ProjectRoleHasAssignmentsError`) when a future-only assignment exists.
- [X] T019 [P] [US2] Unit test in `tests/unit/project.service.test.ts` for the
      Draft/Active-only role-management restriction: role add/edit/remove succeeds while the
      parent project's status is Draft or Active, and throws `ProjectNotEditableError` when the
      parent project's status is Completed or Cancelled — per data-model.md's resolved gap.
- [X] T020 [P] [US2] Integration test in `tests/integration/projects.api.test.ts` covering
      `POST /projects/{projectId}/roles` → `PATCH .../roles/{roleId}` →
      `DELETE .../roles/{roleId}` against a real SQLite database, including the
      invalid-capacity, nonexistent-skill, not-found-role, and role-has-assignments edge cases,
      plus the Completed/Cancelled `PROJECT_NOT_EDITABLE` case, with cleanup (NFR-0002).
- [X] T021 [P] [US2] Contract test in `tests/contract/openapi-conformance.test.ts` asserting
      `POST/PATCH/DELETE /projects/{projectId}/roles[/{roleId}]` match the
      `ProjectRole`/`ProjectRoleCreateRequest`/`ProjectRoleUpdateRequest` schemas in
      `openapi-spec.yaml` exactly, and additionally asserting that a role add/edit/remove
      attempt against a Completed or Cancelled project returns `409` with the `ErrorResponse`
      shape and `error_code: PROJECT_NOT_EDITABLE` (SC-005).
- [X] T022 [P] [US2] Extend `tests/unit/skill.service.test.ts` (EPIC-0001) with a case
      confirming `getDeletionImpact` returns a real `affectedProjectRoleCount` once a
      `project_role_skills` association exists, replacing the previous "always 0" assumption —
      discharges EPIC-0001's tracked T043 follow-up at the test level.
- [X] T023 [P] [US2] Extend `tests/integration/skills.api.test.ts` (EPIC-0001) with a case
      creating a project role that requires a skill, then confirming
      `GET /skills/{skillId}/deletion-impact` reflects `affectedProjectRoleCount: 1` against a
      real database — discharges EPIC-0001's T043 follow-up at the integration level.

### Implementation for User Story 2

- [X] T024 [US2] Extend `src/repositories/project.repository.ts` with Kysely queries:
      `insertRole`, `updateRole`, `deleteRole` (cascading `project_role_skills` deletion via a
      transaction), `findRoleById`, `findRolesForProject`, and
      `roleHasAnyAssignments(roleId)` (mirrors `hasAnyAssignments` — hardcoded to `false` until
      EPIC-0003, per data-model.md's flagged cross-epic follow-up).
- [X] T025 [US2] Implement `src/domain/project.service.ts`'s `addProjectRole`,
      `updateProjectRole`, and `removeProjectRole`: each first loads the parent project and
      throws `ProjectNotFoundError` if missing, then throws `ProjectNotEditableError` if the
      project's status is Completed or Cancelled (T019's rule), then validates
      `capacityPercent` (`ValidationError` if ≤0 or >100) and each `requiredSkillIds` entry via
      the existing `SkillRepository.findById` (reused as-is, throwing the existing
      `SkillNotFoundError` — no new skill-lookup logic). `updateProjectRole`/`removeProjectRole`
      additionally throw `ProjectRoleNotFoundError` if the role doesn't exist, and
      `removeProjectRole` calls `roleHasAnyAssignments`, throwing
      `ProjectRoleHasAssignmentsError` per FR-0011 before calling the repository's delete.
- [X] T026 [US2] Extend `src/api/routes/projects.routes.ts` with Express routes for
      `POST /projects/{projectId}/roles`, `PATCH /projects/{projectId}/roles/{roleId}`,
      `DELETE /projects/{projectId}/roles/{roleId}`, matching the OpenAPI shapes exactly.
- [X] T027 [US2] **Discharge EPIC-0001's T043 follow-up**: change
      `src/repositories/skill.repository.ts`'s `countProjectRoleAssociations(skillId)` from its
      hardcoded `0` to `SELECT COUNT(*) FROM project_role_skills WHERE skill_id = ?` via Kysely,
      now that `project_role_skills` exists (T003). Remove the "interim EPIC-0001-only stub"
      JSDoc comment on this method (it is no longer a stub) and update the corresponding
      cross-epic-follow-up note in `specs/001-employee-management/data-model.md` and
      `specs/001-employee-management/tasks.md` T043 to mark them resolved, referencing this
      task and epic.
- [X] T028 [US2] Run T017–T023 and confirm all pass; confirm Domain Logic coverage for
      `project.service.ts` exceeds 70% (NFR-0001), and that EPIC-0001's `skill.service.ts`
      coverage has not regressed.

**Checkpoint**: User Stories 1 AND 2 both work independently and together — EPIC-0002 is
functionally complete, and EPIC-0001's T043 follow-up is discharged.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Whole-epic validation that no single user story phase covers on its own.

- [X] T029 [P] Run the full `quickstart.md` validation guide end-to-end (all three scenarios,
      including the EPIC-0001-follow-up-discharge scenario) against a freshly-migrated database
      and confirm every documented expected outcome holds.
- [X] T030 [P] Run the complete Vitest suite (both epics) with coverage and confirm overall
      Domain Logic coverage (`employee.service.ts` + `skill.service.ts` + `project.service.ts`
      combined) exceeds 70% (NFR-0001).
- [X] T031 Verify every error response produced by this epic's endpoints (manually cross-check
      against `contracts/project-management.md`'s error-code table) uses the `{ error_code,
      message }` envelope with no exceptions (NFR-0005/ADR-0009).
- [X] T032 Verify the existing structured JSON request-logging middleware (EPIC-0001, reused
      unchanged) emits a log line for every request across all endpoints added in Phases 3–4
      (NFR-0003).
- [X] T033 Record, in a comment or follow-up note visible to whoever plans EPIC-0003 (e.g., a
      `TODO` in `project.repository.ts` referencing data-model.md's flagged notes), that
      `hasAnyAssignments`/`roleHasAnyAssignments` currently hardcode `false` and must become
      real existence queries against the `assignments` table once the Assignment Engine epic's
      schema exists — grouped with EPIC-0001's identical `Employee.hasAnyAssignments` follow-up,
      since both should be resolved together as the same pattern applied to two tables.

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational)**: strictly sequential; Phase 2 blocks everything else.
- **Phase 3 (US1)**: depends only on Phase 2. Can be implemented and shipped alone as the MVP —
  a project roster with a status lifecycle, no required roles yet.
- **Phase 4 (US2)**: depends on Phase 2 structurally, and on US1's `project.service.ts`/
  `project.repository.ts` existing (roles are sub-resources of projects) — so, unlike
  EPIC-0001's US2/US3 relationship, this epic's two stories have a genuine build-order
  dependency: **US1 must be implemented before US2**, not just before US2 can be *exercised*.
- **Phase 5 (Polish)**: depends on both Phase 3 and Phase 4 being complete.

## Parallel Execution Examples

- Within Phase 2: T005, T006 are `[P]` — different files, no shared dependency once T002–T004 land.
- Within Phase 3: T007, T008, T009, T010, T011 are `[P]` — independent test files/cases, all written before T012.
- Within Phase 4: T017, T018, T019, T020, T021, T022, T023 are `[P]` — independent test files/cases.
- T027 (discharging EPIC-0001's T043) can run in parallel with T024–T026 once T003 (the
  `project_role_skills` table) exists, since it only touches `skill.repository.ts`, a file none
  of T024–T026 modify.

## Implementation Strategy

**MVP first**: Complete Phase 1 → Phase 2 → Phase 3 (User Story 1) and stop there for the
smallest deployable increment — a working project roster with a status lifecycle, no required
roles yet.

**Incremental delivery**: Add Phase 4 (User Story 2, required roles) next — unlike EPIC-0001,
there is no flexibility in build order here, since roles are structurally sub-resources of
projects. Phase 4 also discharges EPIC-0001's tracked T043 follow-up as part of the same
increment, since the underlying table (`project_role_skills`) only exists once Phase 4's schema
work lands.
