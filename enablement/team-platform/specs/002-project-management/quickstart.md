# Quickstart: Validating Project Management (EPIC-0002)

This guide describes how to prove the feature works end-to-end once implemented. It does not
contain implementation code — see `data-model.md` for entity shapes and
`contracts/project-management.md` (pointing into `specs/contracts/openapi-spec.yaml`) for
request/response schemas.

## Prerequisites

- EPIC-0001 already implemented and passing its own tests (this epic extends that codebase).
- `npm install` already run; no new dependencies are introduced by this epic.
- No environment variables or external services required.

## Setup

1. Run migrations, including the new `0002_project_management` migration (adds `projects`,
   `project_roles`, `project_role_skills`), on top of EPIC-0001's existing schema.
2. Start the server (`npm run dev`), which now also serves the `/projects` routes described in
   `contracts/project-management.md`.

## Validation Scenarios

### 1. Create, transition, edit, and delete a project (User Story 1 / FR-0009, FR-0012)

1. `POST /projects` with a valid name and dates → expect `201`, `status: "Draft"`.
2. `PATCH /projects/{projectId}` with `status: "Active"` → expect `200`.
3. `PATCH /projects/{projectId}` with `status: "Completed"` immediately after Draft→Active is
   valid; but attempting `status: "Active"` again from `Completed` → expect `409` with
   `error_code: INVALID_STATUS_TRANSITION`.
4. `DELETE /projects/{projectId}` (no assignments exist) → expect `204`.
5. Repeat steps 1–2, then manually insert an assignment row referencing the project (simulating
   a future epic's data), and attempt `DELETE /projects/{projectId}` again → expect `409` with
   `error_code: PROJECT_HAS_ASSIGNMENTS`.

**Expected outcome**: Projects can be created and moved through the allowed status graph only;
deletion is only permitted when no assignment references the project.

### 2. Define, edit, and remove a required role (User Story 2 / FR-0010, FR-0011)

1. Create a skill via `POST /skills` (reusing EPIC-0001) if one doesn't already exist.
2. `POST /projects/{projectId}/roles` with a name, `capacityPercent: 50`, and that skill's ID in
   `requiredSkillIds` → expect `201`.
3. `POST /projects/{projectId}/roles` with `capacityPercent: 0` → expect `400` with
   `error_code: VALIDATION_ERROR`.
4. `POST /projects/{projectId}/roles` with a nonexistent skill ID in `requiredSkillIds` → expect
   `404` with `error_code: NOT_FOUND` (reusing EPIC-0001's `SkillNotFoundError`).
5. `PATCH /projects/{projectId}/roles/{roleId}` changing `capacityPercent` to `75` → expect
   `200`.
6. `DELETE /projects/{projectId}/roles/{roleId}` (no assignments reference it) → expect `204`.
7. Repeat steps 2–5, then manually insert an assignment row referencing the role, and attempt
   `DELETE /projects/{projectId}/roles/{roleId}` again → expect `409` with `error_code:
   ROLE_HAS_ASSIGNMENTS`.
8. Transition a project to `Completed` (via the valid Draft→Active→Completed path), then attempt
   `POST /projects/{projectId}/roles` on it → expect `409` with `error_code:
   PROJECT_NOT_EDITABLE`.

**Expected outcome**: Required roles can be fully managed while a project is Draft or Active,
with skill references validated against the existing catalog and removal blocked when
assignments exist; role management is rejected outright once a project is Completed or
Cancelled.

### 3. Confirm EPIC-0001's deletion-impact follow-up is discharged

1. Create a skill, then create a project role that requires it (per Scenario 2, step 2).
2. `GET /skills/{skillId}/deletion-impact` (EPIC-0001's endpoint) → expect
   `affectedProjectRoleCount: 1` (previously always `0` before this epic).

**Expected outcome**: EPIC-0001's tracked follow-up (`tasks.md` T043) is verifiably resolved,
not just marked complete in prose.

## Definition of Done for this Quickstart

- All three scenarios pass as integration tests against a real, freshly-seeded SQLite database,
  torn down after the test run (NFR-0002).
- Unit tests for `project.service.ts` independently cover the status-transition graph and the
  delete/removal-eligibility edge cases at >70% coverage (NFR-0001).
- `skill.service.test.ts` (EPIC-0001, extended) confirms `affectedProjectRoleCount` now reflects
  real data.
- Every error response observed above matches the `{ error_code, message }` envelope exactly.
