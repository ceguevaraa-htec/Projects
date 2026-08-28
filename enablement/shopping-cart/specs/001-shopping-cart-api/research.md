# Phase 0 Research: Shopping Cart API

All technical choices were supplied directly in the planning input and confirmed against the
project constitution; no `NEEDS CLARIFICATION` markers remain.

## Decision: TypeScript on Node.js with Express

**Rationale**: Matches the project constitution's technology constraints (Language/runtime:
TypeScript on Node.js; HTTP layer: Express used only for routing and request/response handling).
Express is minimal, well-understood, and requires no additional framework-level abstractions for
a small, layered REST API.

**Alternatives considered**: A heavier framework (NestJS, Fastify with plugins) was rejected —
Principle V (Simplicity & Minimal Dependencies) prohibits dependencies not strictly required for
HTTP handling or testing.

## Decision: In-memory storage via a single repository module

**Rationale**: The constitution mandates in-memory-only storage with no database. A cart and its
line items are one aggregate — a line item never exists independently of its cart, and both are
always read/written together (add/update/remove item, retrieve cart, checkout, clear all operate
on the whole cart). A single `carts.repository.ts` backed by a `Map<cartId, Cart>` (where `Cart`
embeds its line items) avoids a premature two-repository split with no second use case, per
Principle V.

**Alternatives considered**: Two repositories (one for carts, one for line items) was considered
per the planning input's "or" option, but rejected — it would require the service layer to
coordinate two data sources for every operation with no independent benefit, since line items are
never queried or persisted apart from their cart.

## Decision: Vitest for testing, plus supertest for router integration tests

**Rationale**: Matches the constitution's Testing constraint (Vitest for all unit tests) and the
sibling feature's existing precedent in this repository family. Fast, TypeScript-native, minimal
configuration. `supertest` was added on top of this as a dev dependency specifically to automate
verification of the HTTP status codes and response shapes defined in
[contracts/cart-api.md](./contracts/cart-api.md) (200/201/400/404/409) — service-layer unit tests
alone exercise business logic but don't exercise the router's request parsing or status-code
mapping, so a router-level integration test per endpoint closes that gap. This is additive: it
does not reduce or replace the required service-layer unit tests, and stays within Principle V's
minimal-dependency constraint (it's testing infrastructure, not an application dependency).

**Alternatives considered**: Jest — rejected only because the constitution already specifies
Vitest; no functional reason to deviate. Hand-rolled `http` requests against a listening server —
rejected in favor of `supertest`, which drives the Express app directly without binding a real
port, keeping integration tests fast and simple.

## Decision: Layered architecture (repository → service → router)

**Rationale**: Directly mandated by constitution Principle I. Keeps business logic (total
calculation, merge-on-add, checkout/clear lifecycle, validation, logging) independently testable
from HTTP and storage concerns.

**Alternatives considered**: A single-file/controller-does-everything approach was rejected as it
violates Principle I and would make service-layer unit testing (Principle II) impossible without
an HTTP harness.

## Decision: Structured error handling via typed service errors + router-level translation

**Rationale**: Constitution Principle IV requires every operation to validate inputs and fail
with a clear, typed error rather than an unhandled exception, with the router translating service
errors into appropriate HTTP status codes and a structured error response body. A small set of
typed error classes (e.g. `NotFoundError`, `ValidationError`, `CartFinalizedError`) thrown by the
service layer, caught and mapped to 404/400/409 responses in the router, satisfies this without
adding a generic error-handling framework.

**Alternatives considered**: Returning `{ ok: false, error }`-style result objects instead of
throwing was considered; typed errors were chosen as more idiomatic for a small Express service
and easier to translate centrally in one router-level error handler.
