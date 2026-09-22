---

description: "Task list for EPIC-0005: Employee Self-Service"
---

# Tasks: Employee Self-Service (EPIC-0005)

**Input**: Design documents from `/specs/005-employee-self-service/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/self-service.md, quickstart.md

**Tests**: Included per plan.md — unit tests for the new service method, integration tests against real SQLite, and a contract-test addition.

**Organization**: This epic has a single user story (US1); there is no Setup or Foundational phase since it extends the existing EPIC-0001–0004 codebase with zero new infrastructure, zero new dependencies, and zero schema changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 — this epic has only one)

## Phase 1: User Story 1 - See my own assignments and utilization (Priority: P1)

**Goal**: `GET /employees/{employeeId}/my-assignments` returns the requesting employee's full assignment history and current utilization %, 404s on a nonexistent employee, and never leaks another employee's data (FR-0024).

**Independent Test**: Seed an employee with past/current/future assignments, call the endpoint, and confirm the response shape, values, 404 behavior, and cross-employee isolation — all per quickstart.md's four scenarios.

### Tests for User Story 1

- [X] T001 [P] [US1] Unit test `self-service.service.ts`'s `getMyAssignments` happy path (employee with past/current/future assignments — asserts returned `currentUtilizationPercent` matches `AssignmentService.getCurrentUtilization`'s own return value for the same fixture, and `assignments` matches `AssignmentService.listEmployeeAssignments`'s own return value) in `tests/unit/self-service.service.test.ts`, using `FakeEmployeeRepository`/`FakeAssignmentRepository` from `tests/helpers/fakes.ts`
- [X] T002 [P] [US1] Unit test `self-service.service.ts`'s `getMyAssignments` not-found path (nonexistent `employeeId` → rejects with `EmployeeNotFoundError`) in `tests/unit/self-service.service.test.ts`
- [X] T003 [P] [US1] Integration test: full-history shape for a staffed employee (past + current + future assignments all present, `currentUtilizationPercent` correct) via `GET /employees/{employeeId}/my-assignments` against real SQLite in `tests/integration/self-service.api.test.ts`, following the `beforeAll`/`afterAll` + `createTestDb` pattern already used in `tests/integration/bench.api.test.ts`
- [X] T004 [P] [US1] Integration test: never-staffed employee returns `200` with `assignments: []` and `currentUtilizationPercent: 0` in `tests/integration/self-service.api.test.ts`
- [X] T005 [P] [US1] Integration test: nonexistent `employeeId` returns `404` with `{ error_code: "NOT_FOUND", message }` in `tests/integration/self-service.api.test.ts`
- [X] T006 [P] [US1] Integration test: no cross-employee leakage — seed two employees each with their own assignments, request Employee A's view, assert no trace of Employee B's `projectName`/`roleName`/`capacityPercent`/assignment data anywhere in the response in `tests/integration/self-service.api.test.ts`
- [X] T007 [US1] Add contract-test assertions for `GET /employees/{employeeId}/my-assignments` (200 response matches `MyAssignmentsResponse`, 404 response matches the shared `NotFoundError` schema) in `tests/contract/openapi-conformance.test.ts`, following the existing pattern used for `/bench` and `/reports/*` in that file

### Implementation for User Story 1

- [X] T008 [US1] Implement `src/domain/self-service.service.ts`: a `SelfServiceService` class taking `EmployeeRepository` and `AssignmentService` as constructor dependencies, exposing `getMyAssignments(employeeId: string): Promise<MyAssignmentsData>` that (a) calls `EmployeeRepository.findById`, throwing the existing `EmployeeNotFoundError` if it returns `undefined`; (b) calls `AssignmentService.listEmployeeAssignments(employeeId)` for the full, unfiltered assignment history; (c) calls `AssignmentService.getCurrentUtilization(employeeId)` for the shared utilization figure; (d) returns `{ employeeId, name, currentUtilizationPercent, assignments }` matching `MyAssignmentsResponse` exactly — no new repository or service methods, no new date logic (per research.md's decision)
- [X] T009 [US1] Wire `GET /:employeeId/my-assignments` into `src/api/routes/employees.routes.ts`: add the route accepting a `SelfServiceService` instance (passed in alongside the existing `EmployeeService`/`AssignmentService` constructor parameters), calling `selfServiceService.getMyAssignments(req.params.employeeId)` and returning `res.status(200).json(data)` — the route performs no composition or error construction itself, matching every other route in this codebase (research.md)
- [X] T010 [US1] Instantiate `SelfServiceService` and pass it into `createEmployeesRouter` at the application wiring point (`src/api/app.ts`), matching how `EmployeeService`/`AssignmentService` are already constructed and passed in

**Checkpoint**: All of User Story 1's tests pass; the endpoint is fully functional end-to-end.

---

## Phase 2: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, matching the polish-phase pattern used in EPIC-0004's `tasks.md`

- [X] T011 [P] Run `npm run lint` and `npm run format:check` (or equivalent project scripts) across all new/modified files and fix any violations
- [X] T012 [P] Run `npm test -- --coverage` and confirm `self-service.service.ts` has unit test coverage consistent with NFR-0001's intent (both branches — found and not-found — are exercised; per research.md, the >70% figure is not a meaningfully chaseable target on a two-branch method, but both branches must be covered)
- [X] T013 Grep `src/domain/self-service.service.ts` and `src/api/routes/employees.routes.ts`'s new route handler for any inline date logic or independently-computed utilization math, confirming both are absent and all date/utilization work is delegated to `AssignmentService` (per research.md's "no new date logic, no new utilization computation" decision)
- [X] T014 Run `npm run build` (TypeScript compilation) and confirm it succeeds with no new errors
- [X] T015 Update `specs/005-employee-self-service/spec.md`'s Status field from `Draft` to `Implemented` once all tasks above are complete and all tests pass

## Dependencies & Execution Order

- Phase 1 (US1) has no dependency on any other phase — this epic has only one user story.
- Within Phase 1: T001–T007 (tests) should be written before T008–T010 (implementation), per constitution Principle III (test-first, NON-NEGOTIABLE for Domain Logic changes). T001–T007 are mutually parallel ([P]) since each touches only its own test file's new content. T008 must complete before T009 (the route depends on the service existing); T009 must complete before T010 (wiring depends on the route existing). T003–T006 all extend the same new integration test file, so while conceptually parallel, coordinate to avoid file-write conflicts (write all four scenarios in one pass, or serialize).
- Phase 2 (Polish) depends on all of Phase 1 being complete.

## Parallel Execution Example

```text
# Launch T001–T002 (unit tests) and T007 (contract test) together — distinct files, no shared state:
Task: "Unit test getMyAssignments happy path in tests/unit/self-service.service.test.ts"
Task: "Unit test getMyAssignments not-found path in tests/unit/self-service.service.test.ts"
Task: "Add contract-test assertions in tests/contract/openapi-conformance.test.ts"

# T003–T006 all extend tests/integration/self-service.api.test.ts — write together in one file, not truly parallel processes, but independently specifiable
```

## Implementation Strategy

**MVP = the entire epic.** With a single P1 user story and no Setup/Foundational phase, there is no meaningful smaller slice — implement T001–T010, verify the Phase 1 checkpoint, then complete Polish (T011–T015).
