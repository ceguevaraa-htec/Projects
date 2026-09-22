# Phase 0 Research: Employee Management (EPIC-0001)

No `NEEDS CLARIFICATION` markers remain from the Technical Context — every technical decision
was either specified directly in the user's planning input or already ratified upstream (SDP,
Technical Constraints, BFF Contract). This document records the resulting decisions and their
rationale rather than open-ended research, per the constitution's directive to treat the
upstream chain as authoritative.

## Decision: Language, runtime, and web framework

- **Decision**: TypeScript on Node.js with Express.
- **Rationale**: Mandated by the Technical Constraints and carried into SDP ADR-0001/ADR-0002;
  not re-evaluated here.
- **Alternatives considered**: None — this is a fixed constraint, not an open choice.

## Decision: Data access layer

- **Decision**: Kysely (type-safe query builder) over `better-sqlite3`, no ORM.
- **Rationale**: SDP ADR-0003 already selected Kysely specifically because the query patterns
  needed elsewhere in this system (capacity sums, bench aggregation) benefit from direct,
  type-checked SQL. This epic's queries (employee/skill CRUD, association management, impact
  counting) are simpler than those cases but use the same repository layer for consistency.
- **Alternatives considered**: A full ORM (Prisma/TypeORM) — rejected upstream in the SDP, not
  reopened here.

## Decision: Layering — repository / domain / API

- **Decision**: Repository (Kysely queries only, no business rules) → Domain Logic (business
  rules) → REST API (Express routes, request/response shaping only).
- **Rationale**: Directly required by constitution Principle II and SDP ADR-0005. For this
  epic specifically, the rules that must live in Domain Logic rather than routes are:
  delete-eligibility for employees (FR-0003: block if any assignment exists — checked via a
  repository query for assignment existence, but the *decision* to block belongs to Domain
  Logic), skill-name uniqueness on create/rename (FR-0006/FR-0007), and skill deletion-impact
  computation plus cascading removal (FR-0008).
- **Alternatives considered**: Embedding validation directly in Express route handlers —
  rejected, as it would violate constitution Principle II and risk the same rule being
  reimplemented differently in a later epic that also touches employees or skills.

## Decision: Error handling shape

- **Decision**: A typed exception hierarchy in Domain Logic (e.g., `EmployeeHasAssignmentsError`,
  `DuplicateSkillNameError`, `EmployeeNotFoundError`, `SkillNotFoundError`,
  `DuplicateEmployeeSkillError`, `EmployeeSkillNotFoundError`), caught by a single Express error-handling middleware that maps
  each exception type to the appropriate HTTP status and the `{ error_code, message }` envelope.
- **Rationale**: Required by NFR-0005/ADR-0009 (consistent envelope, mandatory) and by the BFF
  Contract's distinct `error_code` values per failure mode (e.g., `EMPLOYEE_HAS_ASSIGNMENTS`,
  `SKILL_NAME_NOT_UNIQUE`, `NOT_FOUND`). A typed hierarchy (rather than ad hoc `throw new
  Error(string)`) lets the single error-handling middleware map exceptions to codes exhaustively
  and lets Domain Logic tests assert on exception type rather than string matching.
- **Alternatives considered**: Per-route try/catch with manual envelope construction — rejected,
  since it would duplicate the envelope-construction logic across every route handler and risk
  inconsistency (violating NFR-0005's "every non-2xx response" requirement).

## Decision: Testing strategy

- **Decision**: Vitest for both unit and integration tests. Unit tests exercise Domain Logic in
  isolation (with a repository test double or an in-memory SQLite instance — see below) and
  target >70% coverage per NFR-0001, explicitly covering: deleting an employee with a future-only
  assignment (still blocked), deleting an employee/skill with zero dependents (allowed),
  creating a skill with a name collision, associating a duplicate employee-skill pair, updating
  or removing an (employeeId, skillId) association that does not exist (raises
  `EmployeeSkillNotFoundError`), and previewing deletion-impact for a skill with zero
  associations. Integration tests run the full
  Express route → Domain Logic → repository → real SQLite path, using a fresh temp-file SQLite
  database per test file, torn down after each run (NFR-0002).
- **Rationale**: Directly required by constitution Principle III. Using a real SQLite file (not
  a mock) for integration tests is explicitly mandated by NFR-0002 — mocking the database would
  not satisfy this requirement even though it is technically simpler.
- **Alternatives considered**: Mocking Kysely/the repository layer for integration tests —
  explicitly rejected by NFR-0002.

## Decision: Observability

- **Decision**: A single Express middleware logs one structured JSON line per request
  (timestamp, method, route, duration, status code), applied globally rather than per-route.
- **Rationale**: NFR-0003 scopes logging to the HTTP request/response boundary only; a single
  global middleware satisfies this for every route this epic (and future epics) adds, without
  per-route instrumentation.
- **Alternatives considered**: Per-route manual logging — rejected as repetitive and easy to
  miss on a new route; a global middleware cannot be forgotten.

## Decision: Request/response schema source

- **Decision**: Request and response TypeScript types for this epic's endpoints are derived
  directly from `specs/contracts/openapi-spec.yaml`'s schemas (`Employee`, `EmployeeSummary`,
  `EmployeeCreateRequest`, `EmployeeUpdateRequest`, `EmployeeSkill`,
  `EmployeeSkillCreateRequest`, `Skill`, `SkillDeletionImpact`, `ErrorResponse`), not
  re-derived from the PRD or invented independently.
- **Rationale**: Constitution Principle I and the user's planning input both require the OpenAPI
  spec to be treated as the literal, authoritative contract for this epic's endpoints.
- **Alternatives considered**: Defining new TypeScript interfaces independently and reconciling
  them with the OpenAPI spec later — rejected, since it invites drift the constitution
  specifically warns against.
