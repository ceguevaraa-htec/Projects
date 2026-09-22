# Quickstart: Employee Self-Service (EPIC-0005)

## Prerequisites

- Existing dev environment set up per prior epics (`npm install`, SQLite test DB helpers already in place).
- No new setup — this epic adds no dependency, no migration, no environment variable.

## Validation Scenarios

### 1. Full history + utilization for a staffed employee

1. Create an employee.
2. Create a past assignment (end date before today), a current assignment (spans today), and a future assignment (start date after today) for that employee.
3. `GET /employees/{employeeId}/my-assignments`.
4. **Expect**: `200`, `assignments` contains all three, `currentUtilizationPercent` equals the current assignment's `capacityPercent` (matches what `GET /employees/{employeeId}` would report for the same employee — see data-model.md's shared-computation guarantee).

### 2. Never-staffed employee

1. Create an employee with no assignments.
2. `GET /employees/{employeeId}/my-assignments`.
3. **Expect**: `200`, `assignments: []`, `currentUtilizationPercent: 0`.

### 3. Nonexistent employee

1. `GET /employees/00000000-0000-0000-0000-000000000000/my-assignments` (or any ID not present).
2. **Expect**: `404`, `{ error_code: "NOT_FOUND", message: ... }`.

### 4. No cross-employee leakage

1. Create two employees, each with their own distinct assignments.
2. `GET /employees/{employeeA}/my-assignments`.
3. **Expect**: response contains only Employee A's `employeeId`, name, and assignments — none of Employee B's project/role/capacity data appears anywhere in the response.

## Contract Check

Run the existing contract-test suite (`tests/contract/openapi-conformance.test.ts`, extended for this path) to confirm the endpoint's response matches `MyAssignmentsResponse` in `specs/contracts/openapi-spec.yaml` exactly, and that the 404 response matches the shared `NotFoundError` schema.

See [contracts/self-service.md](./contracts/self-service.md) for the interface contract and [data-model.md](./data-model.md) for field sourcing.
