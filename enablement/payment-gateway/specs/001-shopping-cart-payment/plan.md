# Implementation Plan: Shopping Cart with Mock Payment Gateway

**Branch**: `001-shopping-cart-payment` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-shopping-cart-payment/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A backend REST API for anonymous-session shopping carts backed by a mocked payment gateway. Shoppers
create a cart, add/update/remove products (merging quantities on duplicate adds), browse a paged/
filtered/searchable product catalog, check out (total calculation with optional promo/coupon
discount), and are routed through a mock `PaymentGateway` that approves or declines the transaction,
setting cart status to `Paid` or `Failed`. Transactions are queryable by id and searchable/paged by
session. Built with Node.js/Express, SQLite via Prisma ORM (transactional writes for the
checkout → payment → status-update sequence), a payment gateway isolated behind a `PaymentGateway`
interface (mock as the sole implementation), centralized Express error-handling middleware with a
consistent error envelope, structured `pino` logging of all major activities, Prisma migrations +
seed script for sample data, and Jest unit tests written test-first per the constitution.

## Technical Context

**Language/Version**: Node.js 20 LTS, JavaScript (CommonJS)

**Primary Dependencies**: Express 4, Prisma ORM (`@prisma/client` + `prisma` CLI), pino (+
`pino-http` for request logging), `uuid` (session/cart token + request id generation)

**Storage**: SQLite (local file, via Prisma; `DATABASE_URL="file:./dev.db"`)

**Testing**: Jest (unit tests, Red-Green-Refactor per constitution Principle I); `supertest` for
HTTP-level contract/integration tests exercising the Express app

**Target Platform**: Linux/macOS server (local dev + typical container deployment), any Node 20
runtime

**Project Type**: Single backend project (REST API service, no frontend in this feature)

**Performance Goals**: Correctness and consistency over raw throughput; no specific req/s target
in the spec — success criteria (SC-003) require correct paged results for catalogs of 10k+
products, which is satisfied by indexed, paginated Prisma queries rather than a throughput target

**Constraints**: All cart/payment state changes MUST be transactional (constitution Principle
III); mock payment logic MUST stay behind a `PaymentGateway` interface with zero payment-specific
code in cart/checkout modules (Principle V); every endpoint MUST return errors through one
centralized handler with a consistent shape (Principle II)

**Scale/Scope**: Single-service REST API covering 3 resource families (products, carts,
transactions) across ~12-15 endpoints; catalogs of 10k+ products per SC-003

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Test-First Development | Jest unit tests for cart ops, checkout/total calc, and mock payment endpoints will be written before their implementations; tasks.md (Phase 2, not this command) MUST sequence test tasks before implementation tasks for the same component | PASS (planned) |
| II. Global Error Handling & Observability | Single Express error-handling middleware (last in the stack) converts thrown/unhandled errors into one response shape (`statusCode`, `errorCode`, `message`, `requestId`); `pino`/`pino-http` logs cart creation/changes, checkout attempts, and payment submissions/results with cart/transaction ids | PASS |
| III. Transactional Data Integrity | All cart/payment writes go through Prisma; the checkout → payment request → status update sequence is wrapped in a single `prisma.$transaction(...)` (interactive transaction) so failure at any step rolls back the whole sequence | PASS |
| IV. Consistent REST API Design | Products, carts, and transactions all use resource-oriented URLs and a shared `page`/`pageSize`/`sort`/`q` + field-filter query convention for every listable resource (see contracts/) | PASS |
| V. Payment Gateway Isolation | Cart/checkout services depend only on a `PaymentGateway` interface (`submitPayment`, `getPaymentStatus`); `MockPaymentGateway` is the only concrete implementation, isolated in its own module with no imports from cart/checkout modules | PASS |

No violations requiring justification; Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-shopping-cart-payment/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma        # Product, Cart, CartItem, Transaction, PromoCode models
├── migrations/           # Prisma migration history
└── seed.js               # Seeds sample products, carts, transactions, promo codes

src/
├── app.js                 # Express app wiring: routes, request logger, error middleware
├── server.js               # HTTP server bootstrap (listens on PORT)
├── lib/
│   └── prisma.js            # Shared PrismaClient instance
├── logging/
│   └── logger.js             # pino instance + pino-http middleware factory
├── errors/
│   ├── AppError.js            # Base error class carrying statusCode + errorCode
│   ├── errorCatalog.js         # Named error types (NotFound, Validation, Conflict, ...)
│   └── errorHandler.js         # Centralized Express error-handling middleware
├── payment/
│   ├── PaymentGateway.js        # Interface/contract (JSDoc-typed abstract shape)
│   └── MockPaymentGateway.js     # Sole concrete implementation (approve/decline simulation)
├── products/
│   ├── products.routes.js
│   ├── products.service.js
│   └── products.repository.js
├── carts/
│   ├── carts.routes.js
│   ├── carts.service.js          # add/update/remove items, quantity-merge, checkout orchestration
│   └── carts.repository.js
└── transactions/
    ├── transactions.routes.js
    ├── transactions.service.js
    └── transactions.repository.js

tests/
├── unit/
│   ├── carts.service.test.js
│   ├── products.service.test.js
│   ├── transactions.service.test.js
│   └── payment/
│       └── MockPaymentGateway.test.js
├── integration/
│   ├── cart-flow.test.js          # create cart → add/update/remove → retrieve
│   ├── checkout-flow.test.js       # checkout → payment → status update (approved/declined)
│   └── product-search.test.js       # filtering/paging/searching
└── contract/
    └── openapi.contract.test.js       # requests/responses match contracts/openapi.yaml shapes
```

**Structure Decision**: Single backend service (Option 1, adapted for a REST API — no CLI/lib
split needed). Each resource family (products, carts, transactions) is a self-contained
routes/service/repository slice; `payment/` is a standalone module behind the `PaymentGateway`
interface per constitution Principle V; `errors/` and `logging/` are cross-cutting infrastructure
shared by every route via `app.js` middleware wiring, satisfying Principle II.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
