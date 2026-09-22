# Feature Specification: Assignment Engine (EPIC-0003)

**Feature Branch**: `003-assignment-engine`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Implement EPIC-0003 (Assignment Engine) from the PRD, covering FR-0013 through FR-0018: create an assignment (employee, project role, capacity %, date range) with hard-blocked capacity validation (sum of overlapping-date capacity ≤100%, per FR-0014's inclusive-overlap-on-any-shared-day rule), restriction to Active projects only (FR-0015), edit/cancel restricted to future-dated assignments only (FR-0016/FR-0017, including the history-rewrite-prevention rule already resolved during the PRD stage), and the server-side skill-match tier computation (FR-0018) for the candidates endpoint."

**Source of truth**: Per the project constitution, this spec does not restate requirements in new language where the PRD and OpenAPI spec already define them precisely. Functional Requirements below reference `specs/PRD-Team-Allocation-Platform.md` FR-0013–FR-0018 directly, and relevant paths in `specs/contracts/openapi-spec.yaml` (`/assignments`, `/assignments/{assignmentId}`, `/projects/{projectId}/roles/{roleId}/candidates`) are the authoritative API contract.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a capacity-safe assignment (Priority: P1)

A Resource/Delivery Manager assigns an employee to a project role at a given capacity % and date range. The system enforces, as a hard block with no override, that the employee's total capacity across all overlapping-date assignments never exceeds 100%, and that assignments can only be created against Active projects.

**Why this priority**: This is the core value proposition of the entire platform — every other feature (bench visibility, reporting, self-service) depends on assignment data existing and being trustworthy. Without the capacity guarantee, the system provides no more protection than a spreadsheet.

**Independent Test**: Can be fully tested by creating a valid assignment (succeeds), attempting one that would push an employee over 100% capacity on overlapping dates (blocked), and attempting one against a non-Active project (blocked) — delivers the core capacity-safety guarantee on its own, independent of editing/cancellation.

**Acceptance Scenarios**:

1. **Given** an employee with less than 100% capacity already committed on the requested date range, **When** a Manager creates an assignment for that employee at a capacity % that keeps the total at or below 100%, **Then** the system creates the assignment (FR-0013) and returns the new record.
2. **Given** an employee whose existing assignments already overlap the requested date range, **When** a Manager attempts to create an assignment that would push the summed capacity above 100% for any overlapping day, **Then** the system rejects the creation outright with a structured error, with no override path (FR-0014).
3. **Given** a project role belonging to a Draft, Completed, or Cancelled project, **When** a Manager attempts to create an assignment against that role, **Then** the system rejects the creation with a structured error explaining the project must be Active (FR-0015).
4. **Given** a capacity % of exactly 0, or greater than 100, **When** a Manager attempts to create an assignment with that value, **Then** the system rejects the creation (FR-0013, mirroring the same floor already applied to project role capacity in EPIC-0002).

---

### User Story 2 - Edit or cancel a future-dated assignment only (Priority: P2)

A Manager can adjust the role, capacity %, or dates of an assignment, or cancel it outright — but only while the assignment's start date is still in the future. Once an assignment has started (today or in the past), it becomes a permanent historical record that cannot be edited or deleted, preventing the system from being used to quietly rewrite what actually happened.

**Why this priority**: This is a data-integrity guarantee layered on top of User Story 1's capacity guarantee — assignments have no value as a system of record if their history can be silently altered after the fact. It depends on assignments existing (P1) but is a distinct, independently verifiable rule.

**Independent Test**: Can be fully tested by creating a future-dated assignment, editing it successfully, then advancing past its start date (or creating one already-started) and confirming both edit and cancel are rejected — independently verifiable without needing the skill-match feature.

**Acceptance Scenarios**:

1. **Given** an assignment whose start date is in the future, **When** a Manager edits its role, capacity %, or dates, **Then** the system applies the change after re-running the same capacity and active-project validation as creation (FR-0016).
2. **Given** an assignment whose start date is today or in the past, **When** a Manager attempts to edit it, **Then** the system rejects the edit with a structured error explaining the assignment has already started (FR-0016).
3. **Given** an assignment whose start date is in the future, **When** a Manager cancels it, **Then** the system deletes the assignment and immediately frees the associated capacity (FR-0017).
4. **Given** an assignment whose start date is today or in the past, **When** a Manager attempts to cancel it, **Then** the system rejects the deletion with a structured error explaining the assignment's history must be preserved (FR-0017).

---

### User Story 3 - See an advisory skill-match signal when choosing a candidate (Priority: P3)

Before creating an assignment, a Manager can list every employee as a candidate for a given project role, with each candidate annotated by a computed match tier (Strong / Partial / No match / No requirement) based on the role's required skills and the employee's proficiency. This signal is informational only — it never filters or blocks candidate selection.

**Why this priority**: This improves the quality of staffing decisions but is not load-bearing the way capacity safety (P1) or history integrity (P2) are — an assignment can be created without ever viewing the candidate list. It is prioritized last within this epic.

**Independent Test**: Can be fully tested by requesting the candidate list for a role with required skills and confirming every employee appears (none filtered out) with the correct tier, independent of whether any assignment is ever actually created from that list.

**Acceptance Scenarios**:

1. **Given** a project role with one or more required skills, **When** a Manager requests the candidate list for that role, **Then** every employee is returned (FR-0018), each annotated with a match tier: **Strong** if the employee has every required skill at Intermediate or Expert proficiency; **Partial** if the employee has at least one but not all required skills, or has all of them but at least one only at Beginner proficiency; **No match** if the employee has none of the required skills.
2. **Given** a project role with zero required skills, **When** a Manager requests the candidate list, **Then** every employee is returned with a tier of **No requirement** rather than any of the three skill-based tiers.
3. **Given** an employee with no matching skills for a role, **When** the candidate list is requested, **Then** that employee still appears in the list (marked "No match") — the endpoint never filters or blocks selection.

---

### Edge Cases

- What happens when an assignment's date range partially overlaps another assignment's date range (not fully contained, not identical)? The system MUST sum capacity across the overlapping days only, per FR-0014's "inclusive overlap on any shared day" rule — any day shared between two date ranges counts toward the 100% ceiling for that day, regardless of how much of either range is shared.
- What happens when a Manager edits an assignment's dates such that it no longer overlaps an assignment it previously conflicted with, but now overlaps a different one? The capacity check MUST be re-run against the edited date range and role, using the employee's *other* assignments (excluding the one being edited) — not against the assignment's previous state.
- What happens when an assignment is created with a start date of today? Per the future/past rule (FR-0016/FR-0017), "today" does not qualify as future — such an assignment cannot be edited or cancelled once created, even though it was just created. This is a deliberate consequence of the already-ratified rule, not a new decision.
- What happens when a Manager requests candidates for a role on a project that isn't Active (e.g., Draft)? The candidates endpoint itself is read-only and advisory (FR-0018); it MUST still return the full candidate list regardless of project status — only assignment *creation* is restricted to Active projects (FR-0015), not the candidate preview.
- What happens when a Manager tries to create an assignment against a project role that has itself been removed? The system MUST reject it with a not-found error, since a removed role cannot be a valid assignment target — this is a natural consequence of the existing foreign-key relationship, not a new rule invented here.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-0013** (PRD): Manager can assign an employee to a specific required role on a project, specifying a capacity % (greater than 0, up to 100) and a date range (defaulting to the project's dates, adjustable within them). Maps to `POST /assignments`.
- **FR-0014** (PRD): The system computes, for the assigned employee, the sum of capacity % across all of that employee's assignments whose date ranges overlap the new/edited assignment's date range (inclusive overlap on any shared day). If this sum would exceed 100%, the system rejects the create/edit outright with no override path. This is the single, complete scheduling-conflict rule for this epic — there is no separate rule prohibiting date-range overlap independent of the capacity math.
- **FR-0015** (PRD): An assignment can only be created against a project whose status is Active. Attempting to assign against a Draft, Completed, or Cancelled project is rejected. Maps to a validation step within `POST /assignments`.
- **FR-0016** (PRD): Manager can edit an existing assignment's role, capacity %, or date range, but only if the assignment's start date is in the future (today's date or earlier does not qualify). Every permitted edit re-runs the same capacity validation defined in FR-0014, evaluated against the employee's other assignments (excluding the assignment being edited). Maps to `PATCH /assignments/{assignmentId}`.
- **FR-0017** (PRD): Manager can cancel an assignment whose start date is in the future; this is a free deletion since no capacity has actually been consumed yet. Deleting an assignment whose start date is today or in the past is blocked — historical assignment records cannot be removed. Maps to `DELETE /assignments/{assignmentId}`.
- **FR-0018** (PRD): When listing candidate employees for a project role, the system displays a match tier for each candidate employee, computed as described in User Story 3's Acceptance Scenarios. This indicator is informational only; it never filters or blocks employee selection. Maps to `GET /projects/{projectId}/roles/{roleId}/candidates`.
- Every non-2xx response from the endpoints above MUST use the `{ error_code, message }` error envelope (SDP NFR-0005/ADR-0009), with distinct codes for at least: capacity-exceeded, project-not-active, assignment-not-editable (past/current), assignment-not-cancellable (past/current), and not-found conditions.

### Key Entities

- **Assignment**: Links one Employee to one ProjectRole at a specific capacity % and date range. This is the entity whose existence discharges the interim stubs in EPIC-0001 (`Employee.hasAnyAssignments`) and EPIC-0002 (`Project.hasAnyAssignments`, `ProjectRole.roleHasAnyAssignments`) — see Assumptions.
- **Employee** (reused from EPIC-0001, not redefined here): Referenced by an Assignment's employee side; this epic queries existing employee and employee-skill data (for FR-0018's match tier). This epic modifies `employees.routes.ts`'s **response shape only** — replacing the hardcoded `currentUtilizationPercent: 0` and `assignments: []` placeholders with real computed values (see Assumptions and Key Entities → Assignment) — but does not touch `EmployeeService` or `employee.repository.ts`'s CRUD/management logic, which remain exactly as EPIC-0001 implemented them.
- **ProjectRole** (reused from EPIC-0002, not redefined here): Referenced by an Assignment's role side; this epic queries existing project/role data (for FR-0015's active-project check and FR-0018's required-skills) but does not modify Project or ProjectRole management endpoints.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of assignment creation/edit attempts that would push an employee's overlapping-date capacity above 100% are rejected, verified end-to-end via integration tests — this is the platform's central guarantee and is fully verifiable within this epic (unlike EPIC-0001/EPIC-0002's disclosed interim stubs, which depended on this epic's table existing).
- **SC-002**: 100% of edit/cancel attempts against an assignment whose start date is today or in the past are rejected, verified end-to-end via integration tests.
- **SC-003**: 100% of assignment creation attempts against a non-Active project are rejected, verified end-to-end via integration tests.
- **SC-004**: A Manager can view a role's full candidate list, with every employee annotated by an accurate match tier and none filtered out, in a single request.
- **SC-005**: Once this epic lands, 100% of the three interim stubs disclosed in EPIC-0001 (`Employee.hasAnyAssignments`) and EPIC-0002 (`Project.hasAnyAssignments`, `ProjectRole.roleHasAnyAssignments`) are replaced with real existence queries and verified end-to-end — closing the loop on FR-0003, FR-0011, and FR-0012's actual delete/removal protection, which was previously unenforceable in practice.
- **SC-006**: Once this epic lands, the Employee response's `currentUtilizationPercent` and embedded `assignments` reflect real data instead of the EPIC-0001 hardcoded placeholder (`0` and `[]` respectively), verified end-to-end via integration tests. This item was discovered during this epic's design (EPIC-0001's `data-model.md` already documented it as depending on this exact epic) rather than named in the original planning input — see Assumptions.

## Assumptions

- This spec covers only EPIC-0003 (Assignment Engine) as scoped by the user's request: FR-0013 through FR-0018. Bench, Reports, and Employee Self-Service are explicitly out of scope for this feature and will be specified separately, each on its own feature branch — though both structurally depend on this epic's `assignments` table existing once they are specified.
- No authentication/authorization exists (per SDP ADR-0011); all actions in this spec are implicitly performed by the Manager role, consistent with the UX Specification's role-switcher model. The Employee role has no write access to any endpoint in this epic, and the read-only candidates endpoint is Manager-facing (per the UX Spec's assignment-creation flow), not exposed to the Employee role.
- **This epic is explicitly where EPIC-0001's and EPIC-0002's disclosed interim stubs get discharged — this is planned scope, not an afterthought.** Specifically: (1) `Employee.hasAnyAssignments` (EPIC-0001, flagged in that epic's `data-model.md` and tracked as `tasks.md` T044), (2) `Project.hasAnyAssignments` and (3) `ProjectRole.roleHasAnyAssignments` (EPIC-0002, flagged in that epic's `data-model.md` and tracked as `tasks.md` T033) all become real existence queries against this epic's `assignments` table. Once discharged, both prior epics' `data-model.md` and `tasks.md` files MUST be updated to mark these follow-ups resolved, exactly as EPIC-0002 did for EPIC-0001's `countProjectRoleAssociations` follow-up. Until this epic's implementation actually does so, FR-0003, FR-0011, and FR-0012's delete/removal protection remains a no-op in practice, even though their business logic and error codes already exist. **(4)** A fourth item, not named in the original planning input but already documented in EPIC-0001's `data-model.md` as "sourced from the Assignment Engine epic once it exists": the `Employee` response's hardcoded `currentUtilizationPercent: 0` and `assignments: []` in `employees.routes.ts` are likewise replaced with real computed values (via the shared `AssignmentService.getCurrentUtilization` function — see Key Entities → Assignment and `data-model.md`/`research.md`). This was discovered during this epic's design and folded into scope rather than left as a second dangling forward-reference.
- The shared date-comparison utility required by SDP NFR-0009 is implemented once in this epic (since this is the first epic whose rules genuinely require date-overlap and "is this date in the future" logic) and MUST be the single source of "today" and "overlap" for: FR-0014's capacity summation, FR-0016/FR-0017's future/past edit/cancel restriction, and (by structural dependency, once specified) the Bench epic's window computation. No piece of this epic may implement its own independent date-comparison logic.
- FR-0014's overlap rule is interpreted literally as stated in the PRD: inclusive overlap on any shared calendar day, at day granularity (per SDP NFR-0009's local-timezone, calendar-day-granularity decision) — not sub-day/time-of-day overlap, and not requiring full date-range containment.
- The skill-match tier computation (FR-0018) reuses EPIC-0001's existing employee-skill proficiency data and EPIC-0002's existing project-role required-skills data as-is; this epic does not modify either entity's schema or validation, only reads from them.
- Demo-scale data volumes apply (tens of employees, a handful of concurrent projects, per the PRD); no pagination is assumed for the candidates or assignment list endpoints, consistent with the BFF Contract.
- **Resolved gap**: the assignment-creation request includes both `projectId` and `roleId` (per the OpenAPI `AssignmentCreateRequest` schema), but the PRD is silent on what happens if a client supplies a `projectId` that doesn't actually match the target role's real parent project. This spec resolves it during planning: the supplied `projectId` MUST match the role's actual parent project, or the request is rejected as invalid — the system never silently trusts a mismatched `projectId` or silently substitutes the role's real parent. See `data-model.md` for the validation rule.
