# API Contract: Assignment Engine (EPIC-0003)

This is **not** a new or re-derived contract. Per constitution Principle I, the authoritative
API contract for this project is `specs/contracts/openapi-spec.yaml`. This file is an index
into that spec, scoped to the paths and schemas this epic implements. If this index and the
OpenAPI spec ever disagree, the OpenAPI spec wins — update this index, not the other way around.

## Endpoints in scope

| Method | Path | OpenAPI operation | FR |
|---|---|---|---|
| GET | `/projects/{projectId}/roles/{roleId}/candidates` | List candidates with skill-match tier | FR-0018 |
| POST | `/assignments` | Create assignment | FR-0013, FR-0014, FR-0015 |
| GET | `/assignments/{assignmentId}` | Get assignment detail | (read access) |
| PATCH | `/assignments/{assignmentId}` | Edit assignment (future-dated only) | FR-0016 |
| DELETE | `/assignments/{assignmentId}` | Cancel assignment (future-dated only) | FR-0017 |

**Modified in this epic (not a new endpoint, a behavior change)**:
- `DELETE /employees/{employeeId}` (EPIC-0001) — `hasAnyAssignments` now reflects real data.
- `DELETE /projects/{projectId}` and `DELETE /projects/{projectId}/roles/{roleId}` (EPIC-0002)
  — `hasAnyAssignments`/`roleHasAnyAssignments` now reflect real data.
- `GET /employees` and `GET /employees/{employeeId}` (EPIC-0001) — `currentUtilizationPercent`
  and embedded `assignments` now reflect real data (see plan.md/research.md for why this is in
  scope).

**Explicitly out of scope for this epic** (present in the full OpenAPI spec, but not
implemented here): `/bench`, `/reports/*`, `/employees/{employeeId}/my-assignments`.

## Schemas in scope

Use these schemas verbatim from `specs/contracts/openapi-spec.yaml#/components/schemas`:
`Assignment`, `AssignmentCreateRequest`, `AssignmentUpdateRequest`, `CandidateEmployee`,
`MatchTier`, `ErrorResponse`.

## Error codes this epic must produce

All via the shared `ErrorResponse` schema (`{ error_code, message }`), per NFR-0005/ADR-0009:

| `error_code` | HTTP status | Raised when |
|---|---|---|
| `NOT_FOUND` | 404 | Assignment, employee, project, or role ID does not exist. |
| `CAPACITY_EXCEEDED` | 409 | Create/edit would push the employee's overlapping-date capacity above 100% (FR-0014). |
| `PROJECT_NOT_ACTIVE` | 409 | Create attempted against a non-Active project (FR-0015). |
| `ASSIGNMENT_NOT_EDITABLE` | 409 | Edit attempted on an assignment whose start date is today or in the past (FR-0016). |
| `ASSIGNMENT_NOT_CANCELLABLE` | 409 | Cancel attempted on an assignment whose start date is today or in the past (FR-0017). |
| `VALIDATION_ERROR` | 400 | Missing/invalid required fields, `capacityPercent` outside 1–100, `endDate` before `startDate`, or a mismatched `projectId`/`roleId` pairing (see data-model.md's resolved gap). |

**Reused from EPIC-0001/EPIC-0002, not redefined**: `NOT_FOUND` is also raised (with the
existing `EmployeeNotFoundError`/`ProjectRoleNotFoundError`) when `employeeId`/`roleId`
references a nonexistent record — no parallel error type is introduced for these cases.
