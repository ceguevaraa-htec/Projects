# Phase 1 Data Model: Search, Filter & Employee Overview — Backend Gap Closure (EPIC-0006)

This epic introduces **no new persisted entity and no schema change**. It corrects a response field and extends existing query capabilities over data every prior epic already created.

## `EmployeeListFilters` — extended

| Field | Status | Notes |
|---|---|---|
| `skill`, `proficiency`, `seniority` | Unchanged | Existing SQL-pushdown filters in `employee.repository.ts`, untouched by this epic. |
| `minAvailability` | **New** | `number` (integer, 0–100 inclusive), optional. Not passed to the repository — consumed entirely in `EmployeeService.listEmployees` after utilization is computed (see research.md). Semantics: include an employee if `100 - currentUtilizationPercent >= minAvailability`. **Validated explicitly**: absent → no filter; present but non-integer, negative, or >100 → `400 VALIDATION_ERROR` (reusing the existing `ValidationError` type, matching `capacityPercent`'s and the bench `window` param's existing strict-validation precedent — not the lenient fallback `sort` uses, which is unrelated pre-existing behavior this epic doesn't touch). See research.md's revised decision. |
| `sort` | **Extended** | Type widens from `"name" \| "employmentStartDate"` to `"name" \| "employmentStartDate" \| "utilization"`. `"utilization"` is handled entirely in `EmployeeService`, not passed through to the repository's SQL `orderBy` (the repository continues to default to `"name"` for any `sort` value it doesn't itself handle, i.e. leaves `"utilization"` requests to sort by name at the SQL layer, since `EmployeeService` re-sorts the full result afterward anyway — the repository's own ordering becomes irrelevant once `EmployeeService` re-sorts, so no repository change is needed for the `"utilization"` case beyond typing). |
| `order` | Unchanged | Applies to whichever sort mode (SQL-level or in-memory) is active. |

## `EmployeeService.listEmployees` — new return shape

| Before this epic | After this epic |
|---|---|
| `Promise<EmployeeRecord[]>` (a one-line passthrough to `EmployeeRepository.findAll`) | `Promise<Array<EmployeeRecord & { currentUtilizationPercent: number }>>` — utilization-annotated, `minAvailability`-filtered, and (when `sort=utilization`) utilization-sorted. |

`EmployeeService` gains a constructor dependency on `AssignmentService` (see research.md) to compute this. The route no longer computes `currentUtilizationPercent` separately for the list endpoint — it reads the value already present on each returned record.

## `EmployeeSummary.currentProjectNames` — corrected

| Before this epic | After this epic |
|---|---|
| Hardcoded `[]` on every response (`employees.routes.ts`) | Computed per employee via `AssignmentService.listEmployeeAssignments(employeeId)` (existing method, already used elsewhere in this same route file), filtered to `temporalStatus === "current"`, mapped to `projectName`, and de-duplicated. |

This composition happens in the route (`employees.routes.ts`'s `GET /` handler), consistent with how this same route already composes `assignments`/`currentUtilizationPercent` for the detail (`GET /:employeeId`) and update (`PATCH /:employeeId`) endpoints from existing `AssignmentService` calls — not a new pattern, an application of the existing one to the list endpoint.

**Accepted N+1 trade-off, deliberate, not incidental**: one `findAllForEmployee` call per employee in the list (via `listEmployeeAssignments`), same cost class already accepted by `bench.service.ts` and `reports.service.ts`'s org-wide report for the identical reason at the identical (demo) scale. See research.md's explicit trade-off statement.

## No changes to `ProjectListFilters` or any project-repository query logic

FR-0026 is out of scope (already fully implemented, per the codebase audit). This epic's only touch on the project side is test-only: backfilling integration test coverage for the already-correct `status`/`requiredRole`/`startDateFrom`/`startDateTo`/`sort` behavior in `projects.routes.ts`/`project.repository.ts`, with zero production code changes to either file.
