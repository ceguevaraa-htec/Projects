# Phase 0 Research: Bench & Reporting (EPIC-0004)

No `NEEDS CLARIFICATION` markers remain — every technical decision was either specified
directly in the user's planning input, already ratified upstream (SDP, PRD), or resolved during
this epic's own spec.md review (the bench window semantics). This document records the
resulting decisions and their rationale.

## Decision: `bench.service.ts` and `reports.service.ts` as separate, new files

- **Decision**: Bench and report logic live in two new Domain Logic files, not folded into
  `assignment.service.ts`.
- **Rationale**: `assignment.service.ts` already owns five distinct concerns (creation,
  edit, cancel, skill-match tiering, `getCurrentUtilization`) across FR-0013–FR-0018; adding
  the bench window algorithm and report-data assembly would make it a catch-all file covering
  two more, materially different concerns (FR-0019/FR-0020 and FR-0021–FR-0023) that happen to
  read the same underlying data but serve different consumers (a live UI view vs. a downloadable
  document) and have no shared business rule with assignment creation/editing. The existing
  pattern in this codebase is one service per cohesive concern (`employee.service.ts`,
  `skill.service.ts`, `project.service.ts`, `assignment.service.ts`), not one service per
  entity table — bench and reports are new concerns, not new tables, but still warrant their
  own files by that same logic.
- **Alternatives considered**: Adding bench/report methods to `assignment.service.ts` — rejected
  per the above; a single combined `bench-and-reports.service.ts` — rejected as an arbitrary
  grouping of two features that don't share logic with each other either (bench needs the
  window algorithm, reports need per-scope aggregation), just a common dependency on
  `getCurrentUtilization` and existing repositories, which is normal and doesn't justify merging
  the files.

## Decision: `src/reports/pdf-renderer.ts` as its own top-level directory, not under `src/domain/`

- **Decision**: The pdfkit rendering code lives in a new `src/reports/` directory, sibling to
  `src/domain/`, `src/repositories/`, and `src/api/` — not inside `src/domain/` alongside the
  services.
- **Rationale**: The SDP's Container Diagram (`specs/SDP-Team-Allocation-Platform.md` §3.2)
  explicitly models "PDF Report Generator" as its own container-level component, distinct from
  "Domain Logic," specifically corrected during that document's own review to read data
  assembled by Domain Logic rather than query independently (see the SDP's Architectural Design
  Rationale). Placing the renderer inside `src/domain/` would blur that already-deliberate
  separation; a sibling directory keeps the code layout matching the architecture diagram it
  implements.
- **Alternatives considered**: `src/domain/pdf/` — rejected, since it would visually suggest the
  renderer is part of Domain Logic when the SDP explicitly treats it as a distinct, downstream
  consumer of Domain Logic's output. `src/api/pdf/` — rejected, since the renderer is not
  routing/request-handling concern either; it's a rendering utility invoked by the route layer.

## Decision: `pdfkit` as the PDF library

- **Decision**: `pdfkit` (MIT license), exactly as already named and justified in SDP ADR-0006.
- **Rationale**: This is not a new decision being made now — it was already ratified during the
  SDP's design phase specifically to avoid a headless-browser-based tool (heavyweight, assumes a
  production deployment target the Technical Constraints prohibit). This epic is simply the
  first one that actually needs a PDF library, so this is where the dependency is first
  installed.
- **Alternatives considered**: None reopened — see SDP ADR-0006's own Alternatives Considered
  for the original comparison against headless-browser-based rendering.

## Decision: Bench window algorithm implementation shape

- **Decision**: For a given window (`now`, `30d`, `60d`, `90d`), `bench.service.ts` computes,
  for every employee, the set of calendar days in `[today, today + N]` (a single day for
  `now`), and for each day, the employee's concurrent capacity — the sum of `capacityPercent`
  for every assignment whose range includes that day, tested via `date-utils.ts`'s
  `rangesOverlap(assignmentRange, { start: day, end: day })` (a zero-duration range for that
  day). The window's `utilizationPercent` is the **minimum** of these per-day values; the
  employee appears on the bench for that window if this minimum is below 100.
- **Rationale**: This is the algorithm resolved through explicit review in spec.md's
  Assumptions — a whole-range capacity sum was considered and rejected (double-counts
  non-overlapping assignments, producing false negatives), and a peak/maximum-based test was
  also considered and rejected (would exclude an employee who's busy only at the start of a
  window but free for the rest of it). The minimum-based test is the only one of the three that
  correctly answers "does this employee have real room somewhere in this window."
- **Alternatives considered**: Whole-range sum and peak/maximum — both explicitly rejected in
  spec.md with concrete counterexamples; not reopened here.

## Decision: `now` window is a degenerate case of the same algorithm, not a special path

- **Decision**: `window=now` is implemented as the same day-level algorithm with `N=0` (a
  single-day window: `[today, today]`), not a separate code path calling
  `AssignmentService.getCurrentUtilization` directly, even though that function computes the
  same value for a single day.
- **Rationale**: Keeping one algorithm for all four window values (rather than one path for
  `now` and a different one for `30d/60d/90d`) is what actually guarantees the consistency
  spec.md's SC-002 requires ("no window-specific drift"). If `now` used a different code path,
  a future change to the day-level algorithm could silently diverge from what `now` shows,
  reintroducing exactly the kind of duplicated-logic risk NFR-0009 exists to prevent — this
  time between two windows of the *same* feature, not two different features.
- **Alternatives considered**: Special-casing `now` to call `getCurrentUtilization` directly for
  a minor efficiency gain (avoiding a trivial single-iteration loop) — rejected; the
  efficiency gain is meaningless at demo scale and the consistency risk is not worth it.

## Decision: Report data assembly shape (internal contract, not OpenAPI-constrained)

- **Decision**: `reports.service.ts` exposes `assembleOrgReport()`, `assembleEmployeeReport
  (employeeId)`, and `assembleProjectReport(projectId)`, each returning a plain internal data
  structure (not defined in `openapi-spec.yaml`, since the three report endpoints return
  `application/pdf` binary with no JSON schema — the internal shape is this epic's own design
  choice, not constrained by the authoritative API contract). `pdf-renderer.ts` takes that data
  structure and produces a PDF buffer; it has no knowledge of `Employee`/`Project`/`Assignment`
  types or how to query for them.
- **Rationale**: Since the OpenAPI spec only constrains the *external* response
  (`application/pdf`), the internal data-assembly shape is free to be designed for clarity and
  reuse rather than mirroring any existing API schema. Keeping the renderer's input type
  independent of the repository/domain types (a small, report-specific shape) means
  `pdf-renderer.ts` never needs to import repository types, reinforcing that it cannot query
  anything itself even by accident.
- **Alternatives considered**: Passing raw `EmployeeRecord[]`/`AssignmentRecord[]` directly to
  the renderer and having it compute totals inline — rejected, since that would put aggregation
  logic in the rendering layer, exactly what the SDP's Architectural Design Rationale already
  ruled out.

## Decision: Not-found handling reuses existing error types

- **Decision**: `GET /reports/employees/{employeeId}` and `GET /reports/projects/{projectId}`
  reuse the existing `EmployeeNotFoundError`/`ProjectNotFoundError` (both already implemented,
  EPIC-0001/EPIC-0002) rather than introducing report-specific not-found error types.
- **Rationale**: The `error_code` these produce (`NOT_FOUND`) is already exactly what
  `contracts/employee-management.md`/`contracts/project-management.md` define for a missing
  employee/project; there is no scope-specific distinction a report consumer needs that a
  generic employee/project lookup doesn't already provide.
- **Alternatives considered**: `ReportEmployeeNotFoundError`/`ReportProjectNotFoundError` —
  rejected as unnecessary duplication of an already-correct error type for the same underlying
  condition (the referenced entity doesn't exist).

## Decision: Testing strategy

- **Decision**: Same pattern as all three prior epics — Vitest unit tests against Domain Logic
  (`bench.service.ts`, `reports.service.ts`) using existing repository test doubles (extending
  `tests/helpers/fakes.ts`'s `FakeAssignmentRepository`/`FakeEmployeeRepository`/
  `FakeProjectRepository` — no new fakes needed, since this epic introduces no new repository),
  integration tests against a real temp-file SQLite database with cleanup, and contract tests
  asserting response status/`Content-Type` against `openapi-spec.yaml` (not PDF byte-level
  content, which has no meaningful schema to assert against and isn't required by any FR).
- **Rationale**: Constitution Principle III, NFR-0001, NFR-0002 — unchanged from precedent.
- **Alternatives considered**: Asserting parsed PDF text content via a PDF-parsing library —
  rejected as disproportionate effort for a demo-scale project; the underlying data assembly
  (`reports.service.ts`) is unit- and integration-tested directly, which is what actually
  matters for correctness — the rendering step is intentionally "thin" per this epic's own
  design constraint, so there's little rendering-specific logic left to test beyond "does calling
  it produce a non-empty PDF with the right Content-Type."
