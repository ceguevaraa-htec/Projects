# Phase 1 Data Model: Project Management (EPIC-0002)

Entities and fields below mirror `specs/contracts/openapi-spec.yaml`'s schemas exactly for this
epic's scope (`Project`, `ProjectSummary`, `ProjectRole`) — field names and types are not
re-derived independently. Validation rules are cited back to their PRD FR where one exists.

## Project

Represents a staffing initiative. Corresponds to OpenAPI schemas `Project` (detail, with
embedded `requiredRoles`) and `ProjectSummary` (list view).

| Field | Type | Notes |
|---|---|---|
| `projectId` | UUID | Primary key, server-generated on create. |
| `name` | string | Required (FR-0009). |
| `startDate` | date | Required (FR-0009). |
| `endDate` | date | Required (FR-0009). |
| `status` | enum: Draft / Active / Completed / Cancelled | Defaults to Draft on creation (FR-0009). |

**Validation rules**:
- `name`, `startDate`, `endDate` required on create; `startDate` must not be after `endDate`.
- `status` transitions are validated against a fixed graph (see State Transitions below); an
  invalid transition raises `InvalidStatusTransitionError`.

**Relationships**:
- Has many `ProjectRole` (one row per required role).
- Has many Assignments (owned by the Assignment Engine epic; only referenced here for the
  delete-eligibility check in FR-0012 — this epic does not create or read assignment detail,
  only checks existence, mirroring EPIC-0001's `Employee.hasAnyAssignments` pattern exactly).

**Delete eligibility (FR-0012)**: A `Project` MAY be deleted only if zero assignment rows
reference it (past, current, or future), checked explicitly in Domain Logic
(`project.service.ts`) rather than relying solely on a database constraint, so a clear
`ProjectHasAssignmentsError` can be raised instead of a raw SQLite error.

> **✅ RESOLVED by EPIC-0003.** As of EPIC-0002, the `assignments` table did not exist yet, so
> `hasAnyAssignments(projectId)` hardcoded a return of `false`, mirroring EPIC-0001's identical
> stub. EPIC-0003 (Assignment Engine) discharged this follow-up in its task T039:
> `project.repository.ts`'s `hasAnyAssignments` now runs a real existence query against the
> `assignments` table (`assignments.project_id`, a stored column — no join through
> `project_roles` was needed after all, per `specs/003-assignment-engine/data-model.md`). See
> `specs/003-assignment-engine/tasks.md` T039 for the resolving change.

## ProjectRole

Represents a functional role a project needs staffed. Corresponds to OpenAPI schema
`ProjectRole`.

| Field | Type | Notes |
|---|---|---|
| `roleId` | UUID | Primary key, server-generated on create. |
| `projectId` | UUID | Foreign key to `Project`. |
| `name` | string | Required (functional role name, e.g. "Backend Developer") (FR-0010). |
| `capacityPercent` | integer, 1–100 | Required, must be greater than 0 (FR-0010; mirrors the same floor already applied to `EmployeeSkill`-adjacent validation in EPIC-0001 for a 0%-capacity requirement being meaningless). |
| `requiredSkills` | zero or more `Skill` references | Selected from the existing EPIC-0001 skills catalog (FR-0010). |

**Validation rules**:
- `name` and `capacityPercent` required; `capacityPercent` must be an integer greater than 0 and
  up to 100.
- Each entry in `requiredSkillIds` (on create/update) must reference an existing `Skill` row —
  validated via `SkillRepository.findById` (EPIC-0001, reused as-is), raising the existing
  `SkillNotFoundError` on a missing reference. No new skill-existence check is written.
- **Role management is only permitted while the parent project's status is Draft or Active.**
  Add, edit, and remove are all blocked once a project is Completed or Cancelled, raising a new
  `ProjectNotEditableError` (`PROJECT_NOT_EDITABLE`, 409) — distinct from the assignment-only
  `PROJECT_NOT_ACTIVE` rule (FR-0015), since roles may legitimately be defined during Draft
  (before a project goes Active) as well as edited during Active, but editing the staffing
  requirements of a project that has already finished or been cancelled has no valid use case.
  This was an unstated gap in the original FR-0010/FR-0011 wording, resolved here as an explicit
  Domain Logic decision rather than left implicit.

**Relationships**:
- Many-to-one to `Project`.
- Many-to-many to `Skill` via a new join table `project_role_skills(project_role_id, skill_id)`
  — chosen to mirror the `employee_skills` pattern already established in EPIC-0001 (a plain
  association table, no extra columns needed here since — unlike `EmployeeSkill` — a required
  skill carries no proficiency level, per the PRD's FR-0010 definition of a required role).
- Referenced by zero or more Assignments (owned by the Assignment Engine epic; only referenced
  here for the removal-eligibility check in FR-0011).

**Removal eligibility (FR-0011)**: A `ProjectRole` MAY be removed only if zero assignment rows
reference it, checked explicitly in Domain Logic, raising `ProjectRoleHasAssignmentsError`
otherwise.

> **✅ RESOLVED by EPIC-0003.** Identical in nature to the `Project.hasAnyAssignments` stub
> above. EPIC-0003 discharged this follow-up in its task T040:
> `project.repository.ts`'s `roleHasAnyAssignments` now runs a real existence query against the
> `assignments` table (`assignments.project_role_id`). See
> `specs/003-assignment-engine/tasks.md` T040 for the resolving change.

## Skill (reused from EPIC-0001, not redefined)

No new fields or table. `project_role_skills.skill_id` references the existing `skills.id`
(EPIC-0001's migration `0001_employee_management`). This epic adds no columns to `skills` and no
new validation logic for skills themselves — see `research.md`'s "Required-skill validation
reuses EPIC-0001's skill.repository.ts" decision.

**Cross-epic follow-up now discharged**: EPIC-0001's `SkillDeletionImpact.affectedProjectRoleCount`
field was hardcoded to `0` (flagged in EPIC-0001's own `data-model.md` as a required follow-up
for "once EPIC-0002 lands"). This epic discharges that follow-up: `skill.repository.ts`'s
`countProjectRoleAssociations(skillId)` is changed to
`SELECT COUNT(*) FROM project_role_skills WHERE skill_id = ?`, now that `project_role_skills`
exists. `skill.service.ts`'s `getDeletionImpact` requires no change — it already calls this
repository method and simply receives a real count instead of a hardcoded `0`.

## State Transitions

`Project.status` follows a fixed graph, server-side enforced (not merely a UI constraint — see
`research.md`):

```
Draft --> Active
Draft --> Cancelled
Active --> Completed
Active --> Cancelled
```

No other transition is permitted (e.g., Completed → Active, Cancelled → Draft, Active → Draft
are all rejected with `InvalidStatusTransitionError`). This graph is taken as already-ratified
per the UX Specification's Appendix and the BFF Contract's Design Rationale — it is not
re-derived here, only implemented.

`ProjectRole` has no independent status/lifecycle field in this epic's scope.
