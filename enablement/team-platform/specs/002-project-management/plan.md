# Implementation Plan: Project Management (EPIC-0002)

**Branch**: `002-project-management` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-project-management/spec.md`

## Summary

Implement EPIC-0002 (Project Management) — FR-0009 through FR-0012 — as a three-layer backend
slice, extending EPIC-0001's existing structure rather than duplicating it: a Kysely-only
repository layer over the same SQLite database, a Domain Logic layer owning status-transition
validation and delete/removal-eligibility checks (both stubbed pending EPIC-0003, per spec.md's
disclosed Assumptions), and an Express REST API layer whose routes and payloads match
`specs/contracts/openapi-spec.yaml` exactly for the `/projects` and
`/projects/{projectId}/roles` paths. This plan also discharges EPIC-0001's tracked follow-up
(tasks.md T043): once `project_roles` exists, `skill.repository.ts`'s
`countProjectRoleAssociations` stub is replaced with a real query. No UI work is in scope.

## Technical Context

**Language/Version**: TypeScript on Node.js (per constitution Principle V / Technical Constraints) — unchanged from EPIC-0001.

**Primary Dependencies**: Express, Kysely over SQLite (no ORM, per SDP ADR-0003), `better-sqlite3`, Vitest — the same dependency set already installed for EPIC-0001; no new dependencies introduced.

**Storage**: The same SQLite file (`app.db`) EPIC-0001 uses, extended with a new migration (`0002_project_management`) adding `projects` and `project_roles` tables. `project_roles` references the existing `skills` table (EPIC-0001) for required-skill validation — reusing `skill.repository.ts`'s `findById`, not duplicating skill lookup logic. Busy-timeout configuration (NFR-0006) is inherited from the existing `db/connection.ts`, not reconfigured.

**Testing**: Vitest — unit tests for Domain Logic with >70% coverage (NFR-0001), covering the status-transition graph (Draft→Active→{Completed,Cancelled}, Draft→Cancelled — server-side enforced per the BFF Contract's `INVALID_STATUS_TRANSITION` design rationale, not merely a UI constraint), delete-eligibility, and role-removal-eligibility (both exercised via a repository test double, mirroring EPIC-0001's `hasAnyAssignments` precedent); integration tests against a real (temp-file) SQLite instance with cleanup (NFR-0002); contract tests against `openapi-spec.yaml`'s `/projects` and `/projects/{projectId}/roles` paths.

**Target Platform**: Single local Node.js process, no cloud/container target, per SDP ADR-0012 — unchanged.

**Project Type**: Single backend project (web service), extending the existing EPIC-0001 codebase in place (same `src/` layout) rather than a parallel structure. No frontend work in this plan.

**Performance Goals**: Not independently defined for this epic; inherits the SDP's general expectation that local SQLite reads/writes feel effectively instant at demo scale.

**Constraints**: No authentication/authorization (ADR-0011); no ORM beyond Kysely (ADR-0003); no pagination on list endpoints (BFF Contract); every non-2xx response uses the `{ error_code, message }` envelope (NFR-0005/ADR-0009); every request logged as structured JSON (NFR-0003, already implemented by the shared middleware from EPIC-0001 — not reimplemented here).

**Scale/Scope**: Demo scale — a handful of concurrent projects, tens of required roles total. This plan covers exactly the two resource groups scoped in spec.md: Project and ProjectRole. No assignment, bench, or report logic. Also in scope: the one-line cross-epic fix to EPIC-0001's `skill.repository.ts` (see Summary).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Upstream SDD Chain Is Authoritative | Endpoints, schemas, and error codes taken directly from `openapi-spec.yaml`; FRs cited by PRD ID in spec.md, not restated; status-transition graph taken from the already-ratified UX Spec/BFF Contract decision, not re-derived. | PASS |
| II. Layered Architecture & Centralized Domain Logic | Repository (Kysely only) → Domain Logic (status-transition, delete/removal-eligibility) → REST API. No business rule in a route handler; required-skill validation reuses EPIC-0001's `skill.repository.ts` rather than duplicating it. | PASS |
| III. Test-First Development | Vitest unit tests for Domain Logic (>70% coverage, including the status-transition graph and the EPIC-0001-precedented interim stubs) and integration tests against real SQLite with cleanup are both planned as first-class deliverables in tasks.md (next phase). | PASS |
| IV. Structured Observability & Consistent Error Contract | Reuses EPIC-0001's existing request-logging middleware and error-handler unchanged; extends the same typed exception hierarchy with new error types (`ProjectNotFoundError`, `ProjectRoleNotFoundError`, `ProjectHasAssignmentsError`, `ProjectRoleHasAssignmentsError`, `InvalidStatusTransitionError`, `ProjectNotEditableError`), reusing `SkillNotFoundError` as-is for invalid required-skill references rather than inventing a parallel error. | PASS |
| V. Simplicity & Fixed Technology Stack | No new dependencies; same TypeScript/Node/Express/Kysely/SQLite/Vitest stack. | PASS |
| Scope Boundaries | No payroll, timesheets, approval workflows, financial data, or external integrations touched. Assignment/Bench/Reports/Self-Service explicitly excluded, matching spec.md's Assumptions. | PASS |

No violations. Complexity Tracking table below is intentionally empty.

**Post-Phase-1 re-check**: `data-model.md`, `contracts/project-management.md`, and
`quickstart.md` were reviewed after design and introduce no new violations. The
`project_role_skills` join table mirrors `employee_skills`' established pattern rather than
inventing a new one; the discharge of EPIC-0001's `countProjectRoleAssociations` follow-up
modifies existing Domain Logic behavior transparently (no change to `skill.service.ts`'s public
interface); and both interim stubs (`Project.hasAnyAssignments`,
`ProjectRole.roleHasAnyAssignments`) are disclosed in data-model.md exactly as EPIC-0001's
precedent requires. Gate remains PASS.

## Project Structure

### Documentation (this feature)

```text
specs/002-project-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output (references openapi-spec.yaml; no re-derivation)
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root — extends EPIC-0001's existing tree, no parallel structure)

```text
src/
├── db/
│   ├── schema.ts               # EXTENDED: adds ProjectTable, ProjectRoleTable to Database interface
│   └── migrations/
│       ├── 0001_employee_management.ts   # unchanged (EPIC-0001)
│       ├── 0002_project_management.ts    # NEW: projects, project_roles tables
│       └── index.ts                       # EXTENDED: registers 0002 in the migration registry
├── repositories/
│   ├── employee.repository.ts   # unchanged (EPIC-0001)
│   ├── skill.repository.ts      # MODIFIED: countProjectRoleAssociations now queries project_roles for real (discharges EPIC-0001 T043)
│   └── project.repository.ts    # NEW: Kysely queries only — projects and project_roles
├── domain/
│   ├── employee.service.ts      # unchanged (EPIC-0001)
│   ├── skill.service.ts         # unchanged (EPIC-0001) — consumes the now-real countProjectRoleAssociations transparently
│   ├── project.service.ts       # NEW: status-transition validation, delete-eligibility, role CRUD + removal-eligibility (FR-0009–FR-0012)
│   └── errors/
│       └── domain-errors.ts     # EXTENDED: adds ProjectNotFoundError, ProjectRoleNotFoundError, ProjectHasAssignmentsError, ProjectRoleHasAssignmentsError, InvalidStatusTransitionError, ProjectNotEditableError; reuses existing SkillNotFoundError and ValidationError
├── api/
│   ├── routes/
│   │   ├── employees.routes.ts        # unchanged (EPIC-0001)
│   │   ├── employee-skills.routes.ts  # unchanged (EPIC-0001)
│   │   ├── skills.routes.ts           # unchanged (EPIC-0001)
│   │   └── projects.routes.ts         # NEW: /projects, /projects/{projectId}, /projects/{projectId}/roles[/{roleId}]
│   ├── middleware/                     # unchanged (EPIC-0001) — request-logger.ts, error-handler.ts reused as-is
│   └── app.ts                          # EXTENDED: wires ProjectRepository/ProjectService and registers projects.routes.ts
└── server.ts                            # unchanged (EPIC-0001)

tests/
├── unit/
│   ├── employee.service.test.ts   # unchanged (EPIC-0001)
│   ├── skill.service.test.ts       # EXTENDED: adds a case asserting affectedProjectRoleCount now reflects real project_roles data
│   └── project.service.test.ts     # NEW: status-transition graph, delete/removal-eligibility edge cases
├── integration/
│   ├── employees.api.test.ts       # unchanged (EPIC-0001)
│   ├── skills.api.test.ts          # EXTENDED: adds a case creating a project role referencing a skill and confirming deletion-impact reflects it
│   └── projects.api.test.ts        # NEW: full request/response cycle against real SQLite, with cleanup
└── contract/
    └── openapi-conformance.test.ts # EXTENDED: adds assertions for /projects and /projects/{projectId}/roles paths
```

**Structure Decision**: Extends EPIC-0001's existing single-backend-project structure in place — new files land in the same top-level `src/repositories/`, `src/domain/`, `src/api/routes/` directories rather than a per-epic subfolder, consistent with the pattern already established (and explicitly planned for) in EPIC-0001's plan.md. `skill.repository.ts` and `skill.service.ts` are modified, not replaced, to discharge the EPIC-0001 T043 follow-up as part of this epic's own scope.

## Complexity Tracking

*No violations — table intentionally left empty.*
