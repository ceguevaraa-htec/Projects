# API Contract: Employee Management (EPIC-0001)

This is **not** a new or re-derived contract. Per constitution Principle I, the authoritative
API contract for this project is `specs/contracts/openapi-spec.yaml`. This file is an index into
that spec, scoped to the paths and schemas this epic implements, so implementers don't have to
search the full file. If this index and the OpenAPI spec ever disagree, the OpenAPI spec wins —
update this index, not the other way around.

## Endpoints in scope

| Method | Path | OpenAPI operation | FR |
|---|---|---|---|
| GET | `/employees` | List employees | (supports FR-0001–FR-0005 read access) |
| POST | `/employees` | Create employee | FR-0001 |
| GET | `/employees/{employeeId}` | Get employee detail (embeds skills) | (read access) |
| PATCH | `/employees/{employeeId}` | Update employee | FR-0002 |
| DELETE | `/employees/{employeeId}` | Delete employee (blocked if assignments exist) | FR-0003 |
| POST | `/employees/{employeeId}/skills` | Add employee-skill association | FR-0004 |
| PATCH | `/employees/{employeeId}/skills/{skillId}` | Update proficiency | FR-0005 |
| DELETE | `/employees/{employeeId}/skills/{skillId}` | Remove association | FR-0005 |
| GET | `/skills` | List skill catalog | (read access) |
| POST | `/skills` | Create skill | FR-0006 |
| PATCH | `/skills/{skillId}` | Rename skill | FR-0007 |
| GET | `/skills/{skillId}/deletion-impact` | Preview deletion impact | FR-0008 |
| DELETE | `/skills/{skillId}` | Delete skill (cascades) | FR-0008 |

**Explicitly out of scope for this epic** (present in the full OpenAPI spec, but not
implemented here): `/employees/{employeeId}/my-assignments`, all `/projects*` paths,
`/assignments*` paths, `/bench`, `/reports/*`.

## Schemas in scope

Use these schemas verbatim from `specs/contracts/openapi-spec.yaml#/components/schemas`:
`Employee`, `EmployeeSummary`, `EmployeeCreateRequest`, `EmployeeUpdateRequest`, `EmployeeSkill`,
`EmployeeSkillCreateRequest`, `Skill`, `SkillDeletionImpact`, `ErrorResponse`,
`SeniorityLevel`, `ProficiencyLevel`.

## Error codes this epic must produce

All via the shared `ErrorResponse` schema (`{ error_code, message }`), per NFR-0005/ADR-0009:

| `error_code` | HTTP status | Raised when |
|---|---|---|
| `NOT_FOUND` | 404 | Employee or skill ID does not exist. |
| `EMPLOYEE_SKILL_NOT_FOUND` | 404 | `PATCH`/`DELETE` on `/employees/{employeeId}/skills/{skillId}` targets an (employeeId, skillId) pair with no existing association. |
| `EMPLOYEE_HAS_ASSIGNMENTS` | 409 | Delete attempted on an employee with any assignment (FR-0003). |
| `SKILL_NAME_NOT_UNIQUE` | 409 | Create/rename collides with an existing skill name (FR-0006/FR-0007). |
| `DUPLICATE_EMPLOYEE_SKILL` | 409 | Associating a skill an employee already has. |
| `VALIDATION_ERROR` | 400 | Missing/invalid required fields on any create/update request. |

These are this epic's concrete instantiation of the BFF Contract's general error-envelope
requirement — the code list itself is authored here since the BFF Contract only mandates the
envelope shape, not every epic's specific codes.
