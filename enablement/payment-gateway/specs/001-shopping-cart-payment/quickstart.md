# Quickstart: Shopping Cart with Mock Payment Gateway

Validation guide proving the feature works end-to-end. See [data-model.md](./data-model.md) for
entity details and [contracts/openapi.yaml](./contracts/openapi.yaml) for exact request/response
shapes.

## Prerequisites

- Node.js 20 LTS
- No external services required — SQLite is a local file, and the payment gateway is mocked.

## Setup

```bash
npm install
cp .env.example .env               # sets DATABASE_URL="file:./dev.db"
npx prisma migrate dev              # creates the SQLite db + applies migrations
npx prisma db seed                  # runs prisma/seed.js — sample products, carts, promo codes
npm run dev                         # starts the API (default http://localhost:3000)
```

## Validation Scenarios

Each scenario maps to an acceptance scenario in [spec.md](./spec.md) and should be runnable via
`curl` (or the equivalent Supertest integration test in `tests/integration/`).

### 1. Cart lifecycle (User Story 1)

```bash
# Create a cart
CART_ID=$(curl -s -X POST localhost:3000/api/v1/carts | jq -r .id)

# Add a product with quantity 2
curl -s -X POST localhost:3000/api/v1/carts/$CART_ID/items \
  -H 'content-type: application/json' \
  -d '{"productId": "<seeded-product-id>", "quantity": 2}'

# Add the same product again — expect quantity to merge to 5, not a second line item
curl -s -X POST localhost:3000/api/v1/carts/$CART_ID/items \
  -H 'content-type: application/json' \
  -d '{"productId": "<seeded-product-id>", "quantity": 3}'

# Retrieve the cart and confirm one line item with quantity 5
curl -s localhost:3000/api/v1/carts/$CART_ID
```

**Expected**: the cart's `items` array contains exactly one entry for `<seeded-product-id>` with
`quantity: 5`.

### 2. Product browsing (User Story 2)

```bash
curl -s "localhost:3000/api/v1/products?category=Electronics&minPrice=1000&maxPrice=5000&q=phone&page=1&pageSize=10"
```

**Expected**: only products in `Electronics`, priced between 1000-5000 cents, whose name matches
`phone`, at most 10 per page.

### 3. Checkout and mock payment (User Story 3)

```bash
curl -s -X POST localhost:3000/api/v1/carts/$CART_ID/checkout \
  -H 'content-type: application/json' \
  -d '{"promoCode": "WELCOME10"}'

curl -s localhost:3000/api/v1/carts/$CART_ID   # confirm status is PAID or FAILED
```

**Expected**: response is a `Transaction` with `status: APPROVED` or `status: DECLINED`; the
cart's `status` becomes `PAID` or `FAILED` to match. Re-running checkout against the same
(now-`PAID`) cart returns a 400 error instead of a new transaction.

### 4. Transaction history (User Story 4)

```bash
curl -s localhost:3000/api/v1/transactions/<transaction-id>
curl -s "localhost:3000/api/v1/transactions?status=APPROVED&page=1&pageSize=10"
```

**Expected**: the single transaction lookup returns full details; the list endpoint returns only
`APPROVED` transactions, paged.

## Deferred Validation

**SC-001** (checkout produces a Paid/Failed result in under 5 seconds of system processing time)
and **SC-003** (product search/filtering returns correct, correctly-paged results for catalogs
of at least 10,000 products) are performance/scale success criteria, not functional-correctness
checks — they are validated manually by timing/observing Scenario 3 and Scenario 2 above against
a catalog seeded to that scale, rather than by an automated test in `tests/`.

## Running the automated suite

```bash
npm test              # Jest unit tests (services, MockPaymentGateway, discount calc)
npm run test:integration   # Supertest end-to-end flows against the Express app
```

All functional-correctness scenarios above have a corresponding automated test; see Deferred
Validation above for the two performance/scale criteria (SC-001, SC-003) validated manually
instead. See [plan.md](./plan.md) for the full source layout.
