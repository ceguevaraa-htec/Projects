# Phase 0 Research: Employee Self-Service (EPIC-0005)

## Decision: Dedicated `self-service.service.ts`, not route-level composition

**Question raised explicitly by the plan input**: given the endpoint's near-zero business logic (a not-found check plus two already-existing reads), is a new Domain Logic service file warranted, or is composing directly in `employees.routes.ts` acceptable for something this trivial?

**Decision**: A dedicated `self-service.service.ts` with one method, `getMyAssignments(employeeId: string): Promise<MyAssignmentsData>`, is warranted.

**Rationale**: This is a constitution-mandated architecture decision, not a stylistic one. Principle II (Layered Architecture & Centralized Domain Logic) states Domain Logic is the *single owner* of composition and validation, and every prior epic's not-found check is thrown from a service — never a route handler:
- `employee.service.ts` throws `EmployeeNotFoundError` for every employee-scoped operation (EPIC-0001).
- `assignment.service.ts` throws `EmployeeNotFoundError`/`ProjectNotFoundError` when creating an assignment (EPIC-0003).
- `reports.service.ts` throws `EmployeeNotFoundError`/`ProjectNotFoundError` for the two scoped report endpoints (EPIC-0004).

Composing this endpoint directly in `employees.routes.ts` — including the `findById` call, the `EmployeeNotFoundError` throw, and the two `AssignmentService` calls — would be the first route handler in the codebase to own a not-found check and multi-source composition itself. That is a real precedent break, not a neutral simplification: it reintroduces exactly the risk ADR-0005 was written to prevent (business rules drifting into callers). "The logic is trivial" is true of *this* method in isolation, but the pattern it would set (routes are allowed to compose and throw domain errors when the composition is simple enough) has no principled stopping point — the next trivial-looking endpoint would cite this one as precedent.

**Alternatives considered**:
- *Compose in the route handler* — rejected for the reason above: violates Principle II's centralization rule, not just a style deviation.
- *Add the method to the existing `AssignmentService`* — rejected: this composition's primary subject is the Employee (identity + not-found check), with assignment data as a secondary input; `AssignmentService` already has a clear, assignment-centered responsibility (capacity validation, candidate matching, bench-adjacent utilization), and folding an employee-identity-scoped read into it would blur that boundary for no benefit, since nothing is shared beyond the two already-public methods it already exposes (`getCurrentUtilization`, `listEmployeeAssignments`).
- *Dedicated `self-service.service.ts`* — **adopted**: keeps the not-found check and composition in Domain Logic per Principle II, keeps `AssignmentService`'s existing responsibility boundary intact, and mirrors `reports.service.ts`'s established pattern of a small service that composes existing repository/service calls into a response shape for one specific, self-contained feature.

## Decision: No new repository or service methods beyond the one composition method

**Decision**: `self-service.service.ts` calls only `EmployeeRepository.findById`, `AssignmentService.listEmployeeAssignments`, and `AssignmentService.getCurrentUtilization` — all three already exist and are unmodified.

**Rationale**: Confirmed via direct inspection of the current codebase:
- `EmployeeRepository.findById(employeeId): Promise<EmployeeRecord | undefined>` (`src/repositories/employee.repository.ts`) — existing, used by every other employee-scoped not-found check.
- `AssignmentService.listEmployeeAssignments(employeeId): Promise<AssignmentRecord[]>` (`src/domain/assignment.service.ts`) — existing, a thin passthrough to `AssignmentRepository.findAllForEmployee`, already unfiltered (returns past/current/future).
- `AssignmentService.getCurrentUtilization(employeeId): Promise<number>` (`src/domain/assignment.service.ts`) — existing, the one shared utilization implementation already reused by the Employee response, the candidates endpoint, and the bench view.

No new date logic and no new utilization computation are needed — this satisfies the plan input's explicit constraint and the spec's Assumptions.

**Alternatives considered**: None — the plan input already specified these three calls as the composition; research here is limited to confirming each exists with the expected signature, which it does.

## Decision: Response shape follows `MyAssignmentsResponse` exactly, no new fields

**Decision**: The service returns `{ employeeId, name, currentUtilizationPercent, assignments }`, matching `openapi-spec.yaml`'s `MyAssignmentsResponse` schema (`employeeId: uuid`, `name: string`, `currentUtilizationPercent: integer 0-100`, `assignments: Assignment[]`) with no additions.

**Rationale**: Per constitution Principle I, the OpenAPI spec is the literal contract for this endpoint, not a description to reinterpret. `assignments` reuses the existing `Assignment` schema already returned by other endpoints (e.g., the per-employee report's assignment entries) — no new schema fragment is needed.

**Alternatives considered**: Embedding `temporalStatus` per assignment (as the per-employee PDF report does) — rejected: the OpenAPI `Assignment` schema referenced by `MyAssignmentsResponse` does not include a `temporalStatus` field, and adding one would silently diverge from the ratified contract (Principle I). If a future epic wants that, it belongs in an OpenAPI spec amendment, not a silent addition here.

## Decision: Testing — integration and unit, skip chasing coverage % on trivial branching

**Decision**: One unit test file for `self-service.service.ts` (happy path + not-found), one integration test file asserting real-SQLite behavior (correct shape, 404, and that a second employee's data never appears in the first employee's response), and one contract-test addition for the `my-assignments` path.

**Rationale**: Matches the plan input's explicit framing — NFR-0001's >70% coverage target is trivially satisfied by a two-branch method (found / not-found) and is not a meaningful signal here; test effort is directed at what could actually break: cross-employee data leakage (the spec's core privacy requirement) and the 404 contract, both of which only real integration tests against SQLite can meaningfully verify.

**Alternatives considered**: Skipping the unit test file entirely since integration tests already cover both branches — rejected: NFR-0001 still requires Domain Logic changes to have unit test coverage regardless of size; the unit test here is cheap (two cases) and keeps parity with how every other Domain Logic method in this codebase is tested, so skipping it would be an unjustified exception rather than a meaningful simplification.
