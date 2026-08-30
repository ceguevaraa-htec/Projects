# Unit of Work Dependencies — Warehouse Inventory System

## Dependency Matrix

| Unit | Depends On | Nature of Dependency |
|---|---|---|
| Unit 1 — Inventory API | None | Self-contained: owns its own persistence, business logic, and REST surface |
| Unit 2 — Web UI | Unit 1 — Inventory API | Out-of-process, HTTP/JSON — Unit 2 is a pure consumer of Unit 1's REST endpoints; no shared code or in-process calls |

## Sequencing

- **Update/Build Approach**: Sequential. Unit 1 must reach a functionally complete, testable state (all endpoints implemented per its Functional/NFR Design) before Unit 2's implementation is finalized against it.
- **Critical Path**: Unit 1 blocks Unit 2's Code Generation. Unit 2's Functional Design (UI/UX flows, error-message mapping) can be drafted in parallel with Unit 1's Code Generation, since it only needs the *contract* (endpoint list, request/response shapes, error format) established during Unit 1's Functional/NFR Design — not the running implementation.
- **Coordination Point**: The REST API contract — endpoint paths, request/response JSON shapes, and the structured error-body format from the global exception handler — is the single shared interface. Per the approved plan (Q3), this contract is captured as FastAPI's auto-generated OpenAPI schema (`/openapi.json`), which Unit 2 is implemented against.
- **No Circular Dependency**: Unit 1 has zero awareness of Unit 2; it only serves REST requests and (per the Web UI's Functional Design) is asked to also serve `frontend/`'s static files at runtime — a hosting detail, not a code dependency.

## Rollback / Testing Checkpoint
- Unit 1 is independently testable (unit + integration tests against its own API, no browser needed).
- Unit 2's smoke tests require Unit 1 running (or a lightweight stub matching the OpenAPI contract) — this checkpoint happens during Build and Test's integration-test phase.
