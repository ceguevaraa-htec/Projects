# Implementation Plan: Personal Notes Tracking Service

**Branch**: `001-notes-crud-service` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-notes-crud-service/spec.md`

## Summary

Deliver a REST backend for personal notes (create, list, view, update, delete) as a
three-layer TypeScript/Express service with an in-memory repository. The service layer owns
validation, note lifecycle, and structured logging of every mutating action; the router layer
only translates HTTP requests/responses; the repository layer only reads/writes an in-memory
`Map<string, Note>`. No persistence, no auth — matches project constitution v1.0.0.

## Technical Context

**Language/Version**: TypeScript on Node.js (Node 20 LTS)

**Primary Dependencies**: Express (HTTP layer only); supertest as a dev dependency for
router-level integration testing; no ORM, no validation framework beyond hand-written checks —
per constitution's minimal-dependencies principle

**Storage**: In-memory only — a single `Map<string, Note>` held in the repository layer; no
database, no filesystem writes, no persistence across restarts

**Testing**: Vitest for unit tests (service layer) and integration tests (router layer, via
supertest); every feature has both a service-layer unit test and a router-level integration
test

**Target Platform**: Node.js server process (local/dev), no deployment target specified

**Project Type**: Single backend service (no frontend)

**Performance Goals**: None specified — out of scope per constitution (not a production system)

**Constraints**: No auth, no persistent storage, minimal dependencies (Express + Vitest only),
no premature abstraction (per constitution Principle IV)

**Scale/Scope**: Learning/practice scope — single process, single in-memory collection of
notes, 5 REST endpoints, no concurrency/multi-instance concerns

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Layered Architecture | Plan specifies repository (data access only) → service (business logic + logging) → router (HTTP only), with dependencies flowing one direction (router → service → repository) | PASS |
| II. Test-First Development | Plan requires a Vitest unit test at the service layer for each feature (create, list, view, update, delete); a router-level Vitest+supertest integration test per endpoint is added on top of this, additively — it does not replace the required service-layer unit test | PASS |
| III. Observability via Structured Logging | Plan places logging in the service layer only, one entry per successful create/update/delete with action type, note id, timestamp | PASS |
| IV. Simplicity & Minimal Dependencies | Plan uses only Express + Vitest, in-memory `Map` storage, no auth, no extra frameworks | PASS |

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-notes-crud-service/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── notes-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── models/
│   └── note.ts               # Note type/interface (id, title, content, updatedAt)
├── repositories/
│   └── notes.repository.ts   # In-memory Map<string, Note> — CRUD data access only
├── services/
│   └── notes.service.ts      # Business logic, validation, logging; calls repository only
├── routers/
│   └── notes.router.ts       # Express routes; HTTP concerns only; calls service only
├── logger.ts                  # Minimal structured logger used by the service layer
├── app.ts                     # Express app wiring (mounts notes.router)
└── server.ts                  # Process entrypoint (starts HTTP listener)

tests/
├── unit/
│   └── notes.service.test.ts       # One test per feature: create, list, view, update, delete
└── integration/
    └── notes.router.test.ts        # One test per endpoint (POST/GET/GET:id/PATCH/DELETE),
                                     # covering success and error status codes (201, 200, 400,
                                     # 404, 204) via supertest against the Express app
```

**Structure Decision**: Single backend project, no frontend. Flat `src/` split strictly by
layer (`models` / `repositories` / `services` / `routers`) matching Constitution Principle I.
Tests are split into `tests/unit/` (service-layer logic, per Constitution Principle II) and
`tests/integration/` (router-level HTTP contract verification, via supertest) — the latter is
an addition on top of the constitution's minimum bar, not a replacement for it. `supertest` is
added as a dev dependency alongside Vitest for this purpose.

## Complexity Tracking

*No violations — table intentionally omitted.*
