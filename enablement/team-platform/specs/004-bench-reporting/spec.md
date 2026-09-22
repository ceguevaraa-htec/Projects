# Feature Specification: Bench & Reporting (EPIC-0004)

**Feature Branch**: `004-bench-reporting`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Implement EPIC-0004 (Bench & Reporting) from the PRD, covering FR-0019 through FR-0023: a real-time bench view showing employees whose total assigned capacity as of today is below 100% (FR-0019), the same view projected against fixed preset windows — Next 30/60/90 days, in addition to Now (FR-0020) — and three PDF report scopes: org-wide (FR-0021), per-employee (FR-0022), and per-project (FR-0023), each summarizing allocations and utilization."

**Source of truth**: Per the project constitution, this spec does not restate requirements in new language where the PRD and OpenAPI spec already define them precisely. Functional Requirements below reference `specs/PRD-Team-Allocation-Platform.md` FR-0019–FR-0023 directly, and relevant paths in `specs/contracts/openapi-spec.yaml` (`/bench`, `/reports/org`, `/reports/employees/{employeeId}`, `/reports/projects/{projectId}`) are the authoritative API contract.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See who's underutilized, now and looking ahead (Priority: P1)

A Resource/Delivery Manager views the bench — every employee whose total assigned capacity is below 100% — as of today, and can project the same view against fixed future windows (30/60/90 days out) to see who becomes available soon, not just who's free right now.

**Why this priority**: This is the direct payoff of everything the Assignment Engine epic built — capacity data only becomes actionable staffing intelligence once a Manager can actually see who's free. It has no dependency on reporting, so it stands alone as the epic's MVP slice.

**Independent Test**: Can be fully tested by creating employees with varying assignment loads (fully booked, partially booked, fully free) and confirming the bench view correctly includes only the under-100%-capacity employees for "Now," and that switching to each of the 30/60/90-day windows correctly reflects assignments that start or end within that window.

**Acceptance Scenarios**:

1. **Given** an employee with less than 100% capacity assigned as of today, **When** a Manager requests the bench view for "Now," **Then** the employee appears with their current utilization % (FR-0019).
2. **Given** an employee assigned at exactly 100% capacity as of today, **When** a Manager requests the bench view for "Now," **Then** the employee does not appear (they have zero available capacity).
3. **Given** an employee who is fully booked today but has capacity freeing up within the next 30 days (e.g., an assignment ending in 15 days with nothing replacing it), **When** a Manager requests the bench view for the "Next 30 days" window, **Then** the employee appears, with their utilization for that window computed as their *lowest* concurrent capacity on any single day within `[today, today+30]` — i.e., their most-available day in the window — since a Manager checking "who's free in the next 30 days" is asking who has real room somewhere across that whole span, not who happens to be free on one specific future date, and not an assignment-count-agnostic sum that could falsely exclude someone with substantial real availability (FR-0020; resolved ambiguity, see Assumptions).
4. **Given** the same employee data, **When** a Manager switches between Now/30/60/90-day windows, **Then** each window is computed independently using the shared date-comparison logic already established in the Assignment Engine epic — no window's computation drifts from how "today" or "future" is defined elsewhere in the system.

---

### User Story 2 - Generate a PDF report of allocations and utilization (Priority: P2)

A Manager generates a downloadable PDF snapshot of allocations and utilization, scoped to the whole org, a single employee, or a single project — a shareable artifact for staffing conversations that don't happen inside the tool itself.

**Why this priority**: Reporting is a valuable but secondary capability layered on top of the same underlying data the bench view already surfaces — it has no bearing on whether the bench view itself works, so it is prioritized second.

**Independent Test**: Can be fully tested by requesting each of the three report scopes (org-wide, a specific employee, a specific project) and confirming a valid PDF is returned reflecting that scope's real allocation/utilization data, independent of whether the bench view has ever been viewed.

**Acceptance Scenarios**:

1. **Given** any state of the system, **When** a Manager requests the org-wide report, **Then** the system returns a PDF summarizing every employee's allocations and utilization (FR-0021).
2. **Given** an existing employee, **When** a Manager requests that employee's report, **Then** the system returns a PDF summarizing that employee's assignment history and utilization (FR-0022).
3. **Given** an existing project, **When** a Manager requests that project's report, **Then** the system returns a PDF summarizing that project's staffing — assigned employees, their roles, and capacity % (FR-0023).
4. **Given** a nonexistent employee or project ID, **When** a Manager requests that scope's report, **Then** the system rejects the request with a structured not-found error rather than generating an empty or malformed PDF.

---

### Edge Cases

- What happens when no employees exist at all? The bench view MUST return an empty list (not an error) for every window — "no bench capacity" is a valid, expected state, not a failure.
- What happens when an employee has zero assignments at all (never staffed)? They MUST appear on the bench at 0% utilization in every window — an unstaffed employee is, by definition, fully available.
- What happens when a Manager requests the org-wide report while the org has zero employees or zero projects? The system MUST still return a valid (if sparse) PDF rather than erroring — an empty organization is a valid state to report on.
- What happens when the bench view's 30/60/90-day windows are computed? Per FR-0020 and this epic's structural requirement, each window's utilization MUST be computed using the same shared date-comparison logic (`date-utils.ts`'s `rangesOverlap`) already established in the Assignment Engine epic, applied per-day across `[today, today+N]` to find the employee's minimum concurrent capacity in that window (range-based, day-level precision — see the resolved ambiguity in Assumptions) — not a new, independent date calculation, and not a coarser whole-range sum.
- What happens when an employee has two assignments that don't overlap each other but both fall within a wider bench window (e.g., 50% for the window's first third, a separate 50% for its last third, with a real gap between them)? Because utilization is computed as the minimum per-day concurrent capacity (not a whole-range sum), the employee correctly appears on that window's bench — on any day within the gap between the two assignments, their concurrent capacity is 0%, which is what the window's `utilizationPercent` reflects.
- What happens when an employee is fully booked for part of a window but completely free for the rest of it (e.g., 100% for the window's first week, free afterward)? They correctly appear on that window's bench, with `utilizationPercent` reflecting their most-available day (0% in this example) — a whole-range-sum or peak-day approach would have wrongly excluded them.
- What happens when report generation is requested for a report scope with a very large amount of data (edge of demo scale)? Per the PRD's non-functional requirements, this is expected to remain fast at demo scale (tens of employees); no pagination or async job queue is introduced for report generation in this epic.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-0019** (PRD): Manager can view all employees whose total assigned capacity as of today is below 100%, showing each employee's current utilization %. Maps to `GET /bench?window=now`.
- **FR-0020** (PRD): Manager can view the same underutilization view projected against fixed preset windows — Next 30 days, Next 60 days, Next 90 days — in addition to Now. No arbitrary custom date range is supported. Maps to `GET /bench?window=30d|60d|90d`.
- **FR-0021** (PRD): Manager can generate a downloadable PDF summarizing allocations and utilization % for all employees across all projects. Maps to `GET /reports/org`.
- **FR-0022** (PRD): Manager can generate a downloadable PDF summarizing one employee's assignment history (past, current, future) and utilization %. Maps to `GET /reports/employees/{employeeId}`.
- **FR-0023** (PRD): Manager can generate a downloadable PDF summarizing one project's staffing — assigned employees, their roles, and capacity %. Maps to `GET /reports/projects/{projectId}`.
- Every non-2xx response from the endpoints above MUST use the `{ error_code, message }` error envelope (SDP NFR-0005/ADR-0009), with a not-found code for an unknown `employeeId`/`projectId` on the scoped report endpoints.

### Key Entities

- **BenchEntry** (read model, not a stored entity): One employee's projected utilization and available capacity as of a given window (Now/30/60/90 days), computed from existing `Assignment` data (EPIC-0003) via the shared `date-utils.ts` module — no new schema.
- **Report data** (read model, not a stored entity): The aggregated allocation/utilization figures assembled for each of the three PDF scopes, computed from existing `Employee` (EPIC-0001), `Project`/`ProjectRole` (EPIC-0002), and `Assignment` (EPIC-0003) data — no new schema. This epic introduces no new persisted entities at all; it is read-only over data every prior epic already created.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Manager can view the current bench (Now) in a single request, with every under-100%-capacity employee correctly included and every fully-booked employee correctly excluded, verified end-to-end via integration tests.
- **SC-002**: A Manager can switch between all four bench windows (Now/30/60/90 days) and see each window's utilization computed as the minimum day-level concurrent capacity across `[today, today+N]` (the resolved ambiguity — day-level precision, not a point-in-time snapshot or a false-negative-prone whole-range sum), built on the same `date-utils.ts` `rangesOverlap` primitive already used for capacity validation in the Assignment Engine — no window-specific or independently-invented date logic, verified via unit tests including the two-non-overlapping-partial-assignments and "busy-then-free" cases.
- **SC-003**: A Manager can generate all three PDF report scopes (org-wide, per-employee, per-project) and receive a valid PDF file reflecting real, current data — not a placeholder or stale snapshot — verified end-to-end via integration tests.
- **SC-004**: 100% of report requests against a nonexistent employee or project ID are rejected with a structured not-found error rather than producing a malformed or empty-but-200 PDF, verified end-to-end via integration tests.

## Assumptions

- This spec covers only EPIC-0004 (Bench & Reporting) as scoped by the user's request: FR-0019 through FR-0023. Employee Self-Service (EPIC-0005) and Search/Filter UI enhancements (EPIC-0006) are explicitly out of scope for this feature and will be specified separately, each on its own feature branch.
- No authentication/authorization exists (per SDP ADR-0011); all actions in this spec are implicitly performed by the Manager role, consistent with the UX Specification's role-switcher model — both the bench view and all three report scopes are Manager-facing only.
- **The bench view's window computation reuses `date-utils.ts` as a structural requirement, not an open design choice.** This was explicitly flagged in EPIC-0003's spec.md Assumptions when the module was first created ("by structural dependency, once specified, the Bench epic's window computation" must reuse it). This epic does not introduce any independent date-comparison logic.
- **PDF report-data assembly lives in Domain Logic, not the PDF-generation layer.** This was explicitly resolved during the SDP's Architectural Design review (see `specs/SDP-Team-Allocation-Platform.md`'s Container Diagram and Rationale) specifically so report figures can never drift from what the bench view or any other feature computes from the same underlying `Assignment` data. The PDF-generation layer (pdfkit, per SDP ADR-0006) is a thin rendering step over data Domain Logic already assembled — it performs no independent aggregation or querying.
- The three PDF report scopes introduce no new persisted data — they are entirely read-only aggregations over `Employee` (EPIC-0001), `Project`/`ProjectRole` (EPIC-0002), and `Assignment` (EPIC-0003) data already created by prior epics.
- **Resolved ambiguity — the forward-looking bench windows are range-based, computed from true day-level concurrent capacity, not a whole-range capacity sum.** FR-0020's "projected against fixed preset windows" admits multiple readings; two were considered and rejected before arriving at the one below:
  - *Point-in-time* (utilization on exactly the window's end date) — rejected: it ignores everything that happens between today and that single future date.
  - *Whole-range capacity sum* (sum of capacity % across every assignment overlapping `[today, today+N]`) — rejected: this double-counts assignments that don't overlap *each other* but both overlap the window (e.g., two separate 50% assignments in different weeks of a 90-day window sum to 100%+, even though the employee is never actually double-booked and has substantial real availability). This produces false negatives that defeat the bench view's purpose.
  - **Adopted — day-level minimum concurrent capacity**: for a given window, compute the employee's *concurrent* capacity (sum of capacity % from assignments actually active) on each individual day within `[today, today+N]`, then take the **minimum** of those per-day values as the window's `utilizationPercent`. An employee appears on that window's bench if this minimum is below 100% — i.e., there exists at least one day in the window where they are not fully booked. `availableCapacityPercent` is `100 - utilizationPercent`. This correctly includes an employee who is 100% booked for the first few days of a window but free for the rest of it (the earlier "whole-range sum" approach would have wrongly excluded them if any other assignment also touched the window), and correctly includes the two-non-overlapping-partial-assignments case above (neither day range reaches 100% concurrently, so the minimum stays well under 100%).
  - **Computation**: per-day concurrent capacity is computed via `date-utils.ts`'s existing `rangesOverlap`, called once per day in the window against a zero-duration `{start: day, end: day}` range for each of the employee's assignments. No new *comparison/overlap* logic is introduced — `rangesOverlap` remains the sole primitive for that. Generating the window's day list does require `today()` (an export of `date-utils.ts`'s already-existing private "today" computation — exposed during implementation rather than duplicated via a second `new Date()` call) and a new `addDays()` arithmetic helper; both are pure date-value generation, not comparison logic, and both live in `date-utils.ts` for the same centralization reason as everything else in that module. This is a heavier calculation (up to 90 day-iterations per employee for the 90-day window) than the single-call `rangesOverlap` check capacity validation uses, since day-level precision is what "who has room somewhere in this window" actually requires.
  - **Deliberate divergence from FR-0014, flagged explicitly so it isn't mistaken for an inconsistency**: FR-0014's assignment-capacity-conflict check (EPIC-0003, already implemented and ratified) uses the coarser whole-range sum approach discussed and rejected above — that was an explicit, deliberate product decision made and confirmed during the PRD stage for FR-0014 specifically ("pure capacity-sum check only"), and is out of scope to revisit here. The bench view's day-level algorithm is intentionally more precise for a different purpose (finding real availability) and is not required to match FR-0014's algorithm — they answer different questions ("would this specific new assignment conflict" vs. "does this employee have any room at all in this span") and are allowed to use different techniques.
  - **Field semantics, to be carried into `data-model.md` and the OpenAPI spec's `BenchEntry.utilizationPercent` description**: for `window=now`, `utilizationPercent` is the employee's actual current utilization (a single well-defined value, consistent with FR-0019). For `window=30d|60d|90d`, it is the employee's minimum committed capacity at their single most-available point within the window — not an average across the window, and not a snapshot at the window's end date. This distinction is documented on the field itself (not just here) since a consumer of the API has no other way to know the value means something different depending on the `window` parameter.
  - **Accepted trade-off, not a defect**: because `utilizationPercent` for a multi-day window reflects only the single most-available point, an employee with just one genuinely free day in an otherwise-packed 90-day window will appear on that window's bench showing a similarly low utilization number as an employee with weeks of real, contiguous availability. The bench view intentionally answers "does this employee have room *somewhere* in this window," not "how much of this window is this employee free for" — a Manager relying on the bench list should still open an employee's detail/assignment history to judge the *size* of their availability before staffing them for a multi-week commitment. This is correct, intended behavior, not something to fix later.
- Demo-scale data volumes apply (tens of employees, a handful of concurrent projects, per the PRD); no pagination is assumed for the bench view, and no async/background job processing is introduced for PDF generation, consistent with the BFF Contract and SDP's local, single-process deployment model.
- **Resolved gap — the per-project report (FR-0023) is scoped to current staffing only, matching the org-wide report's convention.** FR-0023's "assigned employees, their roles, and capacity %" reads as present-tense staffing, not a historical record — unlike FR-0022's per-employee report, which explicitly requires past/current/future history. This was not stated explicitly anywhere until caught during Phase 1 design; see `data-model.md`'s per-project report entry for the resolution.
- **Resolved gap — the org-wide report (FR-0021) is likewise scoped to current-only.** FR-0021's org-wide report scope (current vs. full assignment history) is not stated explicitly in the PRD; this spec resolves it as current-only, matching FR-0023's per-project report resolution and contrasting with FR-0022's per-employee report, which explicitly requires full history. This keeps "a snapshot of present staffing" consistent across both aggregate report scopes (org-wide and per-project), while the single-employee report remains the one scope with a full historical record, per the PRD's own explicit wording for FR-0022.
