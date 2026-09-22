# Phase 1 Data Model: Employee Management (EPIC-0001)

Entities and fields below mirror `specs/contracts/openapi-spec.yaml`'s schemas exactly for this
epic's scope (`Employee`, `EmployeeSummary`, `Skill`, `EmployeeSkill`,
`SkillDeletionImpact`) — field names and types are not re-derived independently. Validation
rules are cited back to their PRD FR where one exists.

## Employee

Represents a staff member. Corresponds to OpenAPI schemas `Employee` (detail, with embedded
`skills` and `assignments`) and `EmployeeSummary` (list view).

| Field | Type | Notes |
|---|---|---|
| `employeeId` | UUID | Primary key, server-generated on create. |
| `name` | string | Required (FR-0001). |
| `employmentStartDate` | date | Required (FR-0001). |
| `employmentEndDate` | date, nullable | Optional/open-ended (FR-0001). |
| `seniority` | enum: Junior / Mid / Senior | Required (FR-0001). |
| `currentUtilizationPercent` | integer 0–100 | Derived/computed field, not stored. **✅ RESOLVED by EPIC-0003**: `employees.routes.ts` now computes this via the shared `AssignmentService.getCurrentUtilization(employeeId)` (previously hardcoded to `0` — see `specs/003-assignment-engine/tasks.md` T043). |

**Validation rules**:
- `name`, `employmentStartDate`, `seniority` required on create (FR-0001).
- If `employmentEndDate` is provided, it must not precede `employmentStartDate`.
- Fields may be partially updated via `PATCH` (FR-0002); no field is immutable after creation.

**Relationships**:
- Has many `EmployeeSkill` (one row per distinct `Skill`, enforced unique per employee).
- Has many Assignments (owned by the Assignment Engine epic; only referenced here for the
  delete-eligibility check in FR-0003 — this epic does not create or read assignment detail,
  only checks existence).

**Delete eligibility (FR-0003)**: An `Employee` MAY be deleted only if zero assignment rows
reference it (past, current, or future). This is a Domain Logic decision (`employee.service.ts`),
not a database-level foreign-key `ON DELETE RESTRICT` alone — Domain Logic performs the
existence check explicitly so it can raise `EmployeeHasAssignmentsError` with a clear message,
rather than surfacing a raw SQLite constraint violation.

> **✅ RESOLVED by EPIC-0003.** As of EPIC-0001, the `assignments` table did not exist yet, so
> the repository's `hasAnyAssignments(employeeId)` check hardcoded a return of `false` — every
> employee appeared deletion-eligible regardless of real assignment history, meaning FR-0003's
> actual delete protection was a no-op in practice. EPIC-0003 (Assignment Engine) discharged
> this follow-up in its task T036: `employee.repository.ts`'s `hasAnyAssignments` now runs a
> real existence query against the `assignments` table (created by EPIC-0003's migration
> `0003_assignment_engine`). See `specs/003-assignment-engine/data-model.md` and
> `specs/003-assignment-engine/tasks.md` T036 for the resolving change.

## Skill

Represents one entry in the shared skills catalog. Corresponds to OpenAPI schema `Skill`.

| Field | Type | Notes |
|---|---|---|
| `skillId` | UUID | Primary key, server-generated on create. |
| `name` | string | Required, unique across the catalog (FR-0006/FR-0007). |

**Validation rules**:
- `name` required, non-empty.
- `name` must be unique (case-insensitive comparison) across the catalog on both create
  (FR-0006) and rename (FR-0007); violation raises `DuplicateSkillNameError`.

**Relationships**:
- Referenced by many `EmployeeSkill` rows (this epic).
- Referenced by many project-role "required skill" rows (Project Management epic — out of
  scope here, but the deletion-impact count includes this relationship; see below).

## EmployeeSkill

The association between one `Employee` and one `Skill`, carrying a proficiency level.
Corresponds to OpenAPI schema `EmployeeSkill`.

| Field | Type | Notes |
|---|---|---|
| `employeeId` | UUID | Foreign key to `Employee`. |
| `skillId` | UUID | Foreign key to `Skill`. |
| `proficiency` | enum: Beginner / Intermediate / Expert | Required (FR-0004). |

**Validation rules**:
- Exactly one `EmployeeSkill` row per (`employeeId`, `skillId`) pair — a duplicate association
  attempt raises `DuplicateEmployeeSkillError` (edge case identified in spec.md).
- `skillId` must reference an existing catalog `Skill`; skills are never free-typed on an
  employee (FR-0004).
- `proficiency` required on create and update (FR-0004/FR-0005).

**Relationships**:
- Many-to-one to `Employee`.
- Many-to-one to `Skill`.
- Deleting the parent `Skill` (FR-0008, on confirmed delete) cascades deletion of all
  `EmployeeSkill` rows referencing it.

## SkillDeletionImpact (read model, not a stored entity)

A computed, non-persisted response shape returned by the deletion-impact preview endpoint.
Corresponds to OpenAPI schema `SkillDeletionImpact`.

| Field | Type | Notes |
|---|---|---|
| `skillId` | UUID | The skill being previewed. |
| `affectedEmployeeCount` | integer | Count of `EmployeeSkill` rows referencing this skill (computed by this epic). |
| `affectedProjectRoleCount` | integer | Count of project-role "required skill" rows referencing this skill (owned by the Project Management epic's schema). |

> **✅ RESOLVED by EPIC-0002.** As of EPIC-0001, the `project_roles`/required-skills tables did
> not exist yet, so `affectedProjectRoleCount` was hardcoded to `0`. This was an interim
> fallback, not a permanent design decision. EPIC-0002 (Project Management) discharged this
> follow-up in its task T027: `skill.repository.ts`'s `countProjectRoleAssociations` now runs a
> real query against `project_role_skills` (created by EPIC-0002's migration
> `0002_project_management`). See `specs/002-project-management/data-model.md` and
> `specs/002-project-management/tasks.md` T027 for the resolving change.

## State Transitions

Neither `Employee` nor `Skill` has a status/lifecycle field in this epic's scope (unlike
`Project`, which does — out of scope here). The only "transition" relevant to this epic is the
one-way, irreversible deletion of a `Skill` and its cascading `EmployeeSkill` associations,
which is why FR-0008 requires the preview step before that action is taken.
