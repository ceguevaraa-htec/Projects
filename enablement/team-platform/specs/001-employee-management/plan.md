# Implementation Plan: Employee Management (EPIC-0001)

**Branch**: `001-employee-management` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-employee-management/spec.md`

## Summary

Implement EPIC-0001 (Employee Management) — FR-0001 through FR-0008 — as a three-layer backend
slice: a Kysely-only repository layer over SQLite, a Domain Logic layer owning delete-eligibility
checks and skill-catalog uniqueness/cascading rules, and an Express REST API layer whose routes
and payloads match `specs/contracts/openapi-spec.yaml` exactly for the `/employees`,
`/employees/{employeeId}/skills`, `/skills`, and `/skills/{skillId}/deletion-impact` paths. No
UI work is in scope for this plan; this is backend-only, consistent with the spec's exclusion of
all other epics.

## Technical Context

**Language/Version**: TypeScript on Node.js (per constitution Principle V / Technical Constraints)

**Primary Dependencies**: Express (REST routing), Kysely (type-safe query builder over SQLite —
no ORM, per SDP ADR-0003), `better-sqlite3` (SQLite driver), Vitest (unit + integration testing)

**Storage**: SQLite, single local file (`app.db`, git-ignored per SDP ADR-0008), accessed
exclusively through Kysely; busy-timeout configured per SDP NFR-0006 (shared across all epics,
not re-configured per feature)

**Testing**: Vitest — unit tests for Domain Logic with >70% coverage including NFR-0001's
enumerated edge cases (over-assignment/over-capacity is out of scope for this epic, but the
analogous edge cases here are: delete-with-dependents, duplicate skill names, duplicate
employee-skill associations); integration tests against a real (temp-file or in-memory) SQLite
instance with cleanup after each run (NFR-0002)

**Target Platform**: Single local Node.js process (Linux/macOS/Windows via Node runtime), no
cloud/container target, per SDP ADR-0012

**Project Type**: Single backend project (web service). No frontend work in this plan — the
existing SDP/UX Spec calls for a single Express process eventually serving both API and static
UI, but this feature's scope is the API and its underlying layers only.

**Performance Goals**: Not independently defined for this epic; inherits the SDP's general
expectation that local SQLite reads/writes feel effectively instant at demo scale (tens of
employees) — no specific latency budget beyond that.

**Constraints**: No authentication/authorization (ADR-0011); no ORM beyond Kysely (ADR-0003); no
pagination on list endpoints (BFF Contract); every non-2xx response uses the `{ error_code,
message }` envelope (NFR-0005/ADR-0009); every request logged as structured JSON (NFR-0003).

**Scale/Scope**: Demo scale — tens of employees, a shared skill catalog in the tens of entries.
This plan covers exactly the four resource groups scoped in spec.md: Employees, EmployeeSkills,
Skills, and the skill deletion-impact preview. No assignment, project, bench, or report logic.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Upstream SDD Chain Is Authoritative | Endpoints, schemas, and error codes are taken directly from `openapi-spec.yaml`; FRs cited by PRD ID in spec.md, not restated. | PASS |
| II. Layered Architecture & Centralized Domain Logic | Repository (Kysely only) → Domain Logic (delete-eligibility, uniqueness, cascade) → REST API. No business rule is implemented in a route handler. | PASS |
| III. Test-First Development | Vitest unit tests for Domain Logic (>70% coverage, edge cases enumerated below) and integration tests against real SQLite with cleanup are both planned as first-class deliverables in tasks.md (next phase). | PASS |
| IV. Structured Observability & Consistent Error Contract | Structured JSON request-logging middleware and a typed exception hierarchy mapping to `{ error_code, message }` are both explicit parts of this plan's structure. | PASS |
| V. Simplicity & Fixed Technology Stack | TypeScript/Node/Express/Kysely/SQLite/Vitest only; no ORM, no auth, no cloud/CI-CD, vanilla-JS-compatible (no frontend framework introduced by this backend-only plan). | PASS |
| Scope Boundaries | No payroll, timesheets, approval workflows, financial data, or external integrations touched. Assignment/Project/Bench/Reports/Self-Service explicitly excluded, matching spec.md's Assumptions. | PASS |

No violations. Complexity Tracking table below is intentionally empty.

**Post-Phase-1 re-check**: `data-model.md`, `contracts/employee-management.md`, and
`quickstart.md` were reviewed after design and introduce no new violations — the data model
places delete-eligibility and uniqueness rules in Domain Logic (not the schema layer alone), the
contract explicitly defers to the authoritative OpenAPI spec rather than redefining it, and the
quickstart's scenarios all exercise the layered structure end-to-end rather than bypassing it.
Gate remains PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-employee-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output (references openapi-spec.yaml; no re-derivation)
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── connection.ts          # Kysely instance + SQLite connection, busy-timeout config
│   ├── schema.ts               # Kysely database type definitions (Employee, Skill, EmployeeSkill tables)
│   └── migrations/
│       └── 0001_employee_management.ts   # employees, skills, employee_skills tables
├── repositories/
│   ├── employee.repository.ts   # Kysely queries only — no business rules
│   └── skill.repository.ts      # Kysely queries only — no business rules
├── domain/
│   ├── employee.service.ts      # create/edit employee; delete-eligibility check (FR-0003)
│   ├── skill.service.ts         # create/rename skill uniqueness (FR-0006/0007); deletion-impact + cascade (FR-0008)
│   └── errors/
│       └── domain-errors.ts     # Typed exception hierarchy (EmployeeHasAssignmentsError, DuplicateSkillNameError, EmployeeSkillNotFoundError, etc.)
├── api/
│   ├── routes/
│   │   ├── employees.routes.ts        # /employees, /employees/{employeeId}
│   │   ├── employee-skills.routes.ts  # /employees/{employeeId}/skills, /employees/{employeeId}/skills/{skillId}
│   │   └── skills.routes.ts           # /skills, /skills/{skillId}, /skills/{skillId}/deletion-impact
│   ├── middleware/
│   │   ├── request-logger.ts     # Structured JSON per-request logging (NFR-0003)
│   │   └── error-handler.ts      # Maps typed domain errors → { error_code, message } envelope (NFR-0005/ADR-0009)
│   └── app.ts                     # Express app assembly (routes + middleware), no server listen() here
└── server.ts                       # Entry point: creates app, starts listening

tests/
├── unit/
│   ├── employee.service.test.ts   # Delete-eligibility, edit validation edge cases
│   └── skill.service.test.ts       # Uniqueness, deletion-impact counting, cascade edge cases
├── integration/
│   ├── employees.api.test.ts       # Full request/response cycle against real SQLite, with cleanup
│   └── skills.api.test.ts          # Full request/response cycle against real SQLite, with cleanup
└── contract/
    └── openapi-conformance.test.ts # Asserts route paths/status codes match openapi-spec.yaml for this epic's endpoints
```

**Structure Decision**: Single backend project (Option 1 pattern), since this plan is
backend-only and there is no frontend work in EPIC-0001's scope. The repository/domain/api
three-layer split directly mirrors the constitution's Principle II and SDP ADR-0005, and is kept
flat (no per-epic subfolder) since later epics (Assignment Engine, Project Management, etc.) will
add their own repositories/services/routes into these same top-level directories rather than
duplicating the layering per epic.

## Complexity Tracking

*No violations — table intentionally left empty.*
