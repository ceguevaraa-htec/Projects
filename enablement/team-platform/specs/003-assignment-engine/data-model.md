# Phase 1 Data Model: Assignment Engine (EPIC-0003)

Entity fields mirror `specs/contracts/openapi-spec.yaml`'s `Assignment` and `CandidateEmployee`
schemas exactly — field names and types are not re-derived independently.

## Assignment

Represents the binding of one Employee to one ProjectRole at a specific capacity % and date
range. Corresponds to OpenAPI schema `Assignment`.

| Field | Type | Notes |
|---|---|---|
| `assignmentId` | UUID | Primary key, server-generated on create. |
| `employeeId` | UUID | Foreign key to `Employee` (EPIC-0001). `ON DELETE RESTRICT` — see research.md. |
| `employeeName` | string | Denormalized into the response only (not a stored column) — joined from `Employee` at read time. |
| `projectId` | UUID | Stored column, **client-supplied on create** per the OpenAPI `AssignmentCreateRequest` schema (not server-derived from the role). Validated at creation against the role's actual parent project — see Validation rules. |
| `projectName` | string | Denormalized into the response only — joined from `Project` at read time. |
| `roleId` | UUID | Foreign key to `ProjectRole` (EPIC-0002). `ON DELETE RESTRICT` — see research.md. |
| `roleName` | string | Denormalized into the response only — joined from `ProjectRole` at read time. |
| `capacityPercent` | integer, 1–100 | Required, must be greater than 0 (FR-0013). |
| `startDate` | date | Required. |
| `endDate` | date | Required, must not precede `startDate`. |
| `temporalStatus` | enum: future / current / past | Computed at read time via `date-utils.ts`'s `isInFuture`, not stored — avoids a value that could silently go stale relative to the system clock. |

**Validation rules**:
- `capacityPercent` must be an integer greater than 0 and up to 100 (FR-0013).
- `startDate` must not be after `endDate`.
- **The request's `projectId` must match the target `roleId`'s actual parent project** — this is
  an unstated consistency requirement implied by the client-supplied `projectId` field existing
  alongside `roleId` in `AssignmentCreateRequest`; a mismatch is rejected with a
  `ValidationError` rather than silently trusting the client's `projectId` or silently ignoring
  it in favor of the role's real parent. This is a small, reasonable inference flagged here
  explicitly (not left implicit), consistent with the project's practice of surfacing this kind
  of gap rather than assuming a resolution.
- The target `ProjectRole`'s parent `Project` must have status Active at creation time (FR-0015)
  — checked via the existing `ProjectRepository`/`ProjectService`, not re-derived.
- **Capacity constraint (FR-0014)**: the sum of `capacityPercent` across all of the employee's
  assignments whose date range overlaps the new/edited assignment's date range (via
  `date-utils.ts`'s `rangesOverlap`, inclusive on any shared day) must not exceed 100. This is
  evaluated at creation and at every edit, excluding the assignment being edited from its own
  overlap check.
- **Edit/cancel restriction (FR-0016/FR-0017)**: edit and cancel are both permitted only when
  `date-utils.ts`'s `isInFuture(startDate)` is true for the *current, persisted* `startDate` of
  the assignment being acted on (not the requested new `startDate` on an edit — the gate is
  whether the existing record has already started, not whether the edit would move it earlier).

**Relationships**:
- Many-to-one to `Employee` (EPIC-0001).
- Many-to-one to `ProjectRole` (EPIC-0002).

## CandidateEmployee (read model, not a stored entity)

A computed, non-persisted response shape returned by the candidates endpoint. Corresponds to
OpenAPI schema `CandidateEmployee`.

| Field | Type | Notes |
|---|---|---|
| `employeeId` | UUID | |
| `name` | string | |
| `seniority` | enum | Reused from `Employee` (EPIC-0001). |
| `currentUtilizationPercent` | integer 0–100 | Computed via the single shared `AssignmentService.getCurrentUtilization(employeeId)` function (see below) — **not** an independent sum in this response path. This is the first point in the system where this field is computed from real data rather than hardcoded to `0` (as it was in EPIC-0001/EPIC-0002's employee/project responses, which had no assignment data to sum). |
| `matchTier` | enum: strong / partial / no_match / no_requirement | Computed per FR-0018 — see below. |

**Match tier computation (FR-0018)**, applied per candidate employee against a target
`ProjectRole`'s `requiredSkills`:
- `no_requirement` if the role has zero required skills.
- `strong` if the employee has every required skill at Intermediate or Expert proficiency.
- `partial` if the employee has at least one but not all required skills, or has all required
  skills but at least one only at Beginner proficiency.
- `no_match` if the employee has none of the role's required skills.

This logic reads `EmployeeSkill` (EPIC-0001) and `ProjectRole.requiredSkills` (EPIC-0002) as-is
— no new skill schema is introduced (see research.md).

**Centralized utilization computation**: `currentUtilizationPercent` above, and the identical
field discharged onto the `Employee` response (see Cross-Epic Stub Discharge below), both call
one shared `AssignmentService.getCurrentUtilization(employeeId)` function — neither response
path sums assignment capacity independently. This mirrors `date-utils.ts`'s centralization
rationale (NFR-0009) one layer up: "what counts as current utilization" is business logic that
could silently drift between two call sites even if both use the same date primitives
underneath, so it is named and centralized once rather than duplicated. See research.md.

## Cross-Epic Stub Discharge (not a new entity — a resolution record)

This epic's `assignments` table existing is what makes the following three interim stubs,
flagged in EPIC-0001 and EPIC-0002, dischargeable for real:

| Stub | Originating epic | Tracked as | Resolution in this epic |
|---|---|---|---|
| `Employee.hasAnyAssignments` | EPIC-0001 | `data-model.md` note, `tasks.md` T044 | `employee.repository.ts`'s `hasAnyAssignments` now runs `SELECT EXISTS(SELECT 1 FROM assignments WHERE employee_id = ?)` (or equivalent Kysely query). |
| `Project.hasAnyAssignments` | EPIC-0002 | `data-model.md` note, `tasks.md` T033 | `project.repository.ts`'s `hasAnyAssignments` now runs the equivalent query joined through `project_roles` to find any assignment whose role belongs to the project. |
| `ProjectRole.roleHasAnyAssignments` | EPIC-0002 | `data-model.md` note, `tasks.md` T033 | `project.repository.ts`'s `roleHasAnyAssignments` now runs `SELECT EXISTS(SELECT 1 FROM assignments WHERE project_role_id = ?)`. |
| `Employee.currentUtilizationPercent` / embedded `assignments: []` | EPIC-0001 | `data-model.md` note only (not previously given its own `tasks.md` ID) | **Not explicitly named in this epic's planning input, but already documented in EPIC-0001's `data-model.md` as "sourced from the Assignment Engine epic once it exists" — i.e., a forward reference to this exact epic.** `employees.routes.ts`'s hardcoded `currentUtilizationPercent: 0` is replaced by a call to the shared `AssignmentService.getCurrentUtilization(employeeId)` (the same function the candidates endpoint uses — see above), and `assignments: []` is replaced with the employee's real assignment list. Flagged explicitly here since it was discovered during this epic's design, not requested verbatim — see plan.md. |

Per this epic's tasks.md, each resolution is accompanied by an update to the *originating*
epic's `data-model.md` (marking the flagged note resolved, mirroring the RESOLVED annotation
EPIC-0002 added to EPIC-0001's `affectedProjectRoleCount` note) and `tasks.md` (T044/T033,
mirroring EPIC-0002's own T043 resolution annotation).

## State Transitions

`Assignment` has an implicit, computed (not stored) temporal state derived from `startDate` and
`endDate` relative to today, via `date-utils.ts`:

```
future  --(today reaches startDate)-->  current  --(today passes endDate)-->  past
```

There is no explicit `status` field and no Manager-initiated transition between these states —
they are read-time computations only. The only Manager-initiated state changes are edit (only
while `future`) and cancel/delete (only while `future`), both gated by the same `isInFuture`
check against `startDate`.
