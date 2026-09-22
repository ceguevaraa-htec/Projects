# Quickstart: Validating Bench & Reporting (EPIC-0004)

This guide describes how to prove the feature works end-to-end once implemented. It does not
contain implementation code — see `data-model.md` for the window algorithm and report data
shapes, and `contracts/bench-reporting.md` (pointing into `specs/contracts/openapi-spec.yaml`)
for the API contract.

## Prerequisites

- EPIC-0001, EPIC-0002, and EPIC-0003 already implemented and passing their own tests.
- `npm install` already run, including the new `pdfkit` dependency added by this epic.
- No environment variables or external services required. No new migration to run — this epic
  adds no database tables.

## Setup

1. Start the server (`npm run dev`), which now also serves `/bench` and `/reports/*`.

## Validation Scenarios

### 1. Bench view correctness across all four windows (User Story 1 / FR-0019, FR-0020)

1. Create three employees: **Fully Booked** (a current assignment at 100% capacity covering
   today), **Partially Booked** (a current assignment at 40% capacity), **Never Assigned** (no
   assignments at all).
2. `GET /bench?window=now` → expect **Partially Booked** (utilization 40) and **Never Assigned**
   (utilization 0) present; **Fully Booked** absent.
3. Add a fourth employee, **Busy-Then-Free**: a 100%-capacity assignment covering only the next
   7 days, nothing after. `GET /bench?window=30d` → expect **Busy-Then-Free** present, with a
   low `utilizationPercent` reflecting their free days later in the 30-day window (their
   minimum per-day concurrent capacity), not excluded by their initial 7 busy days.
4. Add a fifth employee, **Two Non-Overlapping Partials**: a 50%-capacity assignment in the
   window's first third and a separate, non-overlapping 50%-capacity assignment in its last
   third. `GET /bench?window=90d` → expect this employee present with a low utilization
   (well under 100, since the two assignments never coincide on the same day) — confirming the
   whole-range-sum approach was correctly rejected in favor of the day-level minimum.
5. `GET /bench` with no `window` parameter → expect `400` with `error_code: VALIDATION_ERROR`.

**Expected outcome**: The bench view correctly reflects real, day-level availability for every
window, with no false negatives from the rejected whole-range-sum or peak-based approaches.

### 2. PDF report generation across all three scopes (User Story 2 / FR-0021–FR-0023)

1. `GET /reports/org` → expect `200` with `Content-Type: application/pdf` and a non-empty body.
2. `GET /reports/employees/{employeeId}` for an existing employee → expect `200` with
   `Content-Type: application/pdf`.
3. `GET /reports/employees/does-not-exist` → expect `404` with `error_code: NOT_FOUND`.
4. `GET /reports/projects/{projectId}` for an existing project → expect `200` with
   `Content-Type: application/pdf`.
5. `GET /reports/projects/does-not-exist` → expect `404` with `error_code: NOT_FOUND`.

**Expected outcome**: All three report scopes generate a valid PDF for real data and correctly
reject nonexistent IDs, without ever returning a malformed or empty-but-200 response.

## Definition of Done for this Quickstart

- Both scenarios pass as integration tests against a real, freshly-seeded SQLite database, torn
  down after the test run (NFR-0002).
- Unit tests for `bench.service.ts` independently cover the busy-then-free and
  two-non-overlapping-partials cases at >70% coverage (NFR-0001), plus the `now`-as-degenerate-
  case consistency check (SC-002).
- Unit tests for `reports.service.ts` independently cover not-found handling for both scoped
  report endpoints.
- Every error response observed above matches the `{ error_code, message }` envelope exactly,
  using only reused error types (`ValidationError`, `EmployeeNotFoundError`,
  `ProjectNotFoundError`) — no new error type is introduced by this epic.
