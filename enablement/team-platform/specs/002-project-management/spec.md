# Feature Specification: Project Management (EPIC-0002)

**Feature Branch**: `002-project-management`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Implement EPIC-0002 (Project Management) from the PRD, covering FR-0009 through FR-0012: create/edit/delete projects with status lifecycle (Draft/Active/Completed/Cancelled), and define/edit/remove required roles per project (role name, target capacity %, required skills) with role removal blocked if any assignment references it (FR-0011) and project deletion blocked if any assignment exists (FR-0012)."

**Source of truth**: Per the project constitution, this spec does not restate requirements in new language where the PRD and OpenAPI spec already define them precisely. Functional Requirements below reference `specs/PRD-Team-Allocation-Platform.md` FR-0009–FR-0012 directly, and relevant paths in `specs/contracts/openapi-spec.yaml` (`/projects`, `/projects/{projectId}`, `/projects/{projectId}/roles`, `/projects/{projectId}/roles/{roleId}`) are the authoritative API contract.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain the project roster with a status lifecycle (Priority: P1)

A Resource/Delivery Manager creates, edits, and deletes projects, moving each through a status lifecycle (Draft → Active → Completed/Cancelled) that governs whether the project can be staffed. Deletion is blocked whenever the project has any assignment history, mirroring the same protection already applied to employees in EPIC-0001.

**Why this priority**: Nothing else in this epic — required roles, and later the Assignment Engine epic's staffing — can function without a project existing and having a well-defined status. This is the true MVP slice.

**Independent Test**: Can be fully tested by creating a project in Draft status, transitioning it through the allowed status graph, editing its dates, and attempting to delete both a project with no assignments (succeeds) and one with assignments (blocked with an explanatory error) — delivers a usable project roster on its own, independent of any other epic.

**Acceptance Scenarios**:

1. **Given** no project exists with a given name, **When** a Manager submits valid name and start/end dates, **Then** the system creates the project in Draft status (FR-0009) and returns the new record.
2. **Given** an existing project, **When** a Manager updates its dates or requests a status change, **Then** the system persists the change if the requested transition is valid, or rejects it with a structured error if not (FR-0009).
3. **Given** a project with no assignments, **When** a Manager deletes that project, **Then** the system removes the record (FR-0012).
4. **Given** a project with at least one assignment (past, current, or future), **When** a Manager attempts to delete that project, **Then** the system rejects the deletion with a structured error explaining that assignments exist (FR-0012). *(In this epic, this rule is verified via a unit-level repository test double, since the `assignments` table does not exist until EPIC-0003 — see Assumptions for the interim scope of this guarantee, consistent with the precedent set in EPIC-0001 for `hasAnyAssignments`.)*

---

### User Story 2 - Define and manage a project's required roles (Priority: P2)

A Manager defines the functional roles a project needs — each with a target capacity % and zero or more required skills drawn from the existing skills catalog (EPIC-0001) — and can edit or remove those roles later. Removing a role that assignments already reference is blocked, mirroring EPIC-0001's skill-deletion protection pattern.

**Why this priority**: Required roles have no value until a project exists (P1), and they are the structure the Assignment Engine epic will staff against — the second most foundational piece of this epic.

**Independent Test**: Can be fully tested by adding a required role (with capacity % and optional required skills) to a project, editing its capacity %, and removing it — independently verifiable via the project's own required-roles list, without any assignment data present.

**Acceptance Scenarios**:

1. **Given** a project, **When** a Manager adds a required role with a name, a capacity % greater than 0 and up to 100, and zero or more skills selected from the existing skills catalog, **Then** the system creates the role (FR-0010).
2. **Given** a project's required role, **When** a Manager edits its name, capacity %, or required skills, **Then** the system persists the update (FR-0010).
3. **Given** a project's required role with no assignments referencing it, **When** a Manager removes it, **Then** the system deletes the role (FR-0011).
4. **Given** a project's required role with at least one assignment referencing it, **When** a Manager attempts to remove it, **Then** the system rejects the removal with a structured error explaining that assignments exist (FR-0011). *(Same interim-scope caveat as Acceptance Scenario 4 above — verified via a unit-level test double in this epic, pending EPIC-0003.)*
5. **Given** a project whose status is Completed or Cancelled, **When** a Manager attempts to add, edit, or remove a required role, **Then** the system rejects the request, since role management is only permitted while the project is Draft or Active (FR-0010/FR-0011 — resolved gap, see Assumptions).

---

### Edge Cases

- What happens when a Manager attempts to transition a project directly from Draft to Completed, or from Completed back to Active? The system MUST reject any transition outside the graph Draft→Active→{Completed,Cancelled}, Draft→Cancelled — this mirrors the UX Specification's flagged, now-resolved transition graph, and is enforced server-side per the BFF Contract's `INVALID_STATUS_TRANSITION` decision.
- What happens when a Manager tries to add a required role referencing a skill that does not exist in the catalog? The system MUST reject the role creation/edit, since required skills are only ever selected from the existing EPIC-0001 skills catalog, never free-typed.
- What happens when a Manager tries to add a required role with a capacity % of exactly 0? The system MUST reject it — a 0%-capacity role requirement is meaningless, mirroring the same rule already applied to assignment capacity and employee-skill validation in prior epics.
- What happens when a Manager attempts to delete a project that has only a future-dated (not-yet-started) assignment referencing one of its roles? The system MUST still block the deletion — FR-0012 blocks on any assignment (past, current, or future), not just active ones, mirroring FR-0003's employee rule.
- What happens when a Manager attempts to remove a required role from a project that itself will later be deleted? Role removal and project deletion are independent checks — a Manager must clear all assignments referencing a role before removing it, and all assignments on the project (across all its roles) before deleting the project itself.
- What happens when a Manager attempts to add, edit, or remove a required role on a project that is already Completed or Cancelled? The system MUST reject the request — role management is only permitted while the project is Draft or Active; a Completed or Cancelled project's staffing requirements are frozen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-0009** (PRD): Manager can create a project with a start date, end date, and status (Draft/Active/Completed/Cancelled, default Draft); Manager can edit a project's dates and status, with status changes validated against the transition graph Draft→Active→{Completed,Cancelled}, Draft→Cancelled (no path back from Completed or Cancelled). Maps to `POST /projects` and `PATCH /projects/{projectId}`.
- **FR-0010** (PRD): Manager can add, edit, and remove a project's required roles, each with a role name, a target capacity % (greater than 0, up to 100), and zero or more required skills selected from the existing skills catalog. Role management (add/edit/remove) is only permitted while the project's status is Draft or Active; it is blocked once the project is Completed or Cancelled (a resolved gap in the original requirement — see Assumptions). Maps to `POST /projects/{projectId}/roles` and `PATCH /projects/{projectId}/roles/{roleId}`.
- **FR-0011** (PRD): Removing a required role is blocked if any assignment currently references that role. Maps to `DELETE /projects/{projectId}/roles/{roleId}`.
- **FR-0012** (PRD): Manager can delete a project, provided the project has no assignments (past, current, or future); deletion is blocked with an explanatory error otherwise. Maps to `DELETE /projects/{projectId}`.
- Every non-2xx response from the endpoints above MUST use the `{ error_code, message }` error envelope (SDP NFR-0005/ADR-0009), with distinct codes for at least: project-has-assignments on delete, role-has-assignments on removal, invalid-status-transition, project-not-editable (role management on a Completed/Cancelled project), and not-found conditions.

### Key Entities

- **Project**: A staffing initiative with a name, start/end dates, and a status (Draft/Active/Completed/Cancelled). Owns zero or more required roles and (out of this epic's scope, but referenced by FR-0012's delete rule) zero or more assignments.
- **ProjectRole**: A functional role required by a project, with a target capacity % and zero or more required skills drawn from the existing Skill catalog (EPIC-0001). Referenced by zero or more assignments (out of this epic's scope, but referenced by FR-0011's removal rule).
- **Skill** (reused from EPIC-0001, not redefined here): The existing shared catalog entry referenced by a ProjectRole's required skills. This epic validates required-skill references against the already-implemented `skills` table rather than defining its own skill validation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Manager can define a new project with its required roles, from opening the form to confirmation, in under 60 seconds. *(UI-experience criterion — deferred to the future UI epic; this epic's backend-only tasks cannot themselves deliver or validate it, consistent with the precedent set for EPIC-0001's SC-001/SC-004. See Assumptions.)*
- **SC-002**: 100% of attempts to remove a required role with dependent assignment records are correctly blocked before any data is lost — verified at the unit level in this epic (see Assumptions), with full end-to-end verification deferred until EPIC-0003.
- **SC-003**: 100% of attempts to delete a project with dependent assignment records are correctly blocked before any data is lost — verified at the unit level in this epic (see Assumptions), with full end-to-end verification deferred until EPIC-0003.
- **SC-004**: An invalid project status transition (e.g., Completed → Active) is rejected 100% of the time, verified end-to-end via integration tests against the real transition graph.
- **SC-005**: An attempt to add, edit, or remove a required role on a Completed or Cancelled project is rejected 100% of the time, verified end-to-end via integration tests (task T020) and confirmed at the contract-test level (task T021) — unlike SC-002/SC-003, this rule has no dependency on the not-yet-existing `assignments` table, so it is fully verifiable within this epic, not deferred.

## Assumptions

- This spec covers only EPIC-0002 (Project Management) as scoped by the user's request: FR-0009 through FR-0012. The Assignment Engine, Bench, Reports, and Employee Self-Service epics are explicitly out of scope for this feature and will be specified separately, each on its own feature branch. Employee Management (EPIC-0001) is a completed prerequisite, not part of this feature's scope.
- No authentication/authorization exists (per SDP ADR-0011); all actions in this spec are implicitly performed by the Manager role, consistent with the UX Specification's role-switcher model. The Employee role has no write access to any endpoint in this epic.
- **FR-0011's and FR-0012's delete/removal-blocking behavior against a real assignment record is verified via a unit-level repository test double only in this epic.** The underlying check (`hasAnyAssignments` for projects, an equivalent existence check for roles) is hardcoded to return "no assignments exist" in this epic, since the `assignments` table does not exist until EPIC-0003 (Assignment Engine). It is not integration-tested end-to-end until EPIC-0003 lands and replaces the stub with a real query. Until then, a project or required role with real assignment history could in principle be deleted/removed with no error at the database level, since the table these rules depend on does not yet exist. This mirrors the precedent set by EPIC-0001's `hasAnyAssignments` stub, and is disclosed here from the outset rather than discovered during a later `/speckit.analyze` pass.
- SC-001 describes a UI-experience criterion (form completion time) that this epic — being backend-only, consistent with EPIC-0001's plan — cannot itself deliver or validate. It is deferred to the future UI epic that builds the Manager-facing project screens; it remains a valid success criterion for the product, just not one this epic's tasks can satisfy on their own.
- Required-skill references on a project role are validated against the existing `skills` table and catalog logic already implemented in EPIC-0001 — this epic does not redefine skill existence/uniqueness validation, it only reuses it as a foreign-key-style reference check.
- Demo-scale data volumes apply (a handful of concurrent projects, tens of required roles total, per the PRD); no pagination is assumed for list endpoints, consistent with the BFF Contract.
- The project status transition graph (Draft→Active→{Completed,Cancelled}, Draft→Cancelled; no path back from Completed or Cancelled) is taken as already-ratified per the UX Specification's resolved Appendix note and the BFF Contract's `INVALID_STATUS_TRANSITION` decision — it is not re-derived or re-litigated here.
- **Required-role management is restricted to Draft/Active projects (resolved gap).** The original FR-0010/FR-0011 wording did not state whether role add/edit/remove should remain permitted once a project reaches Completed or Cancelled. This spec resolves it: role management is permitted during Draft (when a Manager is defining a project's staffing needs before going Active) and Active (when staffing needs may still evolve), and blocked once Completed or Cancelled (a finished or cancelled project's requirements are frozen — there is no valid use case for editing them). This is distinct from FR-0015's "assignments only against Active projects" rule, which governs a different action (creating an assignment, not managing a role definition) and has different valid states (Active only, not Draft).
