# Feature Specification: Employee Self-Service (EPIC-0005)

**Feature Branch**: `005-employee-self-service`

**Created**: 2026-09-22

**Status**: Implemented

**Input**: User description: "Implement EPIC-0005 (Employee Self-Service) from the PRD, covering FR-0024: an employee can view their own current, future, and past assignments (project, role, capacity %, dates) and their current utilization %, with no visibility into any other employee's data or org-wide information."

**Source of truth**: Per the project constitution, this spec does not restate requirements in new language where the PRD and OpenAPI spec already define them precisely. The Functional Requirement below references `specs/PRD-Team-Allocation-Platform.md` FR-0024 directly, and `GET /employees/{employeeId}/my-assignments` in `specs/contracts/openapi-spec.yaml` is the authoritative API contract.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my own assignments and utilization (Priority: P1)

An Employee, after identifying themselves via the role-switcher's "select yourself" picker (an already-resolved UX gap — see Assumptions), views their own current, future, and past assignments (project, role, capacity %, dates) and their current utilization %, with no access to any other employee's data or org-wide information.

**Why this priority**: This is the entirety of the epic's scope — a single, self-contained read view. There is no secondary story; the whole epic is one independently testable slice.

**Independent Test**: Can be fully tested by seeding an employee with a mix of past, current, and future assignments, requesting `GET /employees/{employeeId}/my-assignments` for that employee's ID, and confirming the response contains exactly that employee's own data (all three temporal categories of assignment, plus current utilization %) and no other employee's data.

**Acceptance Scenarios**:

1. **Given** an employee with past, current, and future assignments, **When** their `my-assignments` view is requested, **Then** the response includes all of those assignments (project, role, capacity %, dates) and the employee's current utilization %, matching the same utilization figure shown elsewhere in the system for that employee (FR-0024).
2. **Given** an employee with zero assignments (never staffed), **When** their `my-assignments` view is requested, **Then** the response returns successfully with an empty assignments list and 0% current utilization, not an error.
3. **Given** a request for one employee's `my-assignments` view, **When** the response is inspected, **Then** it contains only that employee's own identity and assignment data — no other employee's records, and no org-wide aggregate figures.
4. **Given** a nonexistent `employeeId`, **When** their `my-assignments` view is requested, **Then** the system rejects the request with a structured not-found error rather than an empty or malformed 200 response.

---

### Edge Cases

- What happens when the selected employee has never been assigned to any project? They MUST see an empty assignment list and 0% utilization — a valid, expected state, not an error (consistent with how an unstaffed employee is treated elsewhere, e.g., the bench view in EPIC-0004).
- What happens when an invalid or nonexistent `employeeId` is supplied (e.g., a stale picker selection after the employee record was deleted)? The system MUST return a structured not-found error (`EmployeeNotFoundError` → 404), the same pattern used by every other epic's employee-scoped endpoint.
- What happens if a Manager tries to use this same endpoint to look at another employee's data? Nothing in this epic prevents it at the API level — per SDP ADR-0011, there is no authentication/authorization layer in this system, and the UX's role-switcher is a client-side convenience, not a security boundary (see Assumptions). The endpoint itself is scoped by whichever `employeeId` is passed; restricting *who* is allowed to pass which ID is explicitly out of scope, consistent with every other epic's treatment of the no-auth constraint.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-0024** (PRD): Employee (via role-switcher, after selecting themselves) can view their own current, future, and past assignments (project, role, capacity %, dates) and their current utilization %. No other employee's data or org-wide data is visible in this view. Maps to `GET /employees/{employeeId}/my-assignments`.
- The response MUST include the employee's full assignment history (past, current, and future — unfiltered), not just current assignments, matching FR-0022's per-employee report scope (the one other view in the system with the same full-history requirement).
- The response's `currentUtilizationPercent` MUST be computed by the same shared utilization logic used everywhere else in the system (the Employee response, the assignment-candidates endpoint, the bench view, and the per-employee report), so this view's number can never drift from what any other feature reports for the same employee.
- A request for a nonexistent `employeeId` MUST return a 404 using the `{ error_code, message }` error envelope (SDP NFR-0005/ADR-0009), the same `EmployeeNotFoundError` pattern used by every other employee-scoped endpoint in the system.

### Key Entities

- **My-assignments view** (read model, not a stored entity): One employee's own identity, full assignment history, and current utilization %, computed entirely from existing `Employee` (EPIC-0001) and `Assignment` (EPIC-0003) data. This epic introduces no new persisted entity and no new schema — it is a read-only, employee-scoped re-presentation of data every prior epic already created.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Employee can retrieve their own complete assignment history (past, current, and future) and current utilization % in a single request, verified end-to-end via integration tests covering all three temporal categories.
- **SC-002**: The utilization % shown in this view is identical to the utilization % shown for the same employee in every other feature that reports it (Employee list/detail, candidate matching, bench view, per-employee PDF report), verified by asserting all call sites share one implementation rather than independently computing the figure.
- **SC-003**: 100% of requests against a nonexistent `employeeId` are rejected with a structured not-found error rather than an empty or malformed 200 response, verified end-to-end via integration tests.

## Assumptions

- This spec covers only EPIC-0005 (Employee Self-Service) as scoped by the user's request: FR-0024. Search/Filter UI enhancements (EPIC-0006) and any frontend/UI implementation are explicitly out of scope for this feature and will be handled separately — this remains a backend API epic, consistent with every prior epic in this project.
- **The "select yourself" employee-picker step is not part of this epic's scope.** Per the UX Specification's already-resolved identity gap (v1.1, "Employee self-service identity"), the role-switcher's picker reuses the existing `GET /employees` endpoint from EPIC-0001 as-is. This epic adds no new picker/listing endpoint; it only adds the `my-assignments` endpoint the picker's selection ultimately calls into.
- **No authentication/authorization exists (per SDP ADR-0011).** The role-switcher, including the "select yourself" step, is a purely client-side UI convenience, not a security boundary (per the UX Specification's Access & Session Management section). This epic does not add any server-side restriction on which `employeeId` a caller may request — that would be an authorization feature explicitly out of scope for this system, consistent with every other epic's treatment of the same constraint.
- **This endpoint introduces no new date logic.** Full assignment history comes from `AssignmentRepository.findAllForEmployee` (EPIC-0003), already unfiltered by design — no new query, no new date-comparison logic, and no change to `date-utils.ts` is needed.
- **This endpoint introduces no new utilization computation.** `currentUtilizationPercent` is computed via the existing shared `AssignmentService.getCurrentUtilization`, the same function already reused by the Employee response (EPIC-0001/EPIC-0003), the assignment-candidates endpoint (EPIC-0003), and the bench view (EPIC-0004) — reused again here, not recomputed independently.
- No new persisted entities and no PDF/report concerns are introduced by this epic — it is a single read-only JSON endpoint over data every prior epic already created.
