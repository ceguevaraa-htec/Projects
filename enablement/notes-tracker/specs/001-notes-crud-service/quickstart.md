# Quickstart: Personal Notes Tracking Service

Validates the feature end-to-end against [contracts/notes-api.md](./contracts/notes-api.md) and
the acceptance scenarios in [spec.md](./spec.md).

## Prerequisites

- Node.js 20 LTS installed.
- Dependencies installed (`npm install`) — Express (runtime), Vitest (test), TypeScript
  tooling, per [plan.md](./plan.md) Technical Context.

## Run

```bash
npm run dev      # starts the Express server (src/server.ts) on a local port
```

```bash
npm test         # runs Vitest unit tests under tests/unit/
```

## Validation scenarios

Each scenario below corresponds to an acceptance scenario in spec.md. Replace `:id` with the id
returned by the preceding create call, and `$PORT` with the server's listening port.

1. **Create and recall a note** (User Story 1, P1)
   ```bash
   curl -s -X POST http://localhost:$PORT/notes \
     -H 'Content-Type: application/json' \
     -d '{"title":"Groceries","content":"Milk, eggs, bread"}'
   # Expect: 201, body has id/title/content/updatedAt

   curl -s http://localhost:$PORT/notes
   # Expect: 200, array containing the note just created

   curl -s http://localhost:$PORT/notes/:id
   # Expect: 200, the same note
   ```

2. **Not found on unknown id** (User Story 1, scenario 4)
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:$PORT/notes/does-not-exist
   # Expect: 404
   ```

3. **Update a note** (User Story 2, P2)
   ```bash
   curl -s -X PATCH http://localhost:$PORT/notes/:id \
     -H 'Content-Type: application/json' \
     -d '{"content":"Milk, eggs, bread, coffee"}'
   # Expect: 200, content updated, updatedAt refreshed (later than the create response's updatedAt)
   ```

4. **Delete a note** (User Story 3, P3)
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://localhost:$PORT/notes/:id
   # Expect: 204

   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:$PORT/notes/:id
   # Expect: 404 (note no longer exists)
   ```

5. **Validation rejects empty title/content**
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:$PORT/notes \
     -H 'Content-Type: application/json' -d '{"title":"","content":"x"}'
   # Expect: 400
   ```

## Expected outcome

All five scenarios pass without needing the process restarted between them, satisfying success
criteria SC-001 through SC-005. Restarting the process clears all notes (in-memory storage,
constitution Principle IV) — this is expected, not a bug.
