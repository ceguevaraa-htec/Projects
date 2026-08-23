# API Contract: Notes REST Endpoints

Base path: `/notes`. All request/response bodies are JSON. All fields are as defined in
[data-model.md](../data-model.md).

## POST /notes

Create a new note. Maps to FR-001, FR-002.

**Request body**:
```json
{ "title": "string (required, non-empty)", "content": "string (required, non-empty)" }
```

**Responses**:
- `201 Created` — body is the created note: `{ "id", "title", "content", "updatedAt" }`
- `400 Bad Request` — `title` or `content` missing/empty. Body includes an error message
  naming which field(s) are invalid.

## GET /notes

List all notes. Maps to FR-003.

**Responses**:
- `200 OK` — body is an array of notes: `[{ "id", "title", "content", "updatedAt" }, ...]`
  (empty array if none exist)

## GET /notes/:id

Retrieve a single note by id. Maps to FR-004, FR-005.

**Responses**:
- `200 OK` — body is the note: `{ "id", "title", "content", "updatedAt" }`
- `404 Not Found` — no note exists with the given `id`. Body includes an error message.

## PATCH /notes/:id

Update an existing note's title and/or content. Maps to FR-006, FR-007, FR-005, FR-010.

**Request body** (at least one field required; both optional individually, but each supplied
value must be non-empty):
```json
{ "title": "string (optional, non-empty if present)", "content": "string (optional, non-empty if present)" }
```

**Responses**:
- `200 OK` — body is the updated note: `{ "id", "title", "content", "updatedAt" }` with
  `updatedAt` refreshed to the time of this change. This includes the case where the supplied
  value(s) match the note's current title/content — the update still succeeds and `updatedAt`
  is still refreshed (idempotent per data-model.md).
- `400 Bad Request` — either a supplied `title` or `content` is present but empty, **or**
  neither `title` nor `content` is present in the body at all (FR-010).
- `404 Not Found` — no note exists with the given `id`. Body includes an error message.

## DELETE /notes/:id

Delete an existing note by id. Maps to FR-008, FR-005.

**Responses**:
- `204 No Content` — note deleted; no body
- `404 Not Found` — no note exists with the given `id`. Body includes an error message.

## Error body shape

All `4xx` responses share a consistent shape:
```json
{ "error": "human-readable message" }
```

## Cross-cutting notes

- Router layer is responsible only for: parsing the request, calling the service layer, and
  mapping the service's result/error to the correct status code and response shape above. It
  performs no validation logic and no logging itself (constitution Principle I, III).
- Service layer performs all validation (FR-002 rules) and, on every successful create, update,
  or delete, emits one log entry with `{ action, noteId, timestamp }` (constitution Principle
  III). Read-only actions (list, get) are not logged.
