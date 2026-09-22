# Phase 1 Data Model: Employee Self-Service (EPIC-0005)

This epic introduces **no new persisted entity and no schema change**. It is a read model assembled entirely from existing data.

## Read Model: My-Assignments View

Not a stored entity — assembled on each request by `self-service.service.ts` from existing sources.

| Field | Source | Notes |
|---|---|---|
| `employeeId` | `EmployeeRepository.findById` (EPIC-0001) | Echoes the requested ID; also the key used for the not-found check. |
| `name` | `EmployeeRepository.findById` (EPIC-0001) | Unchanged from the Employee entity. |
| `currentUtilizationPercent` | `AssignmentService.getCurrentUtilization` (EPIC-0003, shared) | The same value returned by the Employee response, the candidates endpoint, and the bench view for this employee — never recomputed independently (this is the spec's SC-002). |
| `assignments` | `AssignmentService.listEmployeeAssignments` → `AssignmentRepository.findAllForEmployee` (EPIC-0003, existing, unfiltered) | Full history — past, current, and future — matching the `Assignment` schema already used elsewhere in the OpenAPI spec. No new filtering or temporal-status computation is added by this epic. |

## Not-Found Handling

| Condition | Behavior |
|---|---|
| `employeeId` does not resolve via `EmployeeRepository.findById` | `self-service.service.ts` throws the existing `EmployeeNotFoundError` (EPIC-0001), mapped by the existing error-handling middleware to `404 { error_code: "NOT_FOUND", message: ... }` (SDP NFR-0005/ADR-0009) — the same generic `NOT_FOUND` code shared by every other epic's not-found errors (`ProjectNotFoundError`, `AssignmentNotFoundError`, etc.), not a dedicated `EMPLOYEE_NOT_FOUND` code. No new error type. |

## Explicitly Not Modified

- `Employee` entity (EPIC-0001) — read-only in this epic.
- `Assignment` entity (EPIC-0003) — read-only in this epic.
- `date-utils.ts` (EPIC-0003) — not touched; `getCurrentUtilization` already encapsulates the one date comparison this view needs (`includesToday`), and full history requires no date filtering at all.
