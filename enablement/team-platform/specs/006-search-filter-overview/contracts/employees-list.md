# Interface Contract: Employee List Gap Closure (EPIC-0006)

Authoritative source: `specs/contracts/openapi-spec.yaml` — `GET /employees`, `EmployeeSummary`. Both were already ratified with `minAvailability`, `sort` including `utilization`, and `currentProjectNames` before this epic — this epic implements what the contract already commits to; it does not change the contract itself.

## `GET /employees` — query parameters (delta from what's already implemented)

| Parameter | Status before this epic | Status after this epic |
|---|---|---|
| `skill`, `proficiency`, `seniority` | Implemented | Unchanged |
| `minAvailability` | Ratified, unimplemented | Implemented — filters to employees with at least this much available capacity %. Validated: integer 0–100 inclusive; negative, non-numeric, non-integer, or >100 → `400 VALIDATION_ERROR` |
| `sort=name`, `sort=employmentStartDate` | Implemented | Unchanged |
| `sort=utilization` | Ratified, unimplemented | Implemented |
| `order` | Implemented | Unchanged |

## `EmployeeSummary.currentProjectNames`

| Status before this epic | Status after this epic |
|---|---|
| Always `[]` | Real, de-duplicated current (`temporalStatus: "current"`) project names for the employee |

## Domain Logic Contract

`EmployeeService.listEmployees(filters: EmployeeListFilters): Promise<Array<EmployeeRecord & { currentUtilizationPercent: number }>>` — see data-model.md for the full behavior contract (filtering, sorting, and the new `AssignmentService` dependency).

## Route Contract

`employees.routes.ts`'s `GET /` handler:
1. Parses `minAvailability` (numeric, optional) alongside the existing filters.
2. Calls `service.listEmployees(filters)` — now returns utilization-annotated, filtered/sorted records.
3. For each returned employee, composes `currentProjectNames` via `assignmentService.listEmployeeAssignments(employeeId)`, filtered to `temporalStatus === "current"`, mapped to `projectName`, de-duplicated.
4. No longer makes a separate `getCurrentUtilization` call — reads `currentUtilizationPercent` from the record `EmployeeService.listEmployees` already returned.
