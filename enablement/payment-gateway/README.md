# Shopping Cart & Mock Payment Gateway API

A REST API for anonymous-session shopping carts, a filterable/searchable product
catalog, checkout with an optional promo code, and a mocked payment gateway.
See [specs/001-shopping-cart-payment/spec.md](./specs/001-shopping-cart-payment/spec.md)
for the full functional specification, and
[contracts/openapi.yaml](./specs/001-shopping-cart-payment/contracts/openapi.yaml)
for exact request/response shapes.

> **Session model**: a cart's `id` (returned by `POST /api/v1/carts`) doubles as
> the anonymous shopper's session token. There is no login — the client MUST
> store this `id` and replay it on every subsequent request for that cart
> (`GET`/item mutations/checkout) and when browsing that shopper's transaction
> history via `?cartId=`.

## Prerequisites

- Node.js 20 LTS
- No external services required — SQLite is a local file, and the payment
  gateway is mocked in-process.

## Setup

```bash
npm install
cp .env.example .env               # sets DATABASE_URL="file:./dev.db" and PORT=3000
npx prisma migrate dev              # creates the SQLite db + applies migrations
npx prisma db seed                  # runs prisma/seed.js — sample products, carts, promo codes
npm run dev                         # starts the API on http://localhost:3000
```

## Running tests

```bash
npm test                 # Jest unit tests (services, MockPaymentGateway, discount calc)
npm run test:integration # Supertest end-to-end flows against the Express app
npm run test:contract    # Request/response shape checks against contracts/openapi.yaml
npm run test:all         # All of the above
```

## Project layout

```text
prisma/
  schema.prisma   Product, Cart, CartItem, Transaction, PromoCode models
  migrations/     Prisma migration history
  seed.js         Seeds sample products, carts, transactions, promo codes

src/
  app.js, server.js         Express app wiring + HTTP bootstrap
  lib/prisma.js              Shared PrismaClient instance
  logging/logger.js           pino + pino-http request logging
  errors/                      AppError hierarchy + centralized error middleware
  payment/                      PaymentGateway interface + MockPaymentGateway
  products/, carts/, transactions/   Resource route/service/repository slices

tests/
  unit/          Jest unit tests (no live DB/HTTP)
  integration/   Supertest tests against the running Express app + SQLite
  contract/      Request/response shape checks against contracts/openapi.yaml
```

## Key API endpoints

| Method | Path                                | Description |
|---|---|---|
| POST   | `/api/v1/carts`                     | Start shopping — creates a new cart (its `id` is the session token) |
| GET    | `/api/v1/carts/:cartId`             | Retrieve cart contents and running total |
| POST   | `/api/v1/carts/:cartId/items`       | Add a product (merges quantity if already in the cart) |
| PATCH  | `/api/v1/carts/:cartId/items/:itemId` | Update a line item's quantity |
| DELETE | `/api/v1/carts/:cartId/items/:itemId` | Remove a line item |
| POST   | `/api/v1/carts/:cartId/checkout`    | Compute total (+ optional promo code), submit to the mock gateway, set status to `PAID`/`FAILED` |
| GET    | `/api/v1/products`                  | Paged/filtered/searched product catalog (`q`, `category`, `minPrice`, `maxPrice`, `page`, `pageSize`) |
| GET    | `/api/v1/products/:productId`       | Retrieve a single product |
| GET    | `/api/v1/transactions/:transactionId` | Retrieve a past transaction by id |
| GET    | `/api/v1/transactions`              | Paged/filtered transaction history (`status`, `cartId`, `page`, `pageSize`) |

All errors flow through one centralized error-handling middleware and share the
shape `{ statusCode, errorCode, message, requestId }`.

## Constitution compliance

This project follows the constitution at
[.specify/memory/constitution.md](./.specify/memory/constitution.md):

- **Test-first**: unit tests for cart operations, checkout/discount calculation,
  and the mock payment gateway were written before their implementations.
- **Centralized error handling**: `src/errors/errorHandler.js` is the sole
  source of error response JSON.
- **Transactional integrity**: checkout (compute total → submit payment →
  record Transaction + update Cart.status) runs inside one
  `prisma.$transaction(async (tx) => { ... })` block, including a re-check of
  the cart's status inside the transaction to guard against concurrent
  checkout attempts on the same cart.
- **Payment gateway isolation**: `src/carts/carts.service.js` depends only on
  the `PaymentGateway` interface (`src/payment/PaymentGateway.js`); the
  concrete `MockPaymentGateway` is constructor-injected from `src/app.js`.
- **Structured logging**: `pino`/`pino-http` log cart creation/changes,
  checkout attempts, and payment submissions/results with cart id,
  transaction id, and outcome.
