# Implementation Plan: Shopping Cart API

**Branch**: `001-shopping-cart-api` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-shopping-cart-api/spec.md`

## Summary

A backend REST API for managing shopping carts: create a cart, add/update/remove line items,
retrieve a cart's contents (items, status, total price), check out a cart (finalize + clear, no
payment), and clear a cart's contents without checking out. Built as a layered TypeScript/Express
service (repository → service → router) over in-memory storage, per the project constitution.

## Technical Context

**Language/Version**: TypeScript on Node.js

**Primary Dependencies**: Express (HTTP routing/request handling only); supertest as a dev
dependency for router-level integration testing

**Storage**: In-memory only (e.g. `Map`-backed repositories); no database, no persistence across
restarts, no filesystem writes

**Testing**: Vitest (unit tests at the service layer; integration tests against the router)

**Target Platform**: Node.js server (local/dev; no deployment/infrastructure requirements)

**Project Type**: web-service (backend API only, no frontend)

**Performance Goals**: N/A — no performance/scalability requirements (explicitly out of scope
per constitution)

**Constraints**: In-memory storage only; no auth/sessions; no payment processing; carts have no
expiration or item-count limit

**Scale/Scope**: Single backend service; 7 endpoints across cart lifecycle and item management

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Layered Architecture | Plan specifies repository (data access only) → service (business logic, validation, logging) → router (HTTP only), downward-only dependencies | PASS |
| II. Test-First Development | Every cart operation gets a service-layer unit test (Vitest) before/alongside implementation | PASS |
| III. Observability via Structured Logging | Service layer logs every mutating action (create, add, update, remove, checkout, clear) with action type, cart id, and item id where applicable | PASS |
| IV. Robust Error Handling | Service layer validates inputs and raises typed errors; router translates them to structured 4xx responses | PASS |
| V. Simplicity & Minimal Dependencies | Express (runtime), Vitest + supertest (testing) — no dependency beyond what's needed for HTTP handling or testing; in-memory storage; no premature abstraction (single repository module covering carts + line items, since they are one aggregate) | PASS |

No violations — Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-shopping-cart-api/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── cart-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── models/
│   └── cart.ts                    # Cart & LineItem types, status enum
├── repositories/
│   └── carts.repository.ts        # In-memory Map-backed data access for carts (aggregate:
│                                   # cart + its line items) — no business logic
├── services/
│   └── carts.service.ts           # Business logic: create, add/update/remove item, total
│                                   # calc, checkout, clear, validation, logging
├── routers/
│   └── carts.router.ts            # Express routes for /carts endpoints — HTTP concerns only
├── logger.ts                      # Structured logging helper (shared)
├── http.ts                        # Shared HTTP error types / response shaping helpers
├── app.ts                         # Express app wiring (mounts carts.router)
└── server.ts                      # Process entrypoint (listens on a port)

tests/
├── unit/
│   └── carts.service.test.ts      # Service-layer unit tests (one per cart operation)
└── integration/
    └── carts.router.test.ts       # HTTP-level integration tests against the router
```

**Structure Decision**: Single-project backend API (Option 1), no frontend. One repository module
covers both `Cart` and its `LineItem`s as a single aggregate (a line item never exists without its
cart, and they are always read/written together), which satisfies Principle V's
no-premature-abstraction guidance better than two separate repositories with no independent
second use case. Layout mirrors the project's existing sibling feature structure
(`src/{models,repositories,services,routers}`, `tests/{unit,integration}`).

## Complexity Tracking

*No violations — table omitted.*
