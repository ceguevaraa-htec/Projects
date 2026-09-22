# API Contract: Bench & Reporting (EPIC-0004)

This is **not** a new or re-derived contract. Per constitution Principle I, the authoritative
API contract for this project is `specs/contracts/openapi-spec.yaml`. This file is an index
into that spec, scoped to the paths and schemas this epic implements. If this index and the
OpenAPI spec ever disagree, the OpenAPI spec wins — update this index, not the other way around.

## Endpoints in scope

| Method | Path | OpenAPI operation | FR |
|---|---|---|---|
| GET | `/bench?window=now\|30d\|60d\|90d` | Bench view for the given window | FR-0019, FR-0020 |
| GET | `/reports/org` | Org-wide PDF report | FR-0021 |
| GET | `/reports/employees/{employeeId}` | Per-employee PDF report | FR-0022 |
| GET | `/reports/projects/{projectId}` | Per-project PDF report | FR-0023 |

**Explicitly out of scope for this epic**: `/employees/{employeeId}/my-assignments`
(Employee Self-Service, EPIC-0005) and any search/filter enhancements to existing endpoints
(EPIC-0006).

## Schemas in scope

`BenchEntry` (with the `utilizationPercent` field's per-window semantics now documented
directly on the schema — see the OpenAPI spec's updated description), `ErrorResponse`. The
three report endpoints return `application/pdf` binary with no JSON schema — their internal
data shape is this epic's own design (see `data-model.md`'s Report Data section), not
constrained by the OpenAPI spec.

## Error codes this epic must produce

All via the shared `ErrorResponse` schema (`{ error_code, message }`), per NFR-0005/ADR-0009 —
**no new error codes introduced**, both reused from prior epics:

| `error_code` | HTTP status | Raised when |
|---|---|---|
| `NOT_FOUND` | 404 | `GET /reports/employees/{employeeId}` or `GET /reports/projects/{projectId}` targets a nonexistent ID — reuses the existing `EmployeeNotFoundError`/`ProjectNotFoundError` (EPIC-0001/EPIC-0002), not a new report-specific error type. |
| `VALIDATION_ERROR` | 400 | `GET /bench` called with a missing or invalid `window` value (the OpenAPI spec marks `window` `required` with an `enum: [now, 30d, 60d, 90d]`, but validation is still this epic's own responsibility to implement) — reuses the existing `ValidationError`, not a new bench-specific error type. |
