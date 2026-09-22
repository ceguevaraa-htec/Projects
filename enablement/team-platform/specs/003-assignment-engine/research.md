# Phase 0 Research: Assignment Engine (EPIC-0003)

No `NEEDS CLARIFICATION` markers remain from the Technical Context — every technical decision
was either specified directly in the user's planning input, already ratified upstream (SDP,
PRD, BFF Contract), or already established as precedent by EPIC-0001/EPIC-0002. This document
records the resulting decisions and their rationale.

## Decision: Extend the existing codebase in place, not a parallel structure

- **Decision**: New files (`assignment.repository.ts`, `assignment.service.ts`, `date-utils.ts`,
  `assignments.routes.ts`, migration `0003_assignment_engine`) land in the same top-level
  `src/repositories/`, `src/domain/`, `src/api/routes/` directories both prior epics already
  established. `employee.repository.ts` and `project.repository.ts` are modified in place.
- **Rationale**: Directly continues EPIC-0001's and EPIC-0002's explicit precedent (both
  plan.md's Structure Decision sections state this pattern is intended to repeat).
- **Alternatives considered**: None — this is settled precedent, not reopened here.

## Decision: `assignments` foreign keys use `ON DELETE RESTRICT`, not `CASCADE`

- **Decision**: `assignments.employee_id` references `employees.id` and
  `assignments.project_role_id` references `project_roles.id`, both with `ON DELETE RESTRICT`
  — a deliberate departure from every other foreign key in this codebase so far (all of which
  use `ON DELETE CASCADE`: `employee_skills`, `project_role_skills`).
- **Rationale**: Every other cascading relationship in this system represents a pure
  association (an employee-skill pairing, a role-skill requirement) where deleting the parent
  legitimately should remove the association. An assignment is different: it is the historical
  record FR-0003/FR-0011/FR-0012 exist specifically to protect. If `assignments` cascaded on
  employee/role deletion, deleting an employee or role would silently destroy assignment
  history — exactly what those three FRs are designed to prevent. `RESTRICT` makes this
  structurally impossible at the database level, as a second layer of defense underneath the
  Domain Logic checks (`hasAnyAssignments`) this epic is also implementing. In practice, Domain
  Logic's explicit check will always run first and raise a clear `EmployeeHasAssignmentsError`/
  `ProjectHasAssignmentsError`/`ProjectRoleHasAssignmentsError` before a raw FK violation could
  ever surface — `RESTRICT` is a safety net, not the primary enforcement mechanism.
- **Alternatives considered**: `ON DELETE CASCADE` (matching the rest of the schema) — rejected
  for the reason above. `ON DELETE SET NULL` — not applicable, since `employee_id`/
  `project_role_id` are non-nullable by FR-0013's definition of what an assignment is.

## Decision: One shared `date-utils.ts` module, no independent date logic anywhere

- **Decision**: `src/domain/date-utils.ts` exports `isInFuture(date: string): boolean` and
  `rangesOverlap(rangeA: {start, end}, rangeB: {start, end}): boolean`, both operating at
  calendar-day granularity using the local system clock (no timezone conversion, no
  sub-day/time-of-day comparison). `assignment.service.ts`'s capacity summation
  (`rangesOverlap`) and future/past edit-cancel check (`isInFuture`) both call this module
  exclusively — no inline date-string comparison logic appears anywhere else in this epic.
- **Rationale**: Directly required by SDP NFR-0009 and by the user's explicit instruction. This
  is the first epic whose rules genuinely need "today" and "overlap" semantics (EPIC-0001/
  EPIC-0002 had no such rules), so this is the correct point to introduce the module — not
  before it was needed, not deferred further now that it is.
- **Alternatives considered**: Inlining date comparisons directly in `assignment.service.ts`
  methods — rejected, since NFR-0009 specifically exists to prevent exactly this kind of
  scattered, potentially-inconsistent date logic; a future Bench epic (EPIC-0004) will need the
  same "today" semantics for its window computation and MUST reuse this module rather than
  reimplementing it (flagged as a structural dependency in spec.md's Assumptions).

## Decision: FR-0014's overlap rule — inclusive overlap on any shared calendar day

- **Decision**: `rangesOverlap(a, b)` returns true whenever `a.start <= b.end && b.start <=
  a.end` (calendar-day string/date comparison, inclusive on both ends) — the standard interval-
  overlap test, applied literally to FR-0014's "inclusive overlap on any shared day" wording.
  Capacity is summed across every assignment for an employee where this function returns true
  against the assignment being created/edited.
- **Rationale**: This is not a new decision — FR-0014 already specifies this exact rule in the
  PRD. This entry exists only to record that it is implemented literally, not reinterpreted.
- **Alternatives considered**: Requiring full containment, or excluding boundary days
  (exclusive overlap) — both explicitly rejected by FR-0014's own wording ("inclusive overlap
  on any shared day"), not reopened here.

## Decision: Skill-match tiering reuses existing employee-skill and role-required-skill data

- **Decision**: The candidates endpoint's tier computation
  (`assignment.service.ts`/`assignment.repository.ts`) reads `EmployeeSkill` records (EPIC-0001)
  and `ProjectRole.requiredSkills` (EPIC-0002) as-is via their existing repositories/queries — no
  new skill-related schema or validation is introduced.
- **Rationale**: Both entities and their proficiency/requirement semantics are already fully
  specified and implemented; re-deriving them here would violate constitution Principle I
  (treat the upstream chain as authoritative) in the same way EPIC-0002 already avoided for
  skill-existence validation.
- **Alternatives considered**: Denormalizing a skill-match cache table — rejected as unnecessary
  complexity at demo scale (tens of employees), where computing the tier per-request is trivial.

## Decision: Request `projectId` is validated against the role's actual parent project

- **Decision**: `AssignmentCreateRequest` requires both `projectId` and `roleId` (per the
  OpenAPI schema — `projectId` is not server-derived). `assignment.service.ts` validates that
  the supplied `projectId` matches `ProjectRoleRecord.projectId` for the given `roleId`,
  rejecting the request with a `ValidationError` on mismatch.
- **Rationale**: The OpenAPI spec's inclusion of both fields together implies they must be
  consistent, but neither the PRD nor the BFF Contract states this explicitly. Silently
  trusting the client's `projectId` (ignoring the role's real parent) or silently overriding it
  would both be worse than rejecting an inconsistent request outright — flagged as a resolved
  gap in spec.md's Assumptions rather than assumed silently.
- **Alternatives considered**: Ignoring the request's `projectId` entirely and deriving it
  server-side from the role — rejected, since the OpenAPI spec (authoritative per constitution
  Principle I) requires the field as part of the request body, implying the client is expected
  to supply a correct value, not have it silently overridden.

## Decision: One shared `getCurrentUtilization` function, not two independent aggregations

- **Decision**: `assignment.service.ts` exposes `getCurrentUtilization(employeeId): Promise<number>`
  — the single implementation of "sum this employee's capacity % across assignments overlapping
  today," internally using `date-utils.ts` to decide which assignments count as current. Both
  the discharged `Employee` response path (`employees.routes.ts`'s `currentUtilizationPercent`)
  and the new `CandidateEmployee` response path (the candidates endpoint's
  `currentUtilizationPercent`) call this one function. Neither computes or sums assignment
  capacity independently.
- **Rationale**: This is the same centralization principle NFR-0009 already applies to raw date
  comparisons (`isInFuture`/`rangesOverlap`), applied one level up: "what counts as an
  employee's current utilization" is itself a piece of business logic that could silently drift
  between two call sites even if both happen to call the same underlying date primitives — e.g.,
  one path could accidentally sum *all* assignments instead of only overlapping-today ones, or
  round differently. A single named function makes that class of bug structurally impossible,
  the same way centralizing `isInFuture` does for the future/past rule.
- **Alternatives considered**: Letting `employees.routes.ts` and the candidates route each query
  and sum independently (even if both call `date-utils.ts` underneath) — rejected per the
  reasoning above; this is exactly the kind of two-independent-implementations risk the
  constitution's Principle II and SDP NFR-0009 both exist to prevent, and it applies here even
  though the duplication would be at a higher level than raw date comparisons.

## Decision: Discharging the three cross-epic stubs is a first-class, explicit task set

- **Decision**: `employee.repository.ts`'s `hasAnyAssignments` and `project.repository.ts`'s
  `hasAnyAssignments`/`roleHasAnyAssignments` are changed from hardcoded `false` to real Kysely
  existence queries against the new `assignments` table. Each change is its own dedicated task
  in `tasks.md` (not folded silently into the `assignments` table migration task), and each is
  paired with: (a) new test cases added to that epic's *own* existing test files (not new files
  in this epic), and (b) an update to that epic's `data-model.md` and `tasks.md` marking the
  follow-up resolved.
- **Rationale**: Explicitly instructed by the user, and directly continues the precedent
  EPIC-0002 set for discharging EPIC-0001's `countProjectRoleAssociations` debt (its own
  dedicated task T027, with test coverage added to EPIC-0001's existing files, and EPIC-0001's
  documentation updated to reflect resolution).
- **Alternatives considered**: Treating the stub replacements as an implicit side-effect of the
  migration task — rejected, since burying a data-integrity-relevant change inside an unrelated
  task's description is exactly the kind of ambiguity the constitution's traceability principle
  and this project's `/speckit.analyze` history have repeatedly flagged as a defect elsewhere.

## Decision: A fourth, previously-undischarged EPIC-0001 forward-reference is discharged alongside the three named stubs

- **Decision**: `employees.routes.ts`'s hardcoded `currentUtilizationPercent: 0` and
  `assignments: []` (in the `Employee` detail/summary responses) are also replaced with real
  computed values in this epic, even though the user's planning input named only the three
  `hasAnyAssignments`/`roleHasAnyAssignments` stubs explicitly.
- **Rationale**: EPIC-0001's own `data-model.md` already documents this field as "sourced from
  the Assignment Engine epic once it exists" — an explicit forward reference to this exact
  epic, discovered during this epic's design rather than requested verbatim. Leaving it
  unresolved while simultaneously fixing three sibling stubs in the same table would recreate
  the exact "undischarged, undisclosed debt" problem this project has repeatedly caught via
  `/speckit.analyze` — except this time in a case where the resolution was already scheduled by
  name in a prior epic's own documentation.
- **Alternatives considered**: Leaving it as-is since it wasn't named in this epic's planning
  input — rejected, since silently leaving a previously-documented "once this epic exists"
  forward reference unresolved, in an epic literally about that reference's dependency, would
  itself be a new inconsistency this plan should not introduce. This decision is called out
  explicitly (not silently expanded scope) precisely so the user can review and push back if
  they'd rather defer it.

## Decision: Testing strategy

- **Decision**: Same pattern as EPIC-0001/EPIC-0002 — Vitest unit tests with repository test
  doubles (extending `tests/helpers/fakes.ts` with a `FakeAssignmentRepository`), a dedicated
  pure-function test file for `date-utils.ts` targeting 100% branch coverage on boundary cases
  (exactly today, single-day overlap, zero overlap, full containment, partial overlap),
  integration tests against a real temp-file SQLite database with cleanup, and contract tests
  asserting response shapes against `openapi-spec.yaml`.
- **Rationale**: Constitution Principle III, NFR-0001, NFR-0002 — unchanged from precedent.
  `date-utils.ts` gets special attention (100% branch target, not just 70%) because it is pure,
  cheap to fully cover, and because NFR-0009's entire purpose is undermined if its one shared
  implementation has an untested edge case that then propagates incorrectly to every rule that
  depends on it.
- **Alternatives considered**: None — direct continuation of validated precedent.
