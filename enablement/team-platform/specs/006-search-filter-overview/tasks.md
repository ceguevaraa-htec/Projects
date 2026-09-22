---

description: "Task list for EPIC-0006: Search, Filter & Employee Overview — Backend Gap Closure"
---

# Tasks: Search, Filter & Employee Overview — Backend Gap Closure (EPIC-0006)

**Input**: Design documents from `/specs/006-search-filter-overview/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/employees-list.md, quickstart.md

**Tests**: Included — integration tests for all new/fixed capabilities, plus a test-only backfill for FR-0025/FR-0026's existing parameters (no production code change on the FR-0026/projects side).

**Organization**: Four user stories. US1 (`minAvailability`) and US2 (`sort=utilization`) share one structural prerequisite — `EmployeeService` gaining an `AssignmentService` dependency and returning utilization-annotated records (research.md's "one computation pass serves both" decision) — so that shared change lives in Phase 2 (Foundational) rather than being duplicated into both stories. US3 (`currentProjectNames`) and US4 (test backfill) are independent of that foundational change and of each other.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (`minAvailability`), US2 (`sort=utilization`), US3 (`currentProjectNames`), US4 (test backfill, SC-004)

## Phase 1: Setup

No new dependencies, no new infrastructure — this phase is empty for this epic (extends the existing codebase in place).

---

## Phase 2: Foundational (blocks US1 and US2)

**Purpose**: The one shared prerequisite both `minAvailability` and `sort=utilization` need — `EmployeeService.listEmployees` must return utilization-annotated records before either capability can filter or sort by that value. Building this once here (rather than inside US1 or US2 individually) is what research.md's "one computation pass serves both" decision requires — duplicating it into both stories would mean two independent implementations of the same annotation logic.

**⚠️ CRITICAL**: US1 and US2 cannot be implemented until this phase is complete. US3 and US4 do not depend on this phase.

- [X] T001 Add `AssignmentService` as a new constructor dependency to `EmployeeService` in `src/domain/employee.service.ts`
- [X] T002 Change `EmployeeService.listEmployees(filters: EmployeeListFilters)`'s return type to `Promise<Array<EmployeeRecord & { currentUtilizationPercent: number }>>` in `src/domain/employee.service.ts`: after fetching the SQL-filtered result set from `EmployeeRepository.findAll` (skill/proficiency/seniority filters unchanged), compute `currentUtilizationPercent` for every returned employee via `Promise.all` over `AssignmentService.getCurrentUtilization` calls — one call per employee, computed once, to be reused by both US1's filter and US2's sort (no filtering or sorting logic yet — that's added in US1/US2 below)
- [X] T003 Update `src/api/app.ts` to pass `assignmentService` into the existing `EmployeeService` constructor call
- [X] T004 Update `employees.routes.ts`'s `GET /` handler in `src/api/routes/employees.routes.ts`: remove its existing separate `assignmentService.getCurrentUtilization` call for the list endpoint (previously made per-employee after `service.listEmployees`), and instead read `currentUtilizationPercent` directly from the records `service.listEmployees` now returns

**Checkpoint**: `EmployeeService.listEmployees` returns utilization-annotated records; the route compiles and passes existing tests using the annotated value instead of its own separate computation. No filtering/sorting behavior has changed yet — existing tests must still pass unmodified.

---

## Phase 3: User Story 1 - Filter by available capacity (`minAvailability`) (Priority: P1)

**Goal**: `GET /employees?minAvailability=N` returns only employees with at least `N`% available capacity; invalid values are rejected with `400 VALIDATION_ERROR`.

**Independent Test**: Per quickstart.md scenario 1 — employees at varying utilization, boundary values (0, exact match, 100), and the three invalid-input cases.

### Tests for User Story 1

- [X] T005 [P] [US1] Integration test: `GET /employees?minAvailability=N` returns only employees whose available capacity (`100 - currentUtilizationPercent`) is `>= N`, using employees at 60% and 90% utilization per quickstart.md scenario 1, in `tests/integration/employees.api.test.ts`
- [X] T006 [P] [US1] Integration test: `minAvailability=0` includes every employee, including a fully-booked (100% utilized) one, in `tests/integration/employees.api.test.ts`
- [X] T007 [P] [US1] Integration test: `minAvailability=100` includes only employees with zero current assignments, in `tests/integration/employees.api.test.ts`
- [X] T008 [P] [US1] Integration test: `minAvailability` combined with an existing filter (e.g., `skill`) applies both together, in `tests/integration/employees.api.test.ts`
- [X] T009 [P] [US1] Integration test: `minAvailability=-5`, `minAvailability=abc`, and `minAvailability=150` each return `400` with `error_code: "VALIDATION_ERROR"`, in `tests/integration/employees.api.test.ts` (per research.md's revised validation decision — three distinct invalid-input cases, not one representative case)
- [X] T010 [US1] Add contract-test assertions in `tests/contract/openapi-conformance.test.ts` confirming `minAvailability` filtering conforms to the `EmployeeSummary`/`GET /employees` shape and that an invalid value returns the `ErrorResponse` shape with `VALIDATION_ERROR`

### Implementation for User Story 1

- [X] T011 [US1] Add `minAvailability` to `EmployeeListFilters` in `src/domain/types.ts` as an optional `number`
- [X] T012 [US1] In `employees.routes.ts`'s `GET /` handler (`src/api/routes/employees.routes.ts`), parse `req.query.minAvailability`: if present, validate it is an integer between 0 and 100 inclusive (reject non-numeric, non-integer, negative, or >100 by throwing the existing `ValidationError` with message `"minAvailability must be an integer between 0 and 100."`, matching `capacityPercent`'s existing validation style in `assignment.service.ts`); if absent, pass `undefined`
- [X] T013 [US1] In `EmployeeService.listEmployees` (`src/domain/employee.service.ts`), after computing `currentUtilizationPercent` for every employee (T002), filter to `100 - currentUtilizationPercent >= filters.minAvailability` when `filters.minAvailability` is provided

**Checkpoint**: `minAvailability` fully functional and validated end-to-end; all US1 tests pass independent of US2/US3/US4.

---

## Phase 4: User Story 2 - Sort by utilization (`sort=utilization`) (Priority: P1)

**Goal**: `GET /employees?sort=utilization&order=asc|desc` returns employees ordered by current utilization %.

**Independent Test**: Per quickstart.md scenario 2 — three employees at distinct utilization levels, both sort orders.

### Tests for User Story 2

- [X] T014 [P] [US2] Integration test: `GET /employees?sort=utilization&order=asc` returns employees in ascending utilization order (20%, 50%, 80% fixture per quickstart.md scenario 2), in `tests/integration/employees.api.test.ts`
- [X] T015 [P] [US2] Integration test: `GET /employees?sort=utilization&order=desc` returns the same fixture in descending order, in `tests/integration/employees.api.test.ts`
- [X] T016 [US2] Add contract-test assertions in `tests/contract/openapi-conformance.test.ts` confirming `sort=utilization` is accepted and produces correctly ordered `EmployeeSummary` results

### Implementation for User Story 2

- [X] T017 [US2] Widen `EmployeeListFilters.sort`'s type from `"name" | "employmentStartDate"` to `"name" | "employmentStartDate" | "utilization"` in `src/domain/types.ts`
- [X] T018 [US2] In `EmployeeService.listEmployees` (`src/domain/employee.service.ts`), after filtering (T013), when `filters.sort === "utilization"`, sort the utilization-annotated result set in-memory by `currentUtilizationPercent` (respecting `filters.order`, default `"asc"`) using the same computed values from T002 — no second `getCurrentUtilization` pass; for any other `sort` value, leave the repository's existing SQL-level ordering (from `employee.repository.ts`, unchanged) as the result order

**Checkpoint**: `sort=utilization` fully functional in both directions; composes correctly with `minAvailability` (T013) without a duplicate utilization computation. All US2 tests pass independent of US1/US3/US4 (though both exercise the same Phase 2 foundation).

---

## Phase 5: User Story 3 - Real `currentProjectNames` (Priority: P1)

**Goal**: `GET /employees`'s `currentProjectNames` reflects each employee's real, de-duplicated current project names instead of a hardcoded `[]`.

**Independent Test**: Per quickstart.md scenario 3 — one current assignment, then two concurrent current assignments to different projects, then a duplicate-project case.

### Tests for User Story 3

- [X] T019 [P] [US3] Integration test: an employee with one current assignment to "Platform Revamp" has `currentProjectNames: ["Platform Revamp"]` in the list response, in `tests/integration/employees.api.test.ts`
- [X] T020 [P] [US3] Integration test: an employee with two concurrent current assignments to different projects has both project names in `currentProjectNames`, in `tests/integration/employees.api.test.ts`
- [X] T021 [P] [US3] Integration test: an employee with two current assignments to the *same* project (e.g., two different roles) has that project name appear exactly once in `currentProjectNames` (no duplicates), in `tests/integration/employees.api.test.ts`
- [X] T022 [P] [US3] Integration test: an employee with only past or only future assignments (no current ones) has `currentProjectNames: []`, in `tests/integration/employees.api.test.ts`
- [X] T023 [US3] Add contract-test assertions in `tests/contract/openapi-conformance.test.ts` confirming `GET /employees`'s `currentProjectNames` field contains real values, not always `[]`

### Implementation for User Story 3

- [X] T024 [US3] In `employees.routes.ts`'s `GET /` handler (`src/api/routes/employees.routes.ts`), for each employee, call the existing `assignmentService.listEmployeeAssignments(employee.employeeId)`, filter to `temporalStatus === "current"`, map to `projectName`, and de-duplicate (e.g., via `Set`) to produce `currentProjectNames` — replacing the hardcoded `[] as string[]` (accepted N+1 query pattern at demo scale, per research.md's explicit trade-off statement)

**Checkpoint**: `currentProjectNames` reflects real data end-to-end; independent of US1/US2/US4.

---

## Phase 6: User Story 4 - Test coverage backfill for FR-0025/FR-0026's existing parameters (SC-004)

**Goal**: Close the audit's "implemented but untested" finding for `GET /employees`'s `skill`/`proficiency`/`seniority`/`name`/`employmentStartDate` parameters and `GET /projects`'s `status`/`requiredRole`/`startDateFrom`/`startDateTo`/`name`/`startDate`/`endDate` parameters — zero production code changes, test-only.

**Independent Test**: Per quickstart.md scenario 4 — each parameter exercised against real SQLite with a fixture that would fail if the filter/sort were silently broken.

### Tests for User Story 4

- [X] T025 [P] [US4] Integration test: `GET /employees?skill=X` returns only employees with that skill, in `tests/integration/employees.api.test.ts`
- [X] T026 [P] [US4] Integration test: `GET /employees?proficiency=Y` (combined with a skill) returns only employees whose matching skill has that proficiency, in `tests/integration/employees.api.test.ts`
- [X] T027 [P] [US4] Integration test: `GET /employees?seniority=Z` returns only employees at that seniority level, in `tests/integration/employees.api.test.ts`
- [X] T028 [P] [US4] Integration test: `GET /employees?sort=name&order=asc|desc` and `?sort=employmentStartDate&order=asc|desc` return correctly ordered results, in `tests/integration/employees.api.test.ts`
- [X] T029 [P] [US4] Integration test: `GET /projects?status=X` returns only projects with that status, in `tests/integration/projects.api.test.ts`
- [X] T030 [P] [US4] Integration test: `GET /projects?requiredRole=X` returns only projects with a required role matching that name, in `tests/integration/projects.api.test.ts`
- [X] T031 [P] [US4] Integration test: `GET /projects?startDateFrom=X&startDateTo=Y` returns only projects whose start date falls within that range, in `tests/integration/projects.api.test.ts`
- [X] T032 [P] [US4] Integration test: `GET /projects?sort=name|startDate|endDate&order=asc|desc` returns correctly ordered results for each sort mode, in `tests/integration/projects.api.test.ts`

**Checkpoint**: All previously-untested FR-0025/FR-0026 parameters now have integration test coverage; no production code in `projects.routes.ts` or `project.repository.ts` was touched.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 [P] Run `npm run lint` and `npx prettier --check .` across all new/modified files and fix any violations
- [X] T034 [P] Run `npm test -- --coverage` and confirm `EmployeeService`'s new filter/sort logic (T002, T013, T018) is exercised by the integration tests above (Domain Logic filter/sort branches, not just the route wiring)
- [X] T035 Grep `src/domain/employee.service.ts` for any duplicate `getCurrentUtilization` call sites (confirming T002's single computation pass is reused by both T013's filter and T018's sort, per research.md, not duplicated)
- [X] T036 Run `npm run build` (TypeScript compilation) and confirm it succeeds with no new errors
- [X] T037 Run the full `npm test` suite and confirm all pre-existing tests (EPIC-0001–0005) still pass unmodified — Phase 2's route/service changes must not alter any other endpoint's behavior
- [X] T038 Update `specs/006-search-filter-overview/spec.md`'s Status field from `Draft` to `Implemented` once all tasks above are complete and all tests pass

## Dependencies & Execution Order

- Phase 1 (Setup) is empty.
- Phase 2 (Foundational) blocks Phase 3 (US1) and Phase 4 (US2) — both need `EmployeeService.listEmployees`'s new utilization-annotated return shape. Phase 2 does NOT block Phase 5 (US3) or Phase 6 (US4) — both are independent of the `EmployeeService` change.
- Within Phase 3 (US1): T005–T010 (tests) before T011–T013 (implementation), per constitution Principle III. T011 (type) before T012 (route parsing) before T013 (service filtering, which also depends on T002 from Phase 2).
- Within Phase 4 (US2): T014–T016 (tests) before T017–T018 (implementation). T017 (type) before T018 (service sorting, which depends on T002 and, for correct composition, should land after T013 so the filter-then-sort order in `listEmployees` is deliberate rather than order-dependent by accident).
- Within Phase 5 (US3): T019–T023 (tests) before T024 (implementation). Fully independent of Phases 2–4.
- Within Phase 6 (US4): all tasks (T025–T032) are test-only and mutually independent; can run entirely in parallel with Phases 2–5 since they touch no production code this epic changes.
- Phase 7 (Polish) depends on all of Phases 2–6 being complete.

## Parallel Execution Example

```text
# Phase 6 (US4) can start immediately, in parallel with Phase 2's foundational work, since it touches no shared files:
Task: "Integration test GET /employees?skill=X in tests/integration/employees.api.test.ts"
Task: "Integration test GET /projects?status=X in tests/integration/projects.api.test.ts"

# Within Phase 3, US1's test tasks are mutually parallel (same file, independent test cases):
Task: "Integration test minAvailability boundary/combination cases"
Task: "Integration test minAvailability invalid-input rejection cases"
```

## Implementation Strategy

**MVP = Phase 2 + Phase 3 (US1) alone** is a valid, independently shippable increment (`minAvailability` working end-to-end). Phase 4 (US2) adds the second FR-0025 gap on the same foundation. Phase 5 (US3) and Phase 6 (US4) are independent of both and of each other, and can be delivered in any order relative to Phases 3–4. Recommended delivery order given dependencies: Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7, but Phase 5/6 could equally run first or interleaved since nothing structurally requires the order shown.
