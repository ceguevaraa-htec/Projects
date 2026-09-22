# Implementation Plan: Assignment Engine (EPIC-0003)

**Branch**: `003-assignment-engine` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-assignment-engine/spec.md`

## Summary

Implement EPIC-0003 (Assignment Engine) — FR-0013 through FR-0018 — as a three-layer backend
slice extending EPIC-0001/EPIC-0002's codebase in place: a Kysely-only repository layer adding
the `assignments` table (with structural `ON DELETE RESTRICT` foreign keys to `employees` and
`project_roles`), a Domain Logic layer owning capacity validation, active-project restriction,
future/past edit-cancel rules, and skill-match tiering — all date/overlap logic routed through
one new shared `date-utils.ts` module (SDP NFR-0009) — and an Express REST API layer matching
`specs/contracts/openapi-spec.yaml` exactly for `/assignments`,
`/assignments/{assignmentId}`, and `/projects/{projectId}/roles/{roleId}/candidates`.
**This plan's scope explicitly includes discharging three tracked cross-epic follow-ups as
first-class tasks**: EPIC-0001's `Employee.hasAnyAssignments` (tasks.md T044) and EPIC-0002's
`Project.hasAnyAssignments`/`ProjectRole.roleHasAnyAssignments` (tasks.md T033) all become real
Kysely existence queries against the new `assignments` table, with both prior epics'
`data-model.md`/`tasks.md` updated to record the resolution, mirroring EPIC-0002's precedent for
EPIC-0001's `countProjectRoleAssociations` debt. **Additionally, discovered during this epic's
design** (not named in the original planning input, but already documented in EPIC-0001's
`data-model.md` as depending on this exact epic): `employees.routes.ts`'s hardcoded
`currentUtilizationPercent: 0` and `assignments: []` are also replaced with real computed
values — see research.md for why this was folded in rather than left as a second dangling
forward reference. No UI work is in scope.

## Technical Context

**Language/Version**: TypeScript on Node.js (per constitution Principle V / Technical Constraints) — unchanged.

**Primary Dependencies**: Express, Kysely over SQLite (no ORM, per SDP ADR-0003), `better-sqlite3`, Vitest — the same dependency set already installed; no new dependencies introduced.

**Storage**: The same SQLite file (`app.db`), extended with migration `0003_assignment_engine` adding the `assignments` table. `assignments.employee_id` and `assignments.project_role_id` are foreign keys with `ON DELETE RESTRICT` — a genuine schema-level change from EPIC-0001/EPIC-0002's `CASCADE`-based FKs elsewhere, deliberately chosen so an assignment can never silently lose its parent employee or role (see research.md). Busy-timeout configuration (NFR-0006) is inherited unchanged.

**Testing**: Vitest — unit tests for `date-utils.ts` in isolation (pure functions, targeting 100% branch coverage on boundary cases: exactly today, single-day overlap, no overlap, full containment, partial overlap); unit tests for `assignment.service.ts`'s capacity/active-project/future-past/skill-match rules (>70% coverage, NFR-0001); integration tests against a real (temp-file) SQLite instance with cleanup (NFR-0002); contract tests against `openapi-spec.yaml`'s three in-scope paths. Additionally: new test cases added to EPIC-0001's `employee.service.test.ts`/`employees.api.test.ts` and EPIC-0002's `project.service.test.ts`/`projects.api.test.ts` covering the now-real stub replacements, mirroring EPIC-0002's T022/T023 pattern for its own cross-epic discharge.

**Target Platform**: Single local Node.js process, no cloud/container target, per SDP ADR-0012 — unchanged.

**Project Type**: Single backend project (web service), extending the existing codebase in place (same `src/` layout). No frontend work in this plan.

**Performance Goals**: Not independently defined for this epic; inherits the SDP's general expectation that local SQLite reads/writes feel effectively instant at demo scale.

**Constraints**: No authentication/authorization (ADR-0011); no ORM beyond Kysely (ADR-0003); no pagination on list endpoints (BFF Contract); every non-2xx response uses the `{ error_code, message }` envelope (NFR-0005/ADR-0009); every request logged as structured JSON (NFR-0003, reused unchanged); all date/overlap logic MUST route through the single `date-utils.ts` module (NFR-0009) — no piece of this epic computes "today" or "overlap" independently.

**Scale/Scope**: Demo scale — tens of employees, a handful of concurrent projects, correspondingly few assignments. This plan covers exactly the resource scoped in spec.md: Assignment, plus the candidates read model. Also in scope: the three-stub cross-epic discharge (see Summary), and updates to two prior epics' documentation artifacts.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Upstream SDD Chain Is Authoritative | Endpoints, schemas, and error codes taken directly from `openapi-spec.yaml`; FRs cited by PRD ID in spec.md, not restated; FR-0014's overlap rule and FR-0018's tiering logic implemented exactly as already specified in the PRD, not re-derived. | PASS |
| II. Layered Architecture & Centralized Domain Logic | Repository (Kysely only) → Domain Logic (capacity, active-project, future-past, skill-match) → REST API. No business rule in a route handler. Date/overlap logic centralized in one `date-utils.ts` module per NFR-0009 — this is the epic where that centralization requirement is finally fulfilled in code, not just stated in the SDP. | PASS |
| III. Test-First Development | Vitest unit tests for `date-utils.ts` (targeting 100% branch coverage on boundary cases) and `assignment.service.ts` (>70%, NFR-0001), plus integration tests against real SQLite with cleanup, are all planned as first-class deliverables in tasks.md (next phase). | PASS |
| IV. Structured Observability & Consistent Error Contract | Reuses EPIC-0001/EPIC-0002's existing request-logging middleware and error-handler unchanged; extends the same typed exception hierarchy with new error types (`CapacityExceededError`, `ProjectNotActiveError`, `AssignmentNotEditableError`, `AssignmentNotCancellableError`, `AssignmentNotFoundError`), reusing `EmployeeNotFoundError`/`ProjectRoleNotFoundError` as-is for invalid references. | PASS |
| V. Simplicity & Fixed Technology Stack | No new dependencies; same TypeScript/Node/Express/Kysely/SQLite/Vitest stack. | PASS |
| Scope Boundaries | No payroll, timesheets, approval workflows, financial data, or external integrations touched. Bench/Reports/Self-Service explicitly excluded, matching spec.md's Assumptions. | PASS |

No violations. Complexity Tracking table below is intentionally empty.

**Post-Phase-1 re-check**: `data-model.md`, `contracts/assignment-engine.md`, and
`quickstart.md` were reviewed after design and introduce no new violations. Two design-time
corrections were caught and resolved during this review rather than left for a later
`/speckit.analyze` pass: (1) the `Assignment` schema's `employeeName`/`projectName`/`roleName`
fields and the client-supplied (not server-derived) `projectId` on create were initially missed
in a first data-model.md draft and have been corrected to match `openapi-spec.yaml` exactly,
with the resulting `projectId`-must-match-role's-parent-project validation rule flagged
explicitly as a resolved gap in spec.md's Assumptions; (2) the previously-undischarged EPIC-0001
`currentUtilizationPercent`/`assignments` forward-reference is folded into this epic's scope
alongside the three named stubs, flagged explicitly rather than left dangling. Gate remains
PASS.

## Project Structure

### Documentation (this feature)

```text
specs/003-assignment-engine/
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
├── db/
│   ├── schema.ts               # EXTENDED: adds AssignmentTable to Database interface
│   └── migrations/
│       ├── 0001_employee_management.ts   # unchanged (EPIC-0001)
│       ├── 0002_project_management.ts    # unchanged (EPIC-0002)
│       ├── 0003_assignment_engine.ts     # NEW: assignments table, ON DELETE RESTRICT FKs
│       └── index.ts                       # EXTENDED: registers 0003 in the migration registry
├── repositories/
│   ├── employee.repository.ts   # MODIFIED: hasAnyAssignments now queries assignments for real (discharges EPIC-0001 T044)
│   ├── skill.repository.ts      # unchanged (EPIC-0001/EPIC-0002)
│   ├── project.repository.ts    # MODIFIED: hasAnyAssignments and roleHasAnyAssignments now query assignments for real (discharges EPIC-0002 T033)
│   └── assignment.repository.ts # NEW: Kysely queries only — assignments, plus the candidate-listing query (employees joined against a role's required skills)
├── domain/
│   ├── date-utils.ts             # NEW: isInFuture(date), rangesOverlap(rangeA, rangeB) — the SOLE source of "today"/"overlap" logic (NFR-0009)
│   ├── employee.service.ts       # unchanged (EPIC-0001) — consumes the now-real hasAnyAssignments transparently
│   ├── skill.service.ts          # unchanged (EPIC-0001/EPIC-0002)
│   ├── project.service.ts        # unchanged (EPIC-0002) — consumes the now-real hasAnyAssignments/roleHasAnyAssignments transparently
│   ├── assignment.service.ts     # NEW: capacity validation (via date-utils), active-project check, future/past edit-cancel check (via date-utils), skill-match tiering, and getCurrentUtilization(employeeId) — the ONE shared implementation called by both the Employee response path and the CandidateEmployee response path (see data-model.md/research.md)
│   └── errors/
│       └── domain-errors.ts     # EXTENDED: adds CapacityExceededError, ProjectNotActiveError, AssignmentNotEditableError, AssignmentNotCancellableError, AssignmentNotFoundError; reuses existing EmployeeNotFoundError, ProjectRoleNotFoundError
├── api/
│   ├── routes/
│   │   ├── employees.routes.ts        # MODIFIED: currentUtilizationPercent now calls the shared AssignmentService.getCurrentUtilization(employeeId), embedded assignments computed for real (discovered EPIC-0001 forward-reference, discharged alongside T044)
│   │   ├── employee-skills.routes.ts  # unchanged (EPIC-0001)
│   │   ├── skills.routes.ts           # unchanged (EPIC-0001)
│   │   ├── projects.routes.ts         # EXTENDED: adds GET /projects/{projectId}/roles/{roleId}/candidates
│   │   └── assignments.routes.ts      # NEW: /assignments, /assignments/{assignmentId}
│   ├── middleware/                     # unchanged — request-logger.ts, error-handler.ts reused as-is
│   └── app.ts                          # EXTENDED: wires AssignmentRepository/AssignmentService and registers assignments.routes.ts
└── server.ts                            # unchanged

tests/
├── unit/
│   ├── date-utils.test.ts          # NEW: boundary-case coverage for isInFuture/rangesOverlap
│   ├── employee.service.test.ts    # EXTENDED: adds a case asserting deleteEmployee is now genuinely blocked when a real assignment exists
│   ├── project.service.test.ts     # EXTENDED: adds cases asserting deleteProject/removeProjectRole are now genuinely blocked when real assignments exist
│   ├── skill.service.test.ts       # unchanged
│   └── assignment.service.test.ts  # NEW: capacity/active-project/future-past/skill-match edge cases
├── integration/
│   ├── employees.api.test.ts       # EXTENDED: adds a case creating a real assignment and confirming DELETE /employees/{id} now returns 409 EMPLOYEE_HAS_ASSIGNMENTS
│   ├── skills.api.test.ts          # unchanged
│   ├── projects.api.test.ts        # EXTENDED: adds cases confirming DELETE /projects/{id} and DELETE .../roles/{roleId} now return 409 with real assignments
│   └── assignments.api.test.ts     # NEW: full request/response cycle against real SQLite, with cleanup
└── contract/
    └── openapi-conformance.test.ts # EXTENDED: adds assertions for /assignments, /assignments/{assignmentId}, /projects/{projectId}/roles/{roleId}/candidates
```

**Structure Decision**: Extends the existing single-backend-project structure in place, consistent with both prior epics' precedent. `employee.repository.ts` and `project.repository.ts` are modified (not replaced) to discharge their respective tracked follow-ups as part of this epic's own scope — the same pattern EPIC-0002 established for `skill.repository.ts`.

## Complexity Tracking

*No violations — table intentionally left empty.*
