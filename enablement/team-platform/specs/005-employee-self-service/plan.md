# Implementation Plan: Employee Self-Service (EPIC-0005)

**Branch**: `005-employee-self-service` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-employee-self-service/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add `GET /employees/{employeeId}/my-assignments` (FR-0024): a single read-only endpoint composing three already-existing pieces — `EmployeeRepository.findById` (404 via `EmployeeNotFoundError` if missing), `AssignmentService.listEmployeeAssignments` (unfiltered, full history), and `AssignmentService.getCurrentUtilization` (the shared utilization figure) — into the `MyAssignmentsResponse` shape already defined in `openapi-spec.yaml`. No new schema, no new date logic, no new utilization computation.

## Technical Context

**Language/Version**: TypeScript on Node.js (matching EPIC-0001–0004, no change)

**Primary Dependencies**: Express (routing), Kysely over SQLite (existing repositories, unchanged), Vitest (testing) — no new dependency is introduced by this epic

**Storage**: SQLite via existing `employees` and `assignments` tables — no schema change, no migration

**Testing**: Vitest — integration tests against real SQLite (NFR-0002) for the endpoint's data shape, 404 case, and no-cross-employee-leakage; a contract test against `openapi-spec.yaml`'s `/employees/{employeeId}/my-assignments` path

**Target Platform**: Local single-process Node server (unchanged)

**Project Type**: Single project — extends the existing `src/repositories`, `src/domain`, `src/api/routes` structure in place

**Performance Goals**: Demo-scale (tens of employees); no new performance concern — this is a single, unfiltered repository read plus a reduce, the same cost profile as the existing Employee-detail read path

**Constraints**: No authentication/authorization (ADR-0011); no new error types; no PDF/report concern

**Scale/Scope**: One endpoint, one new Domain Logic method, zero new persisted entities

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Upstream SDD Chain Is Authoritative)**: FR-0024 and `GET /employees/{employeeId}/my-assignments` are referenced directly from the PRD and OpenAPI spec, not restated — PASS.
- **Principle II (Layered Architecture & Centralized Domain Logic)**: The not-found check and response composition MUST live in Domain Logic, not the route handler — this is the deciding factor for the research.md question the user explicitly raised (dedicated service vs. route-level composition). Every prior epic throws its `NotFoundError` from a service, never a route (`employee.service.ts`, `assignment.service.ts`, `reports.service.ts`); composing directly in the route handler would be the first exception to that pattern and would violate ADR-0005's centralization rule. A dedicated `self-service.service.ts` is warranted — PASS, resolved in research.md.
- **Principle III (Test-First Development)**: Domain Logic method covered by unit tests; endpoint covered by integration tests against real SQLite with cleanup — PASS. The >70% coverage target (NFR-0001) is not meaningfully chaseable on a near-zero-branching composition method, per the user's own framing — the plan follows the same "test what can meaningfully fail" judgment already applied in prior epics rather than padding for a coverage number.
- **Principle IV (Structured Observability & Consistent Error Contract)**: 404 uses the existing `{ error_code, message }` envelope via `EmployeeNotFoundError` — no new error type — PASS.
- **Principle V (Simplicity & Fixed Technology Stack)**: No new dependency, no new persisted entity, no schema change — PASS.

No violations. Complexity Tracking section is not needed.

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
│   ├── self-service.service.ts   # NEW — composes employee + assignments + utilization
│   ├── assignment.service.ts     # existing — getCurrentUtilization, listEmployeeAssignments (reused as-is)
│   └── errors/domain-errors.ts   # existing — EmployeeNotFoundError (reused as-is)
├── repositories/
│   ├── employee.repository.ts    # existing — findById (reused as-is)
│   └── assignment.repository.ts  # existing — findAllForEmployee (reused as-is)
└── api/routes/
    └── employees.routes.ts       # MODIFIED — add GET /employees/:employeeId/my-assignments

tests/
├── contract/
│   └── openapi-conformance.test.ts   # MODIFIED — add my-assignments path assertions
├── integration/
│   └── self-service.api.test.ts      # NEW — data shape, 404, no-cross-employee-leakage
└── unit/
    └── self-service.service.test.ts  # NEW — composition + not-found unit coverage
```

**Structure Decision**: Single project, extending the existing three-layer structure in place — no new top-level directories, no new project type. This matches the layout established by EPIC-0001 through EPIC-0004.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
