# Feature Specification: Search, Filter & Employee Overview — Backend Gap Closure (EPIC-0006)

**Feature Branch**: `006-search-filter-overview`

**Created**: 2026-09-22

**Status**: Implemented

**Input**: User description: "Implement the backend portion of EPIC-0006 (Search, Filter & Employee Overview UI) from the PRD, covering the confirmed gaps in FR-0025 and FR-0027 — FR-0026 is already fully implemented and is explicitly NOT in scope for this epic. Specific gaps to close, per the completed codebase audit: (1) FR-0025's missing minAvailability filter, (2) FR-0025's missing sort=utilization option, (3) FR-0027's hardcoded-empty currentProjectNames."

**Source of truth**: Per the project constitution, this spec does not restate requirements in new language where the PRD and OpenAPI spec already define them precisely. Functional Requirements below reference `specs/PRD-Team-Allocation-Platform.md` FR-0025 and FR-0027 directly, and `GET /employees` in `specs/contracts/openapi-spec.yaml` (already ratified with the `minAvailability` filter and `sort=utilization` option) is the authoritative API contract.

**Scope note — this is a gap-closure epic, not a from-scratch build**: A codebase audit against FR-0025–FR-0027 (conducted immediately before this spec) found `GET /projects` (FR-0026) already fully implements every ratified filter/sort. `GET /employees` (FR-0025) already implements skill/proficiency/seniority filters and name/employmentStartDate sorting. This spec's entire scope is the three specific, confirmed gaps listed below — it is not a re-specification of FR-0025/FR-0026/FR-0027 from zero.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter the employee list by available capacity (Priority: P1)

A Manager filters the employee list down to only those with at least a given amount of available (unassigned) capacity, so they can find who has real room without paging through everyone.

**Why this priority**: This is a ratified-but-unwired contract gap — the OpenAPI spec already commits to `minAvailability`, so closing it is a correctness fix, not new design work, and it's the most directly actionable of the three gaps.

**Independent Test**: Can be fully tested by creating employees at varying utilization levels (0%, 50%, 100%) and confirming `GET /employees?minAvailability=N` returns exactly the employees whose available capacity (`100 - currentUtilizationPercent`) is at least `N`.

**Acceptance Scenarios**:

1. **Given** an employee at 60% utilization (40% available) and another at 90% utilization (10% available), **When** a Manager requests `GET /employees?minAvailability=30`, **Then** only the 60%-utilized employee appears.
2. **Given** an employee with zero assignments (100% available), **When** a Manager requests `GET /employees?minAvailability=100`, **Then** that employee appears.
3. **Given** `minAvailability` is combined with an existing filter (e.g., `skill`), **When** the request is made, **Then** both filters apply together (an employee must match both to appear), consistent with how the existing filters already compose.

---

### User Story 2 - Sort the employee list by utilization (Priority: P1)

A Manager sorts the employee list by current utilization %, ascending or descending, so the most- or least-available employees surface first without manual scanning.

**Why this priority**: Equally a ratified-but-unwired contract gap, and — combined with User Story 1 — completes FR-0025's utilization-related capabilities together as one coherent slice.

**Independent Test**: Can be fully tested by creating employees at distinct utilization levels and confirming `GET /employees?sort=utilization&order=asc` (and `desc`) returns them in the correct utilization order.

**Acceptance Scenarios**:

1. **Given** three employees at 20%, 80%, and 50% utilization, **When** a Manager requests `GET /employees?sort=utilization&order=asc`, **Then** they are returned in the order 20%, 50%, 80%.
2. **Given** the same three employees, **When** a Manager requests `GET /employees?sort=utilization&order=desc`, **Then** they are returned in the order 80%, 50%, 20%.
3. **Given** two employees at identical utilization, **When** sorted by utilization, **Then** their relative order is stable and doesn't error (no requirement on tie-breaking beyond "doesn't crash" — see Assumptions).

---

### User Story 3 - See each employee's current projects at a glance (Priority: P1)

A Manager viewing the employee list sees each employee's current project name(s) alongside their utilization %, without opening each employee's detail record (FR-0027).

**Why this priority**: This closes a real, previously-undisclosed data gap (`currentProjectNames` is hardcoded to `[]` today) that blocks any future frontend work on FR-0027's "at a glance" list — equally P1 since it's the other half of what makes the employee list actually useful for staffing decisions, alongside utilization.

**Independent Test**: Can be fully tested by assigning an employee to one or more currently-active projects and confirming `GET /employees` returns their real, current project name(s) in `currentProjectNames` — not an empty array.

**Acceptance Scenarios**:

1. **Given** an employee with one current assignment to "Platform Revamp," **When** the employee list is requested, **Then** that employee's `currentProjectNames` is `["Platform Revamp"]`.
2. **Given** an employee with two concurrent current assignments to different projects, **When** the employee list is requested, **Then** `currentProjectNames` contains both project names.
3. **Given** an employee with only past or only future assignments (none current), **When** the employee list is requested, **Then** `currentProjectNames` is `[]` — matching the existing "current-only" convention already established for this exact field's temporal scoping elsewhere in the system (the bench view and org-wide report both scope to current-only, not full history).
4. **Given** a never-staffed employee, **When** the employee list is requested, **Then** `currentProjectNames` is `[]`, not an error.

---

### Edge Cases

- What happens when `minAvailability` is combined with `sort=utilization`? Both apply together — filtering and sorting are independent operations already composed this way for every other existing filter/sort combination on this endpoint.
- What happens when `minAvailability=0`? Every employee matches (0% available capacity is still "at least 0"), including a fully-booked (100% utilized) employee — this is a valid, non-error edge case.
- What happens when an employee has multiple current assignments to the *same* project (e.g., two different roles on one project)? `currentProjectNames` MUST NOT contain duplicate project names — the project appears once regardless of how many current assignments reference it.
- What happens when `sort=utilization` is requested for a list with zero employees? Returns an empty array, not an error — consistent with every other list endpoint's empty-state handling in this system.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-0025** (PRD, partial — the two confirmed gaps only): Manager can filter the employee list by minimum available capacity % (`minAvailability` query parameter, already ratified in `openapi-spec.yaml`) and sort it by current utilization % (`sort=utilization`, already ratified). The existing skill/proficiency/seniority filters and name/employmentStartDate sorts are unaffected and out of this spec's scope (already implemented).
- **FR-0027** (PRD): The employee list response (`EmployeeSummary`, via `GET /employees`) MUST include each employee's real current project name(s) in `currentProjectNames`, computed from their assignments with `temporalStatus: "current"` — not the hardcoded `[]` currently returned.
- Filtering, sorting, and `currentProjectNames` computation MUST all reuse the existing shared utilization/temporal-status logic (`AssignmentService.getCurrentUtilization`, `date-utils.ts`'s `includesToday`) — no independently reimplemented date or utilization logic, consistent with SDP NFR-0009 and this project's established centralization principle.

### Key Entities

- No new persisted entity. This epic is entirely a query/response-shape correction over existing `Employee` (EPIC-0001), `Assignment` (EPIC-0003), and `Project` (EPIC-0002) data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Manager can filter the employee list to exactly those employees with at least a given available capacity %, verified end-to-end via integration tests across the boundary values (0%, an exact-match value, and a value excluding everyone).
- **SC-002**: A Manager can sort the employee list by utilization % in both directions and receive a correctly ordered result, verified via integration tests.
- **SC-003**: 100% of employee list responses show each employee's real current project name(s) — not a hardcoded empty array — verified via integration tests covering zero, one, and multiple concurrent current assignments.
- **SC-004** *(conditional on the test-coverage decision below)*: The employee list's pre-existing skill/proficiency/seniority filters and the project list's status/required-role/date-range filters and name/date sorts (FR-0025's already-implemented capabilities and all of FR-0026) gain integration test coverage, closing the audit's "implemented but untested" finding alongside this epic's new work.

## Assumptions

- This spec covers only the backend gap-closure portion of EPIC-0006: FR-0025's `minAvailability` filter and `sort=utilization`, and FR-0027's `currentProjectNames`. FR-0026 (project search/filter/sort) is explicitly out of scope — the codebase audit confirmed it is already fully implemented against the ratified contract. No frontend/UI work is in scope, consistent with every prior epic in this project.
- **Resolved gap in the project's own discharge-tracking process, not just in the code — documented here as the user explicitly required.** Every other interim-stub/forward-reference gap in this project's history (e.g., `hasAnyAssignments`, `affectedProjectRoleCount`, the org-wide report's current-only scope) was explicitly flagged in its originating epic's `data-model.md` or `tasks.md` as a known, tracked placeholder, to be discharged by a specific later epic — and every one of those was in fact later discharged with both epics' docs updated to `✅ RESOLVED`. `currentProjectNames` was different in kind: it was introduced in EPIC-0001's OpenAPI schema and hardcoded to `[]` in the route from the start, but — unlike every other stub — it was never flagged anywhere as a forward reference to be discharged later. It surfaced only now, via an explicit ad hoc codebase audit against FR-0025–FR-0027 conducted ahead of this spec, not via the project's own tracking process. **Root cause**: the discharge-tracking pattern in this project has consistently relied on each epic's author to notice and flag their own interim stubs at the time they're introduced (a self-reporting mechanism), and EPIC-0001 simply didn't do so for this one field — there was no independent, systematic check (e.g., "grep every OpenAPI schema field against every route's actual computation") that would have caught an unflagged stub rather than relying on it being self-disclosed. This is a real gap in the *process*, not only in the code, and is recorded here so a future epic doesn't assume every remaining gap in this codebase has necessarily been self-flagged already.
- **Utilization-sort tie-breaking is unspecified beyond "must not error."** Where two employees share identical utilization %, no secondary sort key (e.g., name) is required by this spec — any stable, deterministic order is acceptable. If a future epic needs guaranteed tie-breaking (e.g., for UI pagination stability), that would be a new, explicitly scoped requirement, not an implicit expectation of this one.
- **`currentProjectNames` is scoped to current-only, matching the field's evident intent and this system's established convention.** FR-0027 says "current project assignments" explicitly (not history), and every other current-vs-history scoping decision already made in this project (the bench view, the org-wide and per-project reports) uses `temporalStatus: "current"` as the same cutoff. This spec adopts the same convention rather than inventing a new one.
- **Test coverage for the existing, working-but-untested FR-0025/FR-0026 parameters is in scope, not deferred — an explicit decision, not a silent default.** The codebase audit found `skill`/`proficiency`/`seniority` filtering and `name`/`employmentStartDate` sorting (FR-0025's already-implemented half) and all of FR-0026's `status`/`requiredRole`/date-range filters and `name`/`startDate`/`endDate` sorting work correctly but have zero existing test coverage. Per the user's explicit request, this was flagged as an open decision rather than silently assumed either way; the recommendation — **adopted here** — is yes: while this epic is already touching `employees.routes.ts`'s query-handling logic and its test files for the `minAvailability`/`sort=utilization` work, extending the same test files to cover the pre-existing, already-correct parameters is a natural, low-marginal-cost way to close that separate audit finding at the same time, rather than leaving it open indefinitely as unrelated work nobody circles back to. This does not touch `projects.routes.ts`'s implementation (FR-0026 has no code gap), only adds test coverage for it.
