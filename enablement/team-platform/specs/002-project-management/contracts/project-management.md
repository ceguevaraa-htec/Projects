# API Contract: Project Management (EPIC-0002)

This is **not** a new or re-derived contract. Per constitution Principle I, the authoritative
API contract for this project is `specs/contracts/openapi-spec.yaml`. This file is an index
into that spec, scoped to the paths and schemas this epic implements. If this index and the
OpenAPI spec ever disagree, the OpenAPI spec wins — update this index, not the other way around.

## Endpoints in scope

| Method | Path | OpenAPI operation | FR |
|---|---|---|---|
| GET | `/projects` | List projects | (read access) |
| POST | `/projects` | Create project | FR-0009 |
| GET | `/projects/{projectId}` | Get project detail (embeds required roles) | (read access) |
| PATCH | `/projects/{projectId}` | Update project (dates, status transitions) | FR-0009 |
| DELETE | `/projects/{projectId}` | Delete project (blocked if assignments exist) | FR-0012 |
| POST | `/projects/{projectId}/roles` | Add required role | FR-0010 |
| PATCH | `/projects/{projectId}/roles/{roleId}` | Edit required role | FR-0010 |
| DELETE | `/projects/{projectId}/roles/{roleId}` | Remove required role (blocked if assignments reference it) | FR-0011 |

**Explicitly out of scope for this epic** (present in the full OpenAPI spec, but not
implemented here): `/projects/{projectId}/roles/{roleId}/candidates`, all `/assignments*`
paths, `/bench`, `/reports/*`, `/employees/{employeeId}/my-assignments`.

**Modified in this epic (not a new endpoint, a behavior change)**: `GET /skills/{skillId}/deletion-impact`
(EPIC-0001) now returns a real `affectedProjectRoleCount` instead of a hardcoded `0`, per this
epic's discharge of EPIC-0001's tracked follow-up. The endpoint's shape is unchanged.

## Schemas in scope

Use these schemas verbatim from `specs/contracts/openapi-spec.yaml#/components/schemas`:
`Project`, `ProjectSummary`, `ProjectCreateRequest`, `ProjectUpdateRequest`, `ProjectRole`,
`ProjectRoleCreateRequest`, `ProjectRoleUpdateRequest`, `ProjectStatus`, `ErrorResponse`.

## Error codes this epic must produce

All via the shared `ErrorResponse` schema (`{ error_code, message }`), per NFR-0005/ADR-0009:

| `error_code` | HTTP status | Raised when |
|---|---|---|
| `NOT_FOUND` | 404 | Project or role ID does not exist. |
| `PROJECT_HAS_ASSIGNMENTS` | 409 | Delete attempted on a project with any assignment (FR-0012). |
| `ROLE_HAS_ASSIGNMENTS` | 409 | Removal attempted on a role with any assignment (FR-0011). |
| `INVALID_STATUS_TRANSITION` | 409 | A requested status change is not in the allowed graph (FR-0009). |
| `PROJECT_NOT_EDITABLE` | 409 | Role add/edit/remove attempted on a project that is Completed or Cancelled (FR-0010/FR-0011). |
| `VALIDATION_ERROR` | 400 | Missing/invalid required fields, or `capacityPercent` outside 1–100 (FR-0010). |

**Reused from EPIC-0001, not redefined**: `NOT_FOUND` is also raised (with `SkillNotFoundError`,
already implemented) when a `ProjectRole`'s `requiredSkillIds` references a nonexistent skill —
this epic does not introduce a parallel error type for that case.
