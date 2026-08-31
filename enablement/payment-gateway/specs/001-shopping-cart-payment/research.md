# Phase 0 Research: Shopping Cart with Mock Payment Gateway

All technology choices were specified directly by the user for this feature; no
`NEEDS CLARIFICATION` markers remain from the Technical Context. This document records the
resulting decisions, rationale, and alternatives considered so later phases don't need to
re-derive them.

## Decision: Web framework — Express 4

- **Decision**: Use Express 4 for routing, middleware, and the centralized error handler.
- **Rationale**: User-specified. Express's `(err, req, res, next)` error-handling middleware
  signature maps directly onto constitution Principle II (a single centralized handler that
  intercepts unhandled/thrown errors and returns a consistent response shape).
- **Alternatives considered**: Fastify (built-in schema validation, marginally faster) and
  Koa (cleaner async middleware) were not chosen — the user specified Express directly, and
  Express's middleware chain + `next(err)` convention is the most direct fit for a single
  centralized error boundary.

## Decision: Database + ORM — SQLite via Prisma

- **Decision**: SQLite as the relational store (per constitution's Technology & Data
  Constraints), accessed exclusively through Prisma Client; schema changes via
  `prisma migrate`; interactive transactions (`prisma.$transaction(async (tx) => { ... })`) for
  any multi-step write.
- **Rationale**: User-specified, and directly satisfies constitution Principle III
  (Transactional Data Integrity) — Prisma's interactive transaction API lets the
  checkout → payment-request → status-update sequence commit or roll back as one unit.
- **Alternatives considered**: Raw `better-sqlite3` with hand-written SQL (more control, no
  migration tooling, more error-prone transactional code); Sequelize/TypeORM (viable, but the
  user specified Prisma, whose generated client and `$transaction` API are a closer fit for this
  project's size).

## Decision: Payment gateway isolation — `PaymentGateway` interface + `MockPaymentGateway`

- **Decision**: Define a `PaymentGateway` contract (`submitPayment(request)` →
  `{ status: 'approved' | 'declined', transactionRef, ... }`, and a status-lookup method) as a
  standalone module. `MockPaymentGateway` is the only implementation, injected into
  cart/checkout services rather than imported by name inside them.
- **Rationale**: Directly satisfies constitution Principle V. Keeping the interface as plain
  JSDoc-typed function contracts (no TypeScript build step) matches the plain-JavaScript stack
  the user requested while still documenting the shape other implementations must satisfy.
- **Alternatives considered**: Embedding approve/decline logic directly in the checkout service
  (rejected — violates Principle V and the spec's swappability requirement); a full plugin/DI
  framework (rejected as unnecessary complexity for one mock implementation — a constructor-
  injected interface is sufficient and simpler).

## Decision: Error handling — `AppError` hierarchy + centralized middleware

- **Decision**: Route/service code throws typed `AppError` subclasses (e.g. `NotFoundError`,
  `ValidationError`, `ConflictError`) carrying `statusCode` and `errorCode`. A single
  `errorHandler` Express middleware (registered last) catches all errors — typed or not — and
  responds with `{ errorCode, message, requestId }` at the matching `statusCode` (defaulting
  unknown errors to 500 / `INTERNAL_ERROR`).
- **Rationale**: Satisfies Principle II's "consistent error response shape" requirement and
  keeps route handlers free of ad-hoc `res.status(...).json(...)` error branching — they just
  `throw` or `next(err)`.
- **Alternatives considered**: Per-route try/catch with inline JSON error bodies (rejected —
  produces the "ad-hoc error formats" the constitution explicitly forbids).

## Decision: Logging — pino + pino-http

- **Decision**: A shared `pino` logger instance, with `pino-http` mounted early in the
  middleware chain to attach a per-request `id` (reused as the error envelope's `requestId`) and
  log request/response lines. Domain code logs structured events for cart creation/changes,
  checkout attempts, and payment submissions/results via the same logger.
- **Rationale**: User-specified; pino's structured JSON output and low overhead fit the
  constitution's activity-logging requirement without hand-rolling a logging format.
- **Alternatives considered**: `winston` (more configurable, heavier); `console.log` (rejected —
  unstructured, unsuitable for the "reconstruct the sequence of events" requirement in Principle
  II).

## Decision: Testing — Jest + Supertest

- **Decision**: Jest for unit tests (services, `MockPaymentGateway`, total/discount
  calculation) written before implementation per Principle I; Supertest for HTTP-level
  integration/contract tests against the Express app.
- **Rationale**: User-specified for unit tests; Supertest is the standard complement for
  exercising Express routes/middleware (including the error handler) in integration tests
  without a running server process.
- **Alternatives considered**: Mocha/Chai (viable, but the user specified Jest, which also
  provides built-in mocking needed to unit-test `carts.service` against a fake
  `PaymentGateway`).

## Decision: Seed data — Prisma seed script

- **Decision**: `prisma/seed.js`, wired via Prisma's `"prisma": { "seed": ... }` package.json
  config, populates sample `Product`, `Cart`/`CartItem`, `Transaction`, and `PromoCode` rows so
  `prisma migrate reset` (or a fresh `prisma db push` + seed) leaves a fully testable database.
- **Rationale**: Satisfies FR-023 and the constitution's Technology & Data Constraints
  requirement for a seed script, using Prisma's own tooling rather than a bespoke script runner.
- **Alternatives considered**: A standalone Node script invoked manually (rejected — Prisma's
  seed hook integrates with `migrate reset`/`db seed`, which is simpler for contributors to
  discover and run).
