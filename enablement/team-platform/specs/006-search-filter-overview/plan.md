# Implementation Plan: Search, Filter & Employee Overview — Backend Gap Closure (EPIC-0006)

**Branch**: `006-search-filter-overview` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-search-filter-overview/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Close three confirmed gaps in `GET /employees`: (1) wire the already-ratified `minAvailability` filter, (2) wire the already-ratified `sort=utilization` option, (3) replace the hardcoded `currentProjectNames: []` with a real query — plus backfill integration test coverage for FR-0025/FR-0026's existing, working-but-untested filter/sort parameters. No schema change, no new repository method for `currentProjectNames` (reuses `AssignmentService.listEmployeeAssignments`, already used elsewhere in this same route file).

## Technical Context

**Language/Version**: TypeScript on Node.js (unchanged)

**Primary Dependencies**: Express, Kysely over SQLite, Vitest — no new dependency

**Storage**: SQLite via existing `employees`/`assignments`/`projects` tables — no schema change, no migration

**Testing**: Vitest — integration tests for all three new/fixed capabilities plus the backfilled FR-0025/FR-0026 coverage; contract-test additions confirming `GET /employees`'s response shape and the two new query parameters

**Target Platform**: Local single-process Node server (unchanged)

**Project Type**: Single project — extends `src/repositories`, `src/domain`, `src/api/routes` in place

**Performance Goals**: Demo-scale (tens of employees) — fetching the full employee list and computing utilization per employee in application code, as this epic's structural approach requires (see research.md), remains well within that budget; no pagination, no new performance concern

**Constraints**: No authentication/authorization (ADR-0011); no new error types (these are additive query capabilities, not new rejection paths — confirmed below); no new persisted entity

**Scale/Scope**: One route's query-handling logic extended, one repository method's filter/sort logic reworked, one new `AssignmentService`-reusing composition for `currentProjectNames`, plus test-only additions for FR-0026

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Upstream SDD Chain Is Authoritative)**: FR-0025/FR-0027 and `GET /employees`'s `minAvailability`/`sort=utilization` parameters are referenced directly from the PRD and the already-ratified OpenAPI spec, not restated or re-derived — PASS.
- **Principle II (Layered Architecture & Centralized Domain Logic)** — **explicit call-out, not a silent pass**: every prior epic's repository methods are pure Kysely queries with sorting/filtering pushed down to SQL; `EmployeeService`/route composition never post-processes a repository's result set for filtering or ordering. This epic's `minAvailability` filter and `sort=utilization` cannot follow that pattern, because utilization is not a stored column — it is a Domain Logic value (`AssignmentService.getCurrentUtilization`), computed per employee, and neither SQL nor the repository layer has any way to filter/sort by it. The filter/sort logic for these two capabilities therefore necessarily lives above the repository, in `EmployeeService` (Domain Logic), operating on the full result set after utilization has been computed for each employee. This is **a deliberate, narrow exception to "sorting/filtering happens in the repository," not a violation of centralization** — the computation itself (`getCurrentUtilization`) still comes from the one shared Domain Logic implementation, nothing is duplicated, and the exception is confined to these two utilization-derived parameters; every other filter/sort on this endpoint (`skill`, `proficiency`, `seniority`, `name`, `employmentStartDate`) continues to be pushed down to SQL exactly as before. `currentProjectNames` follows the existing pattern used by this same route for `assignments`/`currentUtilizationPercent` on the detail endpoint (composed in the route from existing `AssignmentService` calls) — no exception needed there. PASS, with the above documented rather than silently treated as routine.
- **Principle III (Test-First Development)**: New Domain Logic filter/sort behavior and the `currentProjectNames` composition are covered by integration tests before/alongside implementation; the FR-0025/FR-0026 backfill adds integration tests only (per the user's explicit instruction — the underlying logic already works, so unit tests would not prove anything integration tests don't already cover) — PASS.
- **Principle IV (Structured Observability & Consistent Error Contract)**: No new error type is introduced — `minAvailability` reuses the existing `ValidationError`, following the same explicit-400-rejection precedent already set by `capacityPercent` and the bench `window` param (an out-of-range, non-integer, or non-numeric `minAvailability` is rejected with `400 VALIDATION_ERROR`, not silently ignored — see research.md's revised decision). `sort=utilization` is a new accepted enum value, not a new rejection path; `sort`'s pre-existing lenient fallback for unrecognized values is untouched by this epic. PASS, confirmed explicitly per the user's request.
- **Principle V (Simplicity & Fixed Technology Stack)**: No new dependency, no new persisted entity, no schema change — PASS.

No violations requiring justification. Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── employee.service.ts        # MODIFIED — new filter/sort-by-utilization composition (Domain Logic)
│   └── assignment.service.ts      # existing — getCurrentUtilization, listEmployeeAssignments (reused as-is)
├── repositories/
│   └── employee.repository.ts     # MODIFIED — findAll no longer applies sort when sort=utilization (leaves that to the service); minAvailability is NOT a repository concern
└── api/routes/
    └── employees.routes.ts        # MODIFIED — parse minAvailability query param; currentProjectNames composed via AssignmentService.listEmployeeAssignments

tests/
├── contract/
│   └── openapi-conformance.test.ts    # MODIFIED — assert currentProjectNames real values; minAvailability/sort=utilization conformance
├── integration/
│   ├── employees.api.test.ts          # MODIFIED — minAvailability, sort=utilization, currentProjectNames, plus FR-0025 backfill (skill/proficiency/seniority/name/employmentStartDate — confirmed zero existing coverage of any of these)
│   └── projects.api.test.ts           # MODIFIED — FR-0026 backfill (status/requiredRole/date-range/name/startDate/endDate — confirmed zero existing coverage of any of these)
```

**Structure Decision**: Single project, extending the existing three-layer structure in place — no new top-level directories, no new project type, matching every prior epic's layout.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
