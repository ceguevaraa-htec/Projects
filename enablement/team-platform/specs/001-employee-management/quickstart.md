# Quickstart: Validating Employee Management (EPIC-0001)

This guide describes how to prove the feature works end-to-end once implemented. It does not
contain implementation code — see `data-model.md` for entity shapes and
`contracts/employee-management.md` (pointing into `specs/contracts/openapi-spec.yaml`) for
request/response schemas.

## Prerequisites

- Node.js and npm installed.
- Repository dependencies installed (`npm install`) once `package.json` exists (created during
  implementation, not by this plan).
- No environment variables or external services required — this feature runs entirely against a
  local SQLite file with no network dependency.

## Setup

1. Run database migrations to create the `employees`, `skills`, and `employee_skills` tables
   (migration `0001_employee_management`, per Project Structure in `plan.md`).
2. Start the server (`npm run dev`), which serves the REST API described in
   `contracts/employee-management.md` on `http://localhost:3000`.

## Validation Scenarios

Each scenario below corresponds to an acceptance scenario in `spec.md` and should be run as an
integration test (against the real SQLite file, per NFR-0002) as well as manually via HTTP if
desired.

### 1. Create, edit, and delete an employee (User Story 1 / FR-0001–FR-0003)

1. `POST /employees` with a valid name, start date, and seniority → expect `201` and an
   `Employee` object with a generated `employeeId`.
2. `PATCH /employees/{employeeId}` changing the seniority level → expect `200` with the updated
   value reflected.
3. `DELETE /employees/{employeeId}` (no assignments exist) → expect `204`.
4. Repeat steps 1–2, then manually insert an assignment row referencing the new employee
   (simulating a future epic's data), and attempt `DELETE /employees/{employeeId}` again →
   expect `409` with `error_code: EMPLOYEE_HAS_ASSIGNMENTS`.

**Expected outcome**: Employees can be created and edited freely; deletion is only permitted
when no assignment references the employee, otherwise a structured, explanatory error is
returned — never a silent failure or a raw database error.

### 2. Associate, update, and remove an employee's skill (User Story 2 / FR-0004–FR-0005)

1. Create a skill via `POST /skills` (e.g., "React").
2. `POST /employees/{employeeId}/skills` with that `skillId` and `proficiency: "Intermediate"`
   → expect `201`.
3. Repeat step 2 with the same `employeeId`/`skillId` pair → expect `409` with
   `error_code: DUPLICATE_EMPLOYEE_SKILL`.
4. `PATCH /employees/{employeeId}/skills/{skillId}` with `proficiency: "Expert"` → expect `200`
   with the updated proficiency.
5. `DELETE /employees/{employeeId}/skills/{skillId}` → expect `204`; the underlying `Skill` in
   the catalog is unaffected (`GET /skills` still lists it).
6. Repeat step 5 for the same, now-already-removed pair → expect `404` with
   `error_code: EMPLOYEE_SKILL_NOT_FOUND` (not the generic `NOT_FOUND` used for a missing
   employee or skill record itself).

**Expected outcome**: An employee's skill profile can be built up and adjusted independently of
the shared catalog; duplicate associations are rejected, and operating on a nonexistent
association is distinguished from operating on a nonexistent employee or skill.

### 3. Manage the skills catalog with deletion-impact preview (User Story 3 / FR-0006–FR-0008)

1. `POST /skills` with a new name → expect `201`.
2. `POST /skills` again with the same name → expect `409` with `error_code:
   SKILL_NAME_NOT_UNIQUE`.
3. `PATCH /skills/{skillId}` to rename it to something unused → expect `200`.
4. Associate the skill with two employees (via scenario 2's steps), then
   `GET /skills/{skillId}/deletion-impact` → expect `200` with `affectedEmployeeCount: 2` and
   `affectedProjectRoleCount: 0` (no Project Management epic tables exist yet in this feature's
   scope).
5. `DELETE /skills/{skillId}` → expect `204`; subsequently `GET /employees/{employeeId}` for
   either previously-associated employee shows the skill no longer listed.

**Expected outcome**: A Manager can always see the impact of a skill deletion before committing
to it, and confirmed deletion correctly cascades without leaving orphaned associations.

## Definition of Done for this Quickstart

- All three scenarios pass as integration tests against a real, freshly-seeded SQLite database,
  torn down after the test run (NFR-0002).
- Unit tests for the Domain Logic layer (`employee.service.ts`, `skill.service.ts`) independently
  cover the same edge cases at >70% coverage (NFR-0001).
- Every error response observed above matches the `{ error_code, message }` envelope exactly.
