---
description: "Task list for EPIC-0004: Bench & Reporting"
---

# Tasks: Bench & Reporting (EPIC-0004)

**Input**: Design documents from `/specs/004-bench-reporting/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/bench-reporting.md, quickstart.md — all present. EPIC-0001, EPIC-0002, and EPIC-0003 already implemented and passing.

**Tests**: Included and NOT optional. Constitution Principle III (Test-First Development) is
NON-NEGOTIABLE — unchanged from prior epics' precedent.

**Organization**: Tasks are grouped by user story (US1/US2, matching spec.md's priorities
P1/P2). This epic **extends** the existing `src/` tree in place, adds **zero new database
tables**, and introduces one new top-level directory (`src/reports/`) for the PDF rendering
layer, per plan.md's justification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependency)
- **[Story]**: US1 or US2 — omitted for Setup/Foundational/Polish tasks
- File paths match `plan.md`'s Project Structure exactly

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the one new dependency this epic needs; confirm baseline.

- [X] T001 Confirm the existing test suite (all three prior epics) still passes (`npm test`)
      before starting any EPIC-0004 changes, establishing a clean baseline.
- [X] T002 Install `pdfkit` (dependency) and `@types/pdfkit` (dev dependency) — the PDF library
      pre-approved by SDP ADR-0006; confirm MIT licensing (NFR-0008) and run `npm audit` to
      confirm no vulnerabilities are introduced.

**Checkpoint**: Baseline confirmed; `pdfkit` installed and ready to use.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one small repository extension every report task depends on. No user story
task may begin before this phase is complete.

**⚠️ CRITICAL**: This phase blocks Phase 4 (User Story 2); Phase 3 (User Story 1) does not
depend on it and may proceed independently.

- [X] T003 Extend `src/repositories/assignment.repository.ts`'s `AssignmentRepository`
      interface and `KyselyAssignmentRepository` implementation with
      `findAllForProject(projectId: string): Promise<AssignmentRecord[]>` (unfiltered —
      past/current/future — per data-model.md's decision to keep the repository method
      reusable and scope the current-only filtering in `reports.service.ts` instead).
- [X] T004 [P] Extend `tests/helpers/fakes.ts`'s `FakeAssignmentRepository` with
      `findAllForProject`, mirroring the existing `findAllForEmployee` pattern (filter the
      in-memory `rows` map by `projectId` instead of `employeeId`).

**Checkpoint**: The one new repository method exists and is fake-able for unit tests. User
Story 2 (Reporting) can now begin; User Story 1 (Bench) never depended on this phase.

---

## Phase 3: User Story 1 - See who's underutilized, now and looking ahead (Priority: P1) 🎯 MVP

**Goal**: A Manager can view the bench for Now and all three forward-looking windows, with
utilization computed via the resolved day-level minimum-concurrent-capacity algorithm
(FR-0019, FR-0020).

**Independent Test**: Create employees with varying assignment loads (fully booked, partially
booked, never assigned, busy-then-free, two-non-overlapping-partials) and confirm each of the
four windows returns the correct set of employees with correct utilization values — fully
independent of Phase 2/User Story 2, since bench computation never touches reports.

### Tests for User Story 1 (write first — MUST fail before implementation exists)

- [X] T005 [P] [US1] Unit test in `tests/unit/bench.service.test.ts` for the `now` window
      (`N=0`): a fully-booked (100%) employee is excluded; a partially-booked employee appears
      with their actual current utilization; a never-assigned employee appears at 0%.
- [X] T006 [P] [US1] Unit test in `tests/unit/bench.service.test.ts` for the "busy-then-free"
      case: an employee 100%-booked for the first few days of a 30-day window but free
      afterward MUST appear on that window's bench with a low utilization (their most-available
      day), not excluded by a peak-based miscalculation.
- [X] T007 [P] [US1] Unit test in `tests/unit/bench.service.test.ts` for the
      "two-non-overlapping-partials" case: two separate 50%-capacity assignments in different,
      non-overlapping parts of a 90-day window MUST produce a low utilization (well under 100),
      not a false-positive exclusion from a whole-range-sum miscalculation.
- [X] T008 [P] [US1] Unit test in `tests/unit/bench.service.test.ts` confirming `now` is a
      true degenerate case of the same algorithm (`N=0`) — assert that calling the window
      algorithm with `N=0` produces the identical result as `AssignmentService
      .getCurrentUtilization` for the same employee/data, rather than being a separately
      maintained code path (SC-002's "no window-specific drift" requirement, made concrete).
- [X] T009 [P] [US1] Integration test in `tests/integration/bench.api.test.ts` covering
      `GET /bench?window=now|30d|60d|90d` end-to-end against a real, freshly-created temp-file
      SQLite database, including the busy-then-free and two-non-overlapping-partials cases from
      quickstart.md, and a missing/invalid `window` parameter returning `400
      VALIDATION_ERROR`, with cleanup (NFR-0002).
- [X] T010 [P] [US1] Contract test in `tests/contract/openapi-conformance.test.ts` asserting
      `GET /bench` matches the `BenchEntry` array schema in `specs/contracts/openapi-spec.yaml`
      exactly (status code and payload shape).

### Implementation for User Story 1

- [X] T011 [US1] Implement `src/domain/bench.service.ts`: a single `getBenchView(window: "now"
      | "30d" | "60d" | "90d"): Promise<BenchEntry[]>` that (a) validates `window` against the
      allowed enum, throwing `ValidationError` otherwise; (b) resolves `window` to a day count
      `N` (`now`→0, `30d`→30, `60d`→60, `90d`→90); (c) for every employee (via
      `EmployeeRepository.findAll`), computes per-day concurrent capacity across
      `[today, today+N]` using `date-utils.ts`'s `rangesOverlap` against each of that
      employee's assignments (via `AssignmentRepository.findAllForEmployee`), takes the
      **minimum** across those days as `utilizationPercent`, and includes the employee only if
      that minimum is below 100; (d) embeds the employee's skills via
      `SkillRepository.findSkillsForEmployee`, matching the `BenchEntry` schema exactly.
- [X] T012 [US1] Implement `src/api/routes/bench.routes.ts`: `GET /bench`, matching
      `specs/contracts/openapi-spec.yaml` exactly; wires to `bench.service.ts` only.
- [X] T013 [US1] Register the bench router in `src/api/app.ts` (construct `BenchService`
      alongside the existing wiring — it needs `EmployeeRepository`, `AssignmentRepository`,
      and `SkillRepository`).
- [X] T014 [US1] Run T005–T010 and confirm all pass; confirm Domain Logic coverage for
      `bench.service.ts` exceeds 70% (NFR-0001).

**Checkpoint**: User Story 1 is independently complete, testable, and deployable — the bench
view is fully functional on its own, with no dependency on reporting.

---

## Phase 4: User Story 2 - Generate a PDF report of allocations and utilization (Priority: P2)

**Goal**: A Manager can generate all three PDF report scopes (org-wide, per-employee,
per-project), with data assembled in Domain Logic and rendered by a thin pdfkit layer
(FR-0021–FR-0023).

**Independent Test**: Request each of the three report scopes and confirm a valid PDF is
returned reflecting real allocation/utilization data — independent of whether the bench view
has ever been viewed, and independent of Phase 3's implementation (both read the same
underlying repositories but share no code with `bench.service.ts`).

### Tests for User Story 2 (write first — MUST fail before implementation exists)

- [X] T015 [P] [US2] Unit test in `tests/unit/reports.service.test.ts` for
      `assembleOrgReport()`: returns every employee's name/seniority/current utilization (via
      `AssignmentService.getCurrentUtilization`, the same shared function — not recomputed) and
      only their **current** assignments (per FR-0021's current-scope convention).
- [X] T016 [P] [US2] Unit test in `tests/unit/reports.service.test.ts` for
      `assembleEmployeeReport(employeeId)`: returns the employee's full assignment history
      (past/current/future, unfiltered, per FR-0022) and current utilization; throws the
      existing `EmployeeNotFoundError` for a nonexistent ID.
- [X] T017 [P] [US2] Unit test in `tests/unit/reports.service.test.ts` for
      `assembleProjectReport(projectId)`: returns the project's required roles and only the
      employees **currently** assigned to each (per the resolved-gap current-only scope
      documented in data-model.md — not full staffing history); throws the existing
      `ProjectNotFoundError` for a nonexistent ID.
- [X] T018 [P] [US2] Integration test in `tests/integration/reports.api.test.ts` covering
      `GET /reports/org`, `GET /reports/employees/{employeeId}`, and
      `GET /reports/projects/{projectId}` end-to-end against a real SQLite database, asserting
      `200` + `Content-Type: application/pdf` + non-empty body for valid IDs, and `404
      NOT_FOUND` for nonexistent employee/project IDs, with cleanup (NFR-0002).
- [X] T019 [P] [US2] Contract test in `tests/contract/openapi-conformance.test.ts` asserting
      all three report endpoints return `Content-Type: application/pdf` on success and the
      `ErrorResponse` shape on the two scoped endpoints' `404` case.

### Implementation for User Story 2

- [X] T020 [US2] Implement `src/domain/reports.service.ts`'s `assembleOrgReport`,
      `assembleEmployeeReport`, and `assembleProjectReport` per T015–T017's rules and
      data-model.md's Report Data tables — internal return shapes only, no pdfkit import, no
      HTTP/rendering concerns; reuses `AssignmentService.getCurrentUtilization` and the
      existing `EmployeeRepository`/`ProjectRepository`/`AssignmentRepository` (including
      T003's new `findAllForProject`).
- [X] T021 [US2] Implement `src/reports/pdf-renderer.ts`: three thin rendering functions
      (`renderOrgReport`, `renderEmployeeReport`, `renderProjectReport`, or one generic
      `renderReport(data)` if the three internal data shapes can share a rendering path) using
      `pdfkit` to produce a PDF buffer/stream from the data `reports.service.ts` already
      assembled — no database imports, no repository imports, no aggregation logic; per
      research.md's decision, this file must not import any repository type.
- [X] T022 [US2] Implement `src/api/routes/reports.routes.ts`: `GET /reports/org`,
      `GET /reports/employees/{employeeId}`, `GET /reports/projects/{projectId}`, each calling
      the matching `reports.service.ts` assembly function then the matching `pdf-renderer.ts`
      function, setting `Content-Type: application/pdf` and streaming the result; wires to
      `reports.service.ts`/`pdf-renderer.ts` only — no business logic in the route handler.
- [X] T023 [US2] Register the reports router in `src/api/app.ts` (construct `ReportsService`
      alongside the existing wiring).
- [X] T024 [US2] Run T015–T019 and confirm all pass; confirm Domain Logic coverage for
      `reports.service.ts` exceeds 70% (NFR-0001).

**Checkpoint**: User Stories 1 AND 2 both work independently and together — EPIC-0004 is
functionally complete.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Whole-epic validation that no single user story phase covers on its own.

- [X] T025 [P] Run the full `quickstart.md` validation guide end-to-end (both scenarios)
      against a freshly-migrated database and confirm every documented expected outcome holds.
- [X] T026 [P] Run the complete Vitest suite (all four epics) with coverage and confirm overall
      Domain Logic coverage remains above 70% (NFR-0001).
- [X] T027 Verify every error response produced by this epic's endpoints (manually cross-check
      against `contracts/bench-reporting.md`'s error-code table — both reused, no new error
      types) uses the `{ error_code, message }` envelope with no exceptions (NFR-0005/ADR-0009).
- [X] T028 Verify the existing structured JSON request-logging middleware (reused unchanged)
      emits a log line for every request across all endpoints added in Phases 3–4 (NFR-0003).
- [X] T029 Grep the entire `src/` tree for any date-comparison logic outside `date-utils.ts`
      (extending EPIC-0003's T050 check to this epic's new files) and confirm none exists in
      `bench.service.ts`, `reports.service.ts`, or `pdf-renderer.ts` — the explicit
      verification that this epic honored NFR-0009's centralization requirement, not just
      stated it.
- [X] T030 Grep `src/reports/pdf-renderer.ts` specifically for any import from
      `src/repositories/` and confirm none exists — the explicit verification that the
      rendering layer performs no querying of its own, per this epic's structural requirement
      and the SDP's Architectural Design Rationale.

---

## Dependencies & Execution Order

- **Phase 1 (Setup)**: strictly first; installs `pdfkit`, needed by Phase 4 (not Phase 3).
- **Phase 2 (Foundational)**: only blocks Phase 4 (User Story 2) — `findAllForProject` is only
  needed by the per-project report. Phase 3 (User Story 1) has no dependency on Phase 2 and may
  proceed in parallel with it.
- **Phase 3 (US1 — Bench)**: depends only on Phase 1 (for consistency of setup, though it
  doesn't use `pdfkit`) and the pre-existing `AssignmentRepository.findAllForEmployee`
  (EPIC-0003). Can be implemented and shipped alone as the MVP.
- **Phase 4 (US2 — Reporting)**: depends on Phase 1 (`pdfkit`) and Phase 2
  (`findAllForProject`). Has no dependency on Phase 3 — the bench view and reporting share
  read access to the same repositories but no code with each other.
- **Phase 5 (Polish)**: depends on both Phase 3 and Phase 4 being complete.

## Parallel Execution Examples

- Phase 2 (T003, T004) and Phase 3 (all of US1) may run fully in parallel by different people,
  since Phase 3 has no dependency on Phase 2 at all.
- Within Phase 3: T005–T010 are `[P]` — independent test files/cases, all written before T011.
- Within Phase 4: T015–T019 are `[P]` — independent test files/cases, all written before T020.
- T011 (bench.service.ts) and T020/T021 (reports.service.ts/pdf-renderer.ts) may be implemented
  in parallel by different people once their respective test/foundational prerequisites land,
  since neither's implementation code depends on the other's.

## Implementation Strategy

**MVP first**: Complete Phase 1 → Phase 3 (User Story 1) and stop there for the smallest
deployable increment — a fully functional bench view across all four windows, no reporting yet.
Phase 2 is not required for this MVP slice.

**Incremental delivery**: Add Phase 2 → Phase 4 (User Story 2) next for PDF reporting. The two
user stories have no build-order dependency on each other (unlike EPIC-0002's US1/US2), so they
may also be built in the reverse order, or in parallel by two people, if reporting happens to be
prioritized first in practice.
