# Feature Specification: Employee Management (EPIC-0001)

**Feature Branch**: `001-employee-management`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Implement EPIC-0001 (Employee Management) from the PRD, covering FR-0001 through FR-0008: create/edit/delete employees (with delete blocked if assignments exist, per FR-0003), assign/edit/remove employee skill associations with proficiency levels (FR-0004, FR-0005), and full CRUD for the skills catalog including the deletion-impact preview and confirmation warning (FR-0006, FR-0007, FR-0008)."

**Source of truth**: Per the project constitution, this spec does not restate requirements in new language where the PRD and OpenAPI spec already define them precisely. Functional Requirements below reference `specs/PRD-Team-Allocation-Platform.md` FR-0001–FR-0008 directly, and relevant paths in `specs/contracts/openapi-spec.yaml` (`/employees`, `/employees/{employeeId}`, `/employees/{employeeId}/skills`, `/employees/{employeeId}/skills/{skillId}`, `/skills`, `/skills/{skillId}`, `/skills/{skillId}/deletion-impact`) are the authoritative API contract.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain the employee roster (Priority: P1)

A Resource/Delivery Manager creates, edits, and deletes employee records — the foundation every other epic (assignments, bench, reports) builds on. Deletion is blocked whenever the employee has any assignment history, so the roster never silently loses data that other features depend on.

**Why this priority**: Nothing else in the system — skill association, assignment, bench, or reporting — can function without employee records existing first. This is the true MVP slice.

**Independent Test**: Can be fully tested by creating an employee, editing their core fields, and deleting an employee with no assignments (succeeds) — delivers a usable employee roster on its own, independent of any other epic. The "blocked when assignments exist" branch is exercised via a unit-level test double in this epic (see Assumptions); its integration-level proof against a real assignment record is deferred to EPIC-0003.

**Acceptance Scenarios**:

1. **Given** no employee exists with a given name, **When** a Manager submits valid name, employment start date, and seniority level, **Then** the system creates the employee (FR-0001) and returns the new record.
2. **Given** an existing employee, **When** a Manager updates any of name, employment start/end date, or seniority level, **Then** the system persists the change (FR-0002).
3. **Given** an employee with no assignments, **When** a Manager deletes that employee, **Then** the system removes the record (FR-0003).
4. **Given** an employee with at least one assignment (past, current, or future), **When** a Manager attempts to delete that employee, **Then** the system rejects the deletion with a structured error explaining that assignments exist (FR-0003). *(In this epic, this rule is verified via a unit-level repository test double, since the `assignments` table does not exist until EPIC-0003 — see Assumptions for the interim scope of this guarantee.)*

---

### User Story 2 - Track each employee's skills and proficiency (Priority: P2)

A Manager records which skills an employee has and at what proficiency level, and can update or remove those associations later. This data feeds the skill-match indicator used elsewhere (Assignment Engine epic) but is scoped here to the association itself.

**Why this priority**: Skill data has no value until employees exist (P1), but is needed before the Assignment Engine epic can use it — this is the second most foundational piece.

**Independent Test**: Can be fully tested by adding a skill (from the catalog) with a proficiency level to an employee, changing that proficiency, and removing the association — independently verifiable via the employee's own skill list, without any assignment or project data present.

**Acceptance Scenarios**:

1. **Given** an employee and an existing skill in the catalog, **When** a Manager associates that skill with the employee at a chosen proficiency level (Beginner/Intermediate/Expert), **Then** the system creates the association (FR-0004).
2. **Given** an employee with an existing skill association, **When** a Manager changes its proficiency level, **Then** the system persists the update (FR-0005).
3. **Given** an employee with an existing skill association, **When** a Manager removes it, **Then** the system deletes the association without affecting the underlying catalog skill (FR-0005).

---

### User Story 3 - Maintain the shared skills catalog (Priority: P3)

A Manager creates, renames, and deletes skills in the single shared catalog used by both employee profiles and (in a later epic) project role requirements. Deleting a skill that is in use requires the Manager to see, up front, how many employees and project roles will be affected.

**Why this priority**: The catalog must exist before skills can be associated to employees (P2), but catalog management (especially deletion) is the more delicate, lower-frequency operation, so it is prioritized last within this epic.

**Independent Test**: Can be fully tested by creating a skill, renaming it, previewing the deletion impact of a skill currently in use, and confirming the delete — independently verifiable via the catalog list and the deletion-impact preview response, without needing project data (this epic covers only the impact on employee associations; project-role impact counts are validated once the Project Management epic exists, but the contract for reporting that count is already part of this epic's scope).

**Acceptance Scenarios**:

1. **Given** no skill exists with a given name, **When** a Manager creates a skill, **Then** the system adds it to the catalog (FR-0006), rejecting the request if the name is already in use.
2. **Given** an existing skill, **When** a Manager renames it, **Then** the system persists the new name (FR-0007), rejecting the request if the new name collides with another skill.
3. **Given** a skill referenced by one or more employees, **When** a Manager requests the deletion-impact preview, **Then** the system returns the count of affected employees and project roles without deleting anything (FR-0008).
4. **Given** a Manager has seen the deletion-impact preview, **When** they confirm and delete the skill, **Then** the system removes the skill and cascades removal of its associations from employees and project roles (FR-0008).

---

### Edge Cases

- What happens when a Manager attempts to delete an employee that has only a future-dated (not-yet-started) assignment? The system MUST still block the deletion — FR-0003 blocks on any assignment (past, current, or future), not just active ones.
- What happens when a Manager tries to create a skill with a name that already exists in the catalog (case-sensitivity aside)? The system MUST reject the creation with a distinct error rather than silently creating a duplicate.
- What happens when a Manager requests the deletion-impact preview for a skill with zero associations? The system MUST return zero counts rather than an error, since deletion of an unused skill is a valid, low-impact operation.
- What happens when a Manager tries to add the same skill to the same employee twice? The system MUST reject the duplicate association (an employee has at most one proficiency record per skill) rather than creating two entries.
- What happens when a Manager tries to associate a skill that does not exist in the catalog? The system MUST reject the association, since skills are only ever selected from the catalog, never free-typed (per FR-0004).
- What happens when a Manager tries to update the proficiency of, or remove, an (employee, skill) association that does not exist? The system MUST reject the request with a distinct not-found error (`EMPLOYEE_SKILL_NOT_FOUND`) rather than silently succeeding or returning the generic `NOT_FOUND` used for missing employees/skills themselves.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-0001** (PRD): Manager can create an employee with name, employment start date, employment end date (optional/open-ended), and seniority level (Junior/Mid/Senior). Maps to `POST /employees`.
- **FR-0002** (PRD): Manager can edit any employee field defined in FR-0001. Maps to `PATCH /employees/{employeeId}`.
- **FR-0003** (PRD): Manager can delete an employee record, provided the employee has no assignments (past, current, or future); deletion is blocked with an explanatory error otherwise. Maps to `DELETE /employees/{employeeId}`.
- **FR-0004** (PRD): Manager can associate an employee with a skill selected from the skills catalog and set a proficiency level (Beginner/Intermediate/Expert) for that employee-skill pairing; an employee may have multiple skills. Maps to `POST /employees/{employeeId}/skills`.
- **FR-0005** (PRD): Manager can remove a skill association from an employee or change its proficiency level. Maps to `PATCH /employees/{employeeId}/skills/{skillId}` and `DELETE /employees/{employeeId}/skills/{skillId}`.
- **FR-0006** (PRD): Manager can create a new skill in the shared skills catalog (name only; the catalog is the single source of truth for skill selection elsewhere in the system). Maps to `POST /skills`.
- **FR-0007** (PRD): Manager can edit a skill's name in the catalog. Maps to `PATCH /skills/{skillId}`.
- **FR-0008** (PRD): Manager can delete a skill from the catalog; before deletion, the system shows an explicit confirmation warning naming the affected employee and project-role counts, and on confirmation, cascades removal of associations. Maps to `GET /skills/{skillId}/deletion-impact` (preview) followed by `DELETE /skills/{skillId}` (per BFF Contract ADR-0013).
- Every non-2xx response from the endpoints above MUST use the `{ error_code, message }` error envelope (SDP NFR-0005/ADR-0009), with distinct codes for at least: employee-has-assignments on delete, skill-name-not-unique on create/rename, and not-found conditions.

### Key Entities

- **Employee**: A staff member with a name, employment start/end dates, and a seniority level. Owns zero or more skill associations and (out of this epic's scope, but referenced by FR-0003's delete rule) zero or more assignments.
- **Skill**: A named entry in the shared catalog, independently created/edited/deleted by the Manager, referenced by both employee skill associations (this epic) and project role requirements (Project Management epic — out of scope here).
- **EmployeeSkill**: The association between one Employee and one Skill, carrying a single proficiency level (Beginner/Intermediate/Expert). An employee has at most one EmployeeSkill record per distinct Skill.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Manager can create a new employee record, from opening the form to confirmation, in under 30 seconds.
- **SC-002**: 100% of attempts to delete a skill with dependent employee associations are correctly warned before any data is lost, verified end-to-end via integration tests — zero silent data loss in testing. For employees, the equivalent guarantee (deletion blocked when assignments exist) is verified at the unit level only in this epic, pending EPIC-0003's real `assignments` table (see Assumptions); full end-to-end verification for employees is deferred until then.
- **SC-003**: A Manager can see, before confirming a skill deletion, exactly how many employees and project roles will be affected, with no need to manually cross-check other screens.
- **SC-004**: A Manager can update an employee's skill proficiency in a single interaction, without navigating away from the employee's record.

## Assumptions

- This spec covers only EPIC-0001 (Employee Management) as scoped by the user's request: FR-0001 through FR-0008. The Assignment Engine, Project Management, Bench, Reports, and Employee Self-Service epics are explicitly out of scope for this feature and will be specified separately, each on its own feature branch.
- No authentication/authorization exists (per SDP ADR-0011); all actions in this spec are implicitly performed by the Manager role, consistent with the UX Specification's role-switcher model. The Employee role has no write access to any endpoint in this epic.
- Skill catalog deletion's "project role" impact count (FR-0008) is reported by this epic's contract even though project roles themselves are defined in a later epic — the count is hardcoded to zero as an interim fallback until EPIC-0002 (Project Management) exists. **This is a required cross-epic follow-up, not a permanent design decision**: once EPIC-0002 lands, `affectedProjectRoleCount` must be changed to a real query, or the deletion-impact preview will silently under-report forever. See the flagged note in `data-model.md`.
- FR-0003's delete-blocking behavior against a real assignment record is verified via a unit-level repository test double only in this epic (`hasAnyAssignments` is hardcoded to return `false`, since the `assignments` table does not exist until EPIC-0003) — it is not integration-tested end-to-end until EPIC-0003 lands and its planning replaces the stub with a real query (tracked in `tasks.md` T044 and flagged in `data-model.md`). Until then, an employee with real assignment history could in principle be deleted with no error at the database level, since the `assignments` table this rule depends on does not yet exist.
- SC-001 and SC-004 describe UI-experience criteria (form completion time, staying on the employee's record) that this epic — being backend-only, per plan.md — cannot itself deliver or validate. Both are deferred to the future UI epic that builds the Manager-facing employee screens; they remain valid success criteria for the product, just not ones this epic's tasks can satisfy on their own.
- Demo-scale data volumes apply (tens of employees, per the PRD); no pagination is assumed for list endpoints, consistent with the BFF Contract.
