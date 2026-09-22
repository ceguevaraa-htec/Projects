# Phase 0 Research: Project Management (EPIC-0002)

No `NEEDS CLARIFICATION` markers remain from the Technical Context — every technical decision
was either specified directly in the user's planning input, already ratified upstream (SDP,
UX Spec, BFF Contract), or already established as precedent by EPIC-0001. This document records
the resulting decisions and their rationale rather than open-ended research.

## Decision: Extend the existing codebase in place, not a parallel structure

- **Decision**: New files (`project.repository.ts`, `project.service.ts`, `projects.routes.ts`,
  migration `0002_project_management`) land in the same top-level `src/repositories/`,
  `src/domain/`, `src/api/routes/` directories EPIC-0001 already created. `skill.repository.ts`
  and `skill.service.ts` are modified in place, not duplicated.
- **Rationale**: EPIC-0001's own plan.md explicitly anticipated this — "later epics ... will add
  their own repositories/services/routes into these same top-level directories rather than
  duplicating the layering per epic." Constitution Principle II requires one Domain Logic layer,
  not one per epic.
- **Alternatives considered**: A per-epic subfolder (`src/epics/002-project-management/...`) —
  rejected, since it was already explicitly rejected in EPIC-0001's plan.md rationale.

## Decision: Status-transition graph is server-side enforced, taken as already-ratified

- **Decision**: `PATCH /projects/{projectId}` validates any status change against
  Draft→Active→{Completed,Cancelled}, Draft→Cancelled (no path back from Completed or
  Cancelled), rejecting invalid transitions with `InvalidStatusTransitionError` →
  `INVALID_STATUS_TRANSITION`.
- **Rationale**: This was resolved during the BFF Contract's design (see
  `specs/BFF-CONTRACT-Team-Allocation-Platform.md`'s Design Rationale) after being flagged as a
  UX-layer assumption in the UX Specification's Appendix (v1.1). It is not re-derived here —
  Domain Logic simply implements the already-agreed graph.
- **Alternatives considered**: Leaving transition enforcement as UI-only — already explicitly
  rejected in the BFF Contract's Design Rationale, for the same reason every other hard-block
  rule in this system lives in Domain Logic (constitution Principle II / SDP ADR-0005).

## Decision: Required-skill validation reuses EPIC-0001's skill.repository.ts

- **Decision**: When a `ProjectRole` is created/edited with `requiredSkillIds`, each ID is
  checked for existence via the existing `SkillRepository.findById` (already implemented in
  EPIC-0001), reusing the existing `SkillNotFoundError` if a referenced skill doesn't exist. No
  new skill-existence-checking logic is written.
- **Rationale**: Explicitly required by the user's planning input and by spec.md's Assumptions
  ("this epic does not redefine skill existence/uniqueness validation, it only reuses it").
  Duplicating this check would risk drift between how EPIC-0001 and EPIC-0002 validate the same
  underlying `skills` table.
- **Alternatives considered**: A denormalized skill-name copy on `project_roles` avoiding the
  lookup — rejected, since it would need its own consistency-maintenance logic and contradicts
  the "single source of truth" principle already established for the skills catalog in
  EPIC-0001's PRD requirements (FR-0006).

## Decision: Delete/removal-eligibility stubs mirror EPIC-0001's hasAnyAssignments precedent

- **Decision**: `ProjectRepository.hasAnyAssignments(projectId)` and an equivalent
  `ProjectRoleRepository`-level (or `ProjectRepository`-level) `roleHasAnyAssignments(roleId)`
  check both hardcode "no assignments" until EPIC-0003's `assignments` table exists, exactly
  mirroring EPIC-0001's `hasAnyAssignments` stub pattern.
- **Rationale**: The `assignments` table is owned by EPIC-0003 and does not exist yet; there is
  no way to write a real query against a table that doesn't exist. This is disclosed directly in
  spec.md's Assumptions from the outset (per the user's explicit instruction), not discovered
  later via `/speckit.analyze`, applying the lesson learned from EPIC-0001's remediation.
- **Alternatives considered**: Blocking all project/role deletion unconditionally until
  EPIC-0003 exists — rejected, since it would make User Story 1's Acceptance Scenario 3
  ("project with no assignments can be deleted") untestable and contradicts FR-0012's actual
  requirement (block only when assignments exist, not always).

## Decision: Discharge EPIC-0001's T043 follow-up as part of this epic

- **Decision**: `skill.repository.ts`'s `countProjectRoleAssociations(skillId)` — hardcoded to
  `0` in EPIC-0001 — is changed to a real Kysely query against the new `project_roles` table
  (specifically, against a join table or a `required_skill_ids` column, depending on the
  `ProjectRole`-to-`Skill` relationship shape chosen in Phase 1's data model) once that table
  exists in this epic's migration.
- **Rationale**: Explicitly instructed by the user, and already tracked as a required follow-up
  in EPIC-0001's `data-model.md` and `tasks.md` T043 — this is fulfilling a pre-declared debt,
  not new scope invented here.
- **Alternatives considered**: Leaving the stub in place and tracking a *third* epic's follow-up
  — rejected, since the table this stub depends on will exist by the end of this epic; deferring
  further would be pure procrastination with no technical justification.

## Decision: Role management is restricted to Draft/Active projects

- **Decision**: `POST/PATCH/DELETE /projects/{projectId}/roles[/{roleId}]` all check the parent
  project's status first; if it is Completed or Cancelled, the request is rejected with a new
  `ProjectNotEditableError` (`PROJECT_NOT_EDITABLE`, 409), before any other validation runs.
  Draft and Active projects both permit role management.
- **Rationale**: The original FR-0010/FR-0011 wording was silent on this. Resolved by explicit
  design review: Draft is when a Manager defines a project's staffing needs before it goes
  Active, and Active is when those needs may still evolve; Completed/Cancelled projects have no
  valid reason to have their staffing requirements edited. This is a distinct rule from
  FR-0015's "assignments only against Active projects," which governs a different action
  (creating an assignment) with different valid states (Active only).
- **Alternatives considered**: Reusing the existing `PROJECT_NOT_ACTIVE` error code — rejected,
  since its semantics ("must be Active") don't match this rule ("must not be
  Completed/Cancelled"; Draft is fine). Reusing it would mislabel a Draft-project rejection that
  should never happen under this rule as if it were the FR-0015 assignment rule. Blocking role
  management during Draft too (only allowing it once Active) — considered and rejected, since
  that would make it impossible to define a project's roles before activating it, which
  contradicts the natural Draft→Active workflow the status field exists to support.

## Decision: Testing strategy

- **Decision**: Same pattern as EPIC-0001 — Vitest unit tests against Domain Logic with a
  repository test double (extending `tests/helpers/fakes.ts` with a `FakeProjectRepository`),
  integration tests against a real temp-file SQLite database with cleanup, and contract tests
  asserting response shapes against `openapi-spec.yaml`.
- **Rationale**: Constitution Principle III, NFR-0001, NFR-0002 — unchanged from EPIC-0001,
  reusing the same test infrastructure (`tests/helpers/db.ts`) rather than rebuilding it.
- **Alternatives considered**: None — this is a direct continuation of EPIC-0001's
  already-validated approach.
