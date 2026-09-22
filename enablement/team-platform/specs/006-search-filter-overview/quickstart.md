# Quickstart: Search, Filter & Employee Overview — Backend Gap Closure (EPIC-0006)

## Prerequisites

- Existing dev environment (no new dependency, no migration).

## Validation Scenarios

### 1. `minAvailability` filter

1. Create an employee, assign them to 60% capacity (40% available) and another to 90% (10% available).
2. `GET /employees?minAvailability=30`.
3. **Expect**: only the 40%-available employee appears.
4. `GET /employees?minAvailability=-5`, `?minAvailability=abc`, `?minAvailability=150` → **expect**: each rejected with `400`, `error_code: "VALIDATION_ERROR"` (see research.md's validation decision).

### 2. `sort=utilization`

1. Create three employees at 20%, 80%, and 50% utilization.
2. `GET /employees?sort=utilization&order=asc` → expect order 20, 50, 80.
3. `GET /employees?sort=utilization&order=desc` → expect order 80, 50, 20.

### 3. `currentProjectNames`

1. Assign an employee to a current assignment on "Platform Revamp."
2. `GET /employees` → expect that employee's `currentProjectNames` to be `["Platform Revamp"]`, not `[]`.
3. Add a second concurrent current assignment to a different project → expect both names present, no duplicates if two assignments share a project.

### 4. FR-0025/FR-0026 backfill (regression-proofing, not new behavior)

Run the extended `tests/integration/employees.api.test.ts` and `tests/integration/projects.api.test.ts` suites — they now assert `skill`/`proficiency`/`seniority`/`name`/`employmentStartDate` filtering and sorting on `GET /employees`, and `status`/`requiredRole`/date-range/`name`/`startDate`/`endDate` filtering and sorting on `GET /projects`, none of which had test coverage before this epic.

## Contract Check

Run `tests/contract/openapi-conformance.test.ts` to confirm `GET /employees`'s response now includes real `currentProjectNames` and correctly honors `minAvailability`/`sort=utilization`, matching `MyAssignmentsResponse`/`EmployeeSummary` in `specs/contracts/openapi-spec.yaml` exactly (no contract change — implementing what was already ratified).

See [contracts/employees-list.md](./contracts/employees-list.md) and [data-model.md](./data-model.md) for the full behavior contract.
