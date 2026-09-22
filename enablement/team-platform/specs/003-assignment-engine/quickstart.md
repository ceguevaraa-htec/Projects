# Quickstart: Validating Assignment Engine (EPIC-0003)

This guide describes how to prove the feature works end-to-end once implemented. It does not
contain implementation code — see `data-model.md` for entity shapes and
`contracts/assignment-engine.md` (pointing into `specs/contracts/openapi-spec.yaml`) for
request/response schemas.

## Prerequisites

- EPIC-0001 and EPIC-0002 already implemented and passing their own tests (this epic extends
  that codebase).
- `npm install` already run; no new dependencies are introduced by this epic.
- No environment variables or external services required.

## Setup

1. Run migrations, including the new `0003_assignment_engine` migration (adds `assignments`,
   with `ON DELETE RESTRICT` foreign keys to `employees` and `project_roles`).
2. Start the server (`npm run dev`), which now also serves the `/assignments` routes and the
   `/projects/{projectId}/roles/{roleId}/candidates` route.

## Validation Scenarios

### 1. Create a capacity-safe assignment, then attempt to exceed it (User Story 1 / FR-0013–FR-0015)

1. Create an employee, a project, activate the project (`PATCH .../status: "Active"`), and add
   a required role to it (reusing EPIC-0001/EPIC-0002 endpoints).
2. `POST /assignments` with that employee, project, role, `capacityPercent: 60`, and a date
   range → expect `201`.
3. `POST /assignments` again for the same employee with an overlapping date range and
   `capacityPercent: 50` (60 + 50 = 110 > 100) → expect `409` with `error_code:
   CAPACITY_EXCEEDED`.
4. `POST /assignments` for the same employee with a non-overlapping (future, non-conflicting)
   date range and `capacityPercent: 50` → expect `201` (no conflict, since dates don't overlap).
5. Create a second project role on a Draft project; `POST /assignments` against it → expect
   `409` with `error_code: PROJECT_NOT_ACTIVE`.

**Expected outcome**: Capacity is summed only across genuinely overlapping dates, and is
rejected outright — with no override — the moment it would exceed 100%.

### 2. Edit and cancel a future-dated assignment; confirm past/current ones are protected (User Story 2 / FR-0016–FR-0017)

1. Create an assignment with a `startDate` in the future → `PATCH` its `capacityPercent` →
   expect `200`.
2. `DELETE` that same future-dated assignment → expect `204`.
3. Create an assignment with a `startDate` of today (or earlier, if seeded directly) → attempt
   `PATCH` → expect `409` with `error_code: ASSIGNMENT_NOT_EDITABLE`. Attempt `DELETE` → expect
   `409` with `error_code: ASSIGNMENT_NOT_CANCELLABLE`.

**Expected outcome**: Only assignments that haven't started yet can be changed or removed;
historical records are immutable.

### 3. View skill-match tiers on the candidates list (User Story 3 / FR-0018)

1. Create two employees: one with the role's required skill at Expert proficiency, one with no
   matching skills.
2. `GET /projects/{projectId}/roles/{roleId}/candidates` → expect `200` with both employees
   present — the first tagged `matchTier: "strong"`, the second `matchTier: "no_match"`, neither
   filtered out.
3. Repeat against a role with zero required skills → expect every candidate tagged
   `matchTier: "no_requirement"`.

**Expected outcome**: The candidate list never filters; the match tier is purely advisory and
accurately reflects skill/proficiency data.

### 4. Confirm the three cross-epic stubs (plus the discovered fourth) are discharged

1. Create an employee with a future-dated assignment; attempt `DELETE /employees/{employeeId}`
   (EPIC-0001) → expect `409 EMPLOYEE_HAS_ASSIGNMENTS` (previously always succeeded, since
   `hasAnyAssignments` was hardcoded `false`).
2. Similarly, attempt `DELETE /projects/{projectId}` and
   `DELETE /projects/{projectId}/roles/{roleId}` (EPIC-0002) on ones with assignments → expect
   `409 PROJECT_HAS_ASSIGNMENTS`/`409 ROLE_HAS_ASSIGNMENTS`.
3. `GET /employees/{employeeId}` (EPIC-0001) for an employee with a current assignment → expect
   `currentUtilizationPercent` to reflect the real sum, not `0`.

**Expected outcome**: EPIC-0001's tracked follow-up (T044) and EPIC-0002's (T033) are
verifiably resolved, not just marked complete in prose — mirroring how EPIC-0002's quickstart
proved its own discharge of EPIC-0001's `countProjectRoleAssociations` debt.

## Definition of Done for this Quickstart

- All four scenarios pass as integration tests against a real, freshly-seeded SQLite database,
  torn down after the test run (NFR-0002).
- `date-utils.test.ts` independently covers `isInFuture`/`rangesOverlap` boundary cases at
  (targeting) 100% branch coverage.
- Unit tests for `assignment.service.ts` independently cover the capacity, active-project,
  future-past, and skill-match edge cases at >70% coverage (NFR-0001).
- `employee.service.test.ts`/`employees.api.test.ts` and `project.service.test.ts`/
  `projects.api.test.ts` (both prior epics, extended) confirm the now-real stub behavior.
- Every error response observed above matches the `{ error_code, message }` envelope exactly.
