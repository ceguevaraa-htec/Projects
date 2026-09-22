# Interface Contract: Employee Self-Service (EPIC-0005)

Authoritative source: `specs/contracts/openapi-spec.yaml` — `/employees/{employeeId}/my-assignments`, `MyAssignmentsResponse`. This document is a navigation aid, not a re-derivation; it does not restate the schema fields beyond what's needed to point at the source.

## `GET /employees/{employeeId}/my-assignments`

- **Path parameter**: `employeeId` (uuid) — the `EmployeeId` parameter already shared with every other `/employees/{employeeId}/...` path.
- **200**: `MyAssignmentsResponse` — `employeeId`, `name`, `currentUtilizationPercent` (0–100), `assignments` (array of the existing `Assignment` schema, full history, unfiltered).
- **404**: `NotFoundError` response (`{ error_code: "NOT_FOUND", message }`) — the shared `NotFoundError` response and generic `NOT_FOUND` code already used by every other employee-scoped endpoint.

## Domain Logic Contract

`self-service.service.ts` exposes exactly one method:

```typescript
getMyAssignments(employeeId: string): Promise<MyAssignmentsData>
```

Where `MyAssignmentsData` mirrors `MyAssignmentsResponse` field-for-field (see data-model.md). Throws `EmployeeNotFoundError` (existing, `src/domain/errors/domain-errors.ts`) if `employeeId` does not resolve.

## Route Contract

`employees.routes.ts` adds:

```typescript
router.get(
  "/:employeeId/my-assignments",
  asyncHandler(async (req, res) => {
    const data = await selfServiceService.getMyAssignments(req.params.employeeId);
    res.status(200).json(data);
  }),
);
```

The route performs no composition and no error construction itself — both live in `self-service.service.ts`, consistent with every other route in this codebase (research.md's Principle II decision).
