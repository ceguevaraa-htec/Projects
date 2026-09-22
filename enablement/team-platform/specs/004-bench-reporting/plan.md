# Implementation Plan: Bench & Reporting (EPIC-0004)

**Branch**: `004-bench-reporting` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-bench-reporting/spec.md`

## Summary

Implement EPIC-0004 (Bench & Reporting) — FR-0019 through FR-0023 — as a read-only extension of
the existing codebase: no new database tables, no new persisted entities. A new
`bench.service.ts` implements the day-level minimum-concurrent-capacity algorithm resolved in
spec.md, built entirely on `date-utils.ts`'s existing `rangesOverlap` (no new date-utils
function). A new `reports.service.ts` assembles the data for all three PDF report scopes in
Domain Logic — per the SDP's Architectural Design review, this is not optional: report figures
must be computed the same way the bench view and every other feature computes them, so a new,
separate `src/reports/pdf-renderer.ts` module (using `pdfkit`, MIT-licensed, per SDP ADR-0006)
performs only rendering over data `reports.service.ts` already assembled — it queries nothing
itself. Both new services reuse `AssignmentService.getCurrentUtilization` and existing
repositories rather than reimplementing utilization math. No UI work is in scope.

## Technical Context

**Language/Version**: TypeScript on Node.js (per constitution Principle V / Technical Constraints) — unchanged.

**Primary Dependencies**: Express, Kysely over SQLite (no ORM, per SDP ADR-0003), `better-sqlite3`, Vitest — all already installed. **New dependency**: `pdfkit` (MIT license, per SDP ADR-0006's explicit choice of a lightweight, pure-JS PDF library over a headless-browser-based tool) plus its `@types/pdfkit` dev-dependency type definitions.

**Storage**: No schema changes. This epic reads exclusively from tables created by EPIC-0001 (`employees`, `skills`, `employee_skills`), EPIC-0002 (`projects`, `project_roles`, `project_role_skills`), and EPIC-0003 (`assignments`). No migration is added.

**Testing**: Vitest — unit tests for `bench.service.ts`'s window algorithm (>70% coverage, NFR-0001), explicitly covering the two cases spec.md calls out: two non-overlapping partial assignments within a window (correctly included, low utilization) and an assignment that's busy-then-free within a window (correctly included, low utilization, not excluded by a peak/sum approach); unit tests for `reports.service.ts`'s data assembly (not-found handling for the two scoped reports); integration tests against a real (temp-file) SQLite instance with cleanup (NFR-0002); contract tests against `openapi-spec.yaml`'s `/bench`, `/reports/org`, `/reports/employees/{employeeId}`, `/reports/projects/{projectId}` paths, asserting response status and `Content-Type: application/pdf` for the report endpoints (not PDF byte-level content, which is out of scope for automated assertion at this scale).

**Target Platform**: Single local Node.js process, no cloud/container target, per SDP ADR-0012 — unchanged.

**Project Type**: Single backend project (web service), extending the existing codebase in place. No frontend work in this plan.

**Performance Goals**: The bench window algorithm iterates per-day within each window (up to 90 iterations for the 90-day window) per employee; at demo scale (tens of employees) this remains trivially fast with no optimization needed, consistent with the SDP's "effectively instant at demo scale" expectation. PDF generation is the one place the UX Specification already calls out as needing a minimal in-progress indicator (client-side, out of scope here) since it may take a perceptible moment — this plan does not introduce any async job queue for it, consistent with the BFF Contract and SDP's local, single-process, synchronous-response model.

**Constraints**: No authentication/authorization (ADR-0011); no ORM beyond Kysely (ADR-0003); no pagination on list endpoints (BFF Contract); every non-2xx response uses the `{ error_code, message }` envelope (NFR-0005/ADR-0009, reused unchanged for this epic's two not-found cases); every request logged as structured JSON (NFR-0003, reused unchanged); all date/overlap logic MUST route through the existing `date-utils.ts` module (NFR-0009) — no independent date computation for bench windows; PDF report-data assembly MUST live in Domain Logic, not the rendering layer (SDP Architectural Design Rationale — the specific, named reason the Container Diagram was corrected during the SDP's own review).

**Scale/Scope**: Demo scale — tens of employees, a handful of concurrent projects, correspondingly few assignments. This plan covers exactly the two read models scoped in spec.md: BenchEntry and report data (org/employee/project). No new persisted entity, no write endpoint, no new database table.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Upstream SDD Chain Is Authoritative | Endpoints and error codes taken directly from `openapi-spec.yaml`; FRs cited by PRD ID in spec.md, not restated; the bench window algorithm was explicitly resolved through back-and-forth review (see spec.md's Assumptions) rather than assumed. | PASS |
| II. Layered Architecture & Centralized Domain Logic | Repository (existing, unchanged) → Domain Logic (`bench.service.ts`, `reports.service.ts`) → REST API. No business rule in a route handler or in the PDF-rendering layer; report-data assembly is explicitly required to live in Domain Logic per the SDP's own Architectural Design Rationale, not merely a preference restated here. | PASS |
| III. Test-First Development | Vitest unit tests for the bench algorithm (>70% coverage, explicit boundary cases from spec.md) and `reports.service.ts`, plus integration tests against real SQLite with cleanup, are all planned as first-class deliverables in tasks.md (next phase). | PASS |
| IV. Structured Observability & Consistent Error Contract | Reuses existing request-logging middleware and error-handler unchanged; reuses existing `EmployeeNotFoundError`/`ProjectNotFoundError` for the two scoped reports' not-found case — no new error types needed for this epic. | PASS |
| V. Simplicity & Fixed Technology Stack | One new dependency (`pdfkit`), explicitly pre-approved by SDP ADR-0006 as the chosen PDF library — not a new, undiscussed addition. MIT-licensed, satisfying NFR-0008. | PASS |
| Scope Boundaries | No payroll, timesheets, approval workflows, financial data, or external integrations touched. Employee Self-Service and Search/Filter UI explicitly excluded, matching spec.md's Assumptions. | PASS |

No violations. Complexity Tracking table below is intentionally empty.

**Post-Phase-1 re-check**: `data-model.md`, `contracts/bench-reporting.md`, and `quickstart.md`
were reviewed after design and introduce no new violations. One genuine gap was caught and
resolved during this review, not left implicit: the per-project report requires "all
assignments for a project," a query no prior epic needed — `data-model.md` and this plan's
Project Structure now explicitly call out the resulting `AssignmentRepository.findAllForProject`
addition, rather than leaving it buried inside a service-layer task description. `VALIDATION_ERROR`
for a missing/invalid `window` parameter was also made explicit in the error-code contract
rather than left as an unstated "generic validation" case. Gate remains PASS.

## Project Structure

### Documentation (this feature)

```text
specs/004-bench-reporting/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output (references openapi-spec.yaml; no re-derivation)
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root — extends the existing tree, no parallel structure)

```text
src/
├── domain/
│   ├── bench.service.ts         # NEW: day-level minimum-concurrent-capacity window algorithm (FR-0019/FR-0020), built on date-utils.ts's rangesOverlap
│   ├── reports.service.ts       # NEW: assembles org/employee/project report data (FR-0021–FR-0023) in Domain Logic — no PDF/rendering concerns here
│   ├── assignment.service.ts    # unchanged (EPIC-0003) — reused for getCurrentUtilization and assignment data access
│   ├── employee.service.ts      # unchanged (EPIC-0001)
│   ├── project.service.ts       # unchanged (EPIC-0002)
│   ├── skill.service.ts         # unchanged (EPIC-0001/EPIC-0002)
│   ├── date-utils.ts            # unchanged (EPIC-0003) — reused as-is, no new function
│   └── errors/
│       └── domain-errors.ts     # unchanged — reuses existing EmployeeNotFoundError/ProjectNotFoundError; no new error types
├── reports/
│   └── pdf-renderer.ts           # NEW: thin pdfkit rendering layer — takes already-assembled report data from reports.service.ts, produces a PDF buffer/stream; performs no querying or aggregation of its own
├── repositories/
│   └── assignment.repository.ts   # MODIFIED: adds findAllForProject(projectId) — needed by the per-project report (FR-0023), no prior epic needed this query. All other repositories unchanged; bench.service.ts and reports.service.ts consume the existing repository interfaces directly.
├── api/
│   ├── routes/
│   │   ├── bench.routes.ts        # NEW: GET /bench
│   │   ├── reports.routes.ts      # NEW: GET /reports/org, /reports/employees/{employeeId}, /reports/projects/{projectId}
│   │   └── (all other route files unchanged)
│   ├── middleware/                 # unchanged — request-logger.ts, error-handler.ts reused as-is
│   └── app.ts                      # EXTENDED: wires BenchService/ReportsService and registers the two new routers
└── server.ts                        # unchanged

tests/
├── unit/
│   ├── bench.service.test.ts      # NEW: window algorithm boundary cases (>70% coverage)
│   └── reports.service.test.ts    # NEW: data assembly + not-found handling
├── integration/
│   ├── bench.api.test.ts          # NEW: GET /bench end-to-end against real SQLite, with cleanup
│   └── reports.api.test.ts        # NEW: all three report endpoints end-to-end, asserting status + Content-Type, with cleanup
└── contract/
    └── openapi-conformance.test.ts # EXTENDED: adds assertions for /bench and /reports/* paths (status codes, Content-Type; not PDF byte content)
```

**Structure Decision**: Extends the existing single-backend-project structure in place, consistent with all three prior epics' precedent. `bench.service.ts` and `reports.service.ts` are new, separate files (not folded into `assignment.service.ts`) — see research.md for the justification. `src/reports/` is a new top-level directory distinct from `src/domain/`, mirroring the SDP's Container Diagram, which explicitly models "PDF Report Generator" as its own component distinct from Domain Logic, consuming data from it rather than being part of it.

## Complexity Tracking

*No violations — table intentionally left empty.*
