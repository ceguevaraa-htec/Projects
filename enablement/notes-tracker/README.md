# notes-tracker

A simple backend service for managing personal notes: create, view, update, and delete notes
(title + content), each tracking when it was last modified. In-memory storage only — data does
not survive a restart. No authentication (single-user, learning/practice project).

See [specs/001-notes-crud-service/](specs/001-notes-crud-service/) for the full spec, plan, and
API contract this implementation follows.

## Stack

- TypeScript on Node.js, Express for the HTTP layer
- In-memory storage (`Map<string, Note>`) — no database
- Vitest for unit tests (service layer) and integration tests (router layer, via supertest)

## Install

```bash
npm install
```

## Run

```bash
npm run dev     # starts the dev server (src/server.ts) with live reload
# or
npm run build && npm start   # compiled build
```

The server listens on `PORT` (default `3000`). Open `http://localhost:$PORT/` in a browser for
the web UI, or use the REST API directly (see Endpoints below).

## Web UI

A plain HTML/CSS/vanilla JS multi-page UI, served as static files from `public/` by the same
Express app — no build step, no frontend framework. See
[specs/002-notes-web-ui/](specs/002-notes-web-ui/) for the full spec, plan, and page contract.

| Page | Path | Does |
|---|---|---|
| List | `/` | Shows every note (title, content preview, last-modified time); links to create/edit; delete button |
| Create | `/create.html` | Form to add a new note; returns to the list on success |
| Edit | `/edit.html?id=<id>` | Pre-filled form to change a note's title/content; returns to the list on success |

It's a thin client over the REST API below — it introduces no new backend behavior. Deleting a
note removes its row from the page directly, without a full reload.

## Test

```bash
npm test
```

## Endpoints

| Method | Path         | Description                                  |
|--------|--------------|-----------------------------------------------|
| POST   | `/notes`     | Create a note (`{ title, content }`)          |
| GET    | `/notes`     | List all notes                                |
| GET    | `/notes/:id` | Get a single note by id                       |
| PATCH  | `/notes/:id` | Update a note's title and/or content          |
| DELETE | `/notes/:id` | Delete a note                                 |

Full request/response shapes and status codes:
[contracts/notes-api.md](specs/001-notes-crud-service/contracts/notes-api.md).

## Architecture

Three strictly separated layers (see the [project constitution](.specify/memory/constitution.md)):

- `src/repositories/notes.repository.ts` — data access only (in-memory `Map`)
- `src/services/notes.service.ts` — validation, business logic, and logging
- `src/routers/notes.router.ts` — HTTP concerns only (status codes, request/response shaping)

Every successful create/update/delete logs one structured entry
(`{ action, noteId, timestamp }`) from the service layer; reads are not logged.
