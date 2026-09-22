# Phase 1 Data Model: Bench & Reporting (EPIC-0004)

This epic introduces **zero new persisted entities and zero schema changes**. Both read models
below are computed entirely from `Employee` (EPIC-0001), `Skill`/`EmployeeSkill` (EPIC-0001),
`Project`/`ProjectRole` (EPIC-0002), and `Assignment` (EPIC-0003) data already created by prior
epics.

## BenchEntry (read model, not a stored entity)

Corresponds to OpenAPI schema `BenchEntry`. Returned by `GET /bench?window=now|30d|60d|90d`.

| Field | Type | Notes |
|---|---|---|
| `employeeId` | UUID | |
| `name` | string | |
| `utilizationPercent` | integer 0–100 | **Field semantics differ by window, and this distinction is documented on the OpenAPI schema field itself (not just here), since an API consumer has no other way to know it:** for `window=now`, this is the employee's actual current utilization (identical to what `AssignmentService.getCurrentUtilization` returns for today). For `window=30d\|60d\|90d`, this is the employee's **minimum** per-day concurrent capacity across `[today, today+N]` — i.e., their single most-available day in the window — not an average, and not a snapshot at the window's end date. See "Window Algorithm" below. |
| `availableCapacityPercent` | integer 0–100 | `100 - utilizationPercent`. |
| `skills` | `EmployeeSkill[]` | Reused from EPIC-0001's existing `EmployeeSkillRecord` shape as-is; shown for quick scanning per the UX Specification, not recomputed. |

**Inclusion rule**: an employee appears in the bench list for a given window if and only if
`utilizationPercent < 100` for that window (FR-0019/FR-0020). This is a filter over all
employees, not a separate query — every employee's window utilization is computed, and only
those below 100 are returned.

### Window Algorithm (the resolved ambiguity from spec.md, restated precisely for implementation)

For a given window parameter, resolve it to a day count `N`: `now` → `N = 0`, `30d` → `N = 30`,
`60d` → `N = 60`, `90d` → `N = 90`. The window's date range is `[today, today + N]` inclusive
(a single day when `N = 0`).

For each employee:
1. For each day `d` in `[today, today + N]`:
   - Compute `concurrentCapacity(d)` = sum of `capacityPercent` across all of the employee's
     `Assignment` rows where `date-utils.ts`'s `rangesOverlap({start: assignment.startDate, end:
     assignment.endDate}, {start: d, end: d})` is true.
2. `utilizationPercent` = the **minimum** of `concurrentCapacity(d)` over all `d` in the window.

This is the same `rangesOverlap` primitive already used for FR-0014's capacity validation
(EPIC-0003), applied per-day rather than against a single candidate range — see research.md for
why day-level minimum (not a whole-range sum, and not a peak/maximum) is the correct semantic,
with the two rejected alternatives' counterexamples recorded there and in spec.md's Assumptions.

**Accepted trade-off** (from spec.md, restated for implementers): an employee with only one
genuinely free day in an otherwise fully-booked window will show the same low
`utilizationPercent` as an employee with weeks of real availability. This is intended — the
bench view answers "has room somewhere," not "how much room."

## Report Data (internal, not OpenAPI-constrained — see research.md)

The three PDF report scopes are assembled by `reports.service.ts` into internal shapes with no
corresponding OpenAPI schema (the API response is `application/pdf` binary). All three are
intentionally minimal, per the PRD's own flagged "report scope creep" risk (see
`specs/PRD-Team-Allocation-Platform.md`'s Risks & Open Questions) — allocations and utilization
numbers only, no charts or extra analytics.

### Org-wide report data (FR-0021)

| Field | Source |
|---|---|
| Every employee's name, seniority, and current utilization % | `EmployeeRepository.findAll`, `AssignmentService.getCurrentUtilization` per employee (the same shared function `employees.routes.ts` and the candidates endpoint already use — no independent utilization computation, per this epic's structural requirement). |
| Every employee's current assignments (project name, role name, capacity %) | `AssignmentRepository.findAllForEmployee`, filtered to `temporalStatus: "current"`. |

### Per-employee report data (FR-0022)

| Field | Source |
|---|---|
| The employee's name, seniority | `EmployeeRepository.findById` — 404 via existing `EmployeeNotFoundError` if missing. |
| Full assignment history (past, current, future) | `AssignmentRepository.findAllForEmployee`, unfiltered — the PRD explicitly requires past/current/future for this scope, unlike the org-wide scope's current-only view. |
| Current utilization % | `AssignmentService.getCurrentUtilization` — same shared function, not recomputed. |

### Per-project report data (FR-0023)

**Resolved gap — scope is current-only, matching the org-wide report's convention.** FR-0023's
"assigned employees, their roles, and capacity %" reads as present-tense staffing, not a
historical record (unlike FR-0022's per-employee report, which explicitly requires past/
current/future). This spec resolves it: the per-project report shows only assignments with
`temporalStatus: "current"` as of generation time — the project's staffing *right now*, not its
full staffing history. This was not stated explicitly in the original data-model.md draft and
is called out here rather than left to the unfiltered `findAllForProject` query's default
behavior.

| Field | Source |
|---|---|
| The project's name, status, dates | `ProjectRepository.findById` — 404 via existing `ProjectNotFoundError` if missing. |
| Every required role (name, capacity %) and the employees **currently** assigned to it (name, capacity %) | `ProjectRepository.findRolesForProject` joined against **a new `AssignmentRepository.findAllForProject(projectId)` method**, filtered in `reports.service.ts` to `temporalStatus: "current"` (the same filter the org-wide report already applies — see above). No prior epic needed "all assignments for a project" (only "all assignments for an employee," via `findAllForEmployee`), so `findAllForProject` is a genuine, small extension to the existing repository interface, not a new repository. The repository method itself returns all assignments unfiltered (past/current/future); the current-only scoping is a Domain Logic decision in `reports.service.ts`, not a repository-level restriction — this keeps `findAllForProject` reusable as-is for a future epic that might need full project staffing history. |

## Relationships

No new relationships — this epic only reads existing `Employee` ↔ `EmployeeSkill` ↔ `Skill`,
`Project` ↔ `ProjectRole` ↔ `Skill`, and `Employee`/`ProjectRole` ↔ `Assignment` relationships
established by EPIC-0001/EPIC-0002/EPIC-0003.

## State Transitions

None — both read models are stateless computations over existing data with no lifecycle of
their own.
