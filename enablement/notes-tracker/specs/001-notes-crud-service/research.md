# Phase 0 Research: Personal Notes Tracking Service

All technical decisions for this feature were specified directly by the user or fixed by the
project constitution (v1.0.0). No open unknowns remain; this document records the decisions and
their rationale for traceability.

## Decision: Runtime & language — TypeScript on Node.js

- **Rationale**: Explicit user requirement; also matches constitution's Technology Constraints
  section.
- **Alternatives considered**: None — fixed by user/constitution.

## Decision: HTTP layer — Express

- **Rationale**: Explicit user requirement; minimal, well-understood REST framework, satisfies
  constitution's "no framework beyond what's needed for HTTP handling" constraint.
- **Alternatives considered**: Fastify, Koa, raw `http` module — not chosen; Express was
  explicitly specified and the constitution forbids adding dependencies beyond what's required.

## Decision: Storage — in-memory `Map<string, Note>` in the repository layer

- **Rationale**: Explicit user requirement; matches constitution Principle IV (no persistent
  storage) and spec Assumptions (notes do not survive a restart).
- **Alternatives considered**: SQLite/file-based storage — rejected; explicitly out of scope
  per constitution and user instruction ("no database, no filesystem writes").

## Decision: Testing — Vitest, unit tests at the service layer, plus supertest for router integration tests

- **Rationale**: Explicit user requirement; matches constitution Principle II (every feature —
  create, list, update, delete — needs ≥1 unit test) and Principle I (business logic lives in
  the service layer, so testing it in isolation validates the core behavior without HTTP or
  storage concerns). `supertest` was added on top of this as a dev dependency specifically to
  automate verification of the HTTP status codes and response shapes defined in
  `contracts/notes-api.md` (201, 200, 400, 404, 204) — service-layer unit tests alone exercise
  business logic but don't exercise the router's request parsing or status-code mapping, so a
  router-level integration test per endpoint closes that gap. This is additive: it does not
  reduce or replace the required service-layer unit tests.
- **Alternatives considered**: Jest, Mocha — not chosen; Vitest was explicitly specified.
  Hand-rolled `http` requests against a listening server — rejected in favor of `supertest`,
  which drives the Express app directly without binding a real port, keeping integration tests
  fast and simple.

## Decision: Three-layer architecture — repository → service → router

- **Rationale**: Explicit user requirement; matches constitution Principle I exactly
  (repository: data access only; service: business logic + logging; router: HTTP concerns
  only). Dependencies flow one direction only.
- **Alternatives considered**: Single-file/controller-only design — rejected; violates
  constitution's layering requirement and the user's explicit structure.

## Decision: Logging — service layer, one entry per successful mutation

- **Rationale**: Explicit user requirement; matches constitution Principle III (log action
  type, note id, timestamp for every successful create/update/delete; read-only actions are not
  logged).
- **Alternatives considered**: Logging in the router (rejected — couples observability to
  transport, violates Principle III) or in the repository (rejected — repository has no
  knowledge of "business meaningful" success/failure, only storage operations).

## Decision: REST surface — POST /notes, GET /notes, GET /notes/:id, PATCH /notes/:id, DELETE /notes/:id

- **Rationale**: Explicit user requirement; PATCH (not PUT) matches spec's partial-update
  semantics (title and/or content). Maps directly to spec's functional requirements FR-001
  through FR-008.
- **Alternatives considered**: PUT for full replacement — rejected; spec allows updating title
  and/or content independently (partial update), which PATCH semantics fit better.

## Output

All "NEEDS CLARIFICATION" slots in Technical Context are resolved. No further research required
before Phase 1 design.
