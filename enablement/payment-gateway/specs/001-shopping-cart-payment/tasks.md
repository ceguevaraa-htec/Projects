---

description: "Task list template for feature implementation"
---

# Tasks: Shopping Cart with Mock Payment Gateway

**Input**: Design documents from `/specs/001-shopping-cart-payment/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Included. Constitution Principle I (Test-First Development, NON-NEGOTIABLE) requires
unit tests for cart operations, checkout/total calculation, and mock payment endpoints to be
written and failing before their implementation.

**Organization**: Tasks are grouped by user story (from spec.md, in the priority order the spec
declares them: US1 P1, US2 P2, US3 P1, US4 P3) to enable independent implementation and testing.

**Total Tasks**: 50 (T001–T048, plus T035a/T035b added in Phase 5 to close the
concurrent-checkout edge case identified by `/speckit-analyze`)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in every description

## Path Conventions

Single backend project per [plan.md](./plan.md): `src/`, `prisma/`, `tests/` at the repository
root (`enablement/payment-gateway/`).

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the project directory skeleton (`src/lib`, `src/logging`, `src/errors`,
      `src/payment`, `src/products`, `src/carts`, `src/transactions`, `prisma`,
      `tests/unit/payment`, `tests/integration`, `tests/contract`) per plan.md's Project
      Structure
- [X] T002 Initialize the Node.js project: `package.json` with `express`, `@prisma/client`,
      `prisma`, `pino`, `pino-http`, `uuid` as dependencies and `jest`, `supertest` as
      devDependencies; add `dev`, `test`, `test:integration` npm scripts
- [X] T003 [P] Create `.env.example` in the repository root with `DATABASE_URL="file:./dev.db"`
      and `PORT=3000`
- [X] T004 [P] Create `jest.config.js` at the repository root configuring separate `unit`,
      `integration`, and `contract` test roots matching the `tests/` layout in plan.md

**Checkpoint**: Project scaffolding exists; no application code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Define the Prisma schema in `prisma/schema.prisma` with the `Product`, `Cart`,
      `CartItem`, `Transaction`, and `PromoCode` models, fields, and relations exactly as
      specified in [data-model.md](./data-model.md), including the `@@unique([cartId,
      productId])` constraint on `CartItem`
- [X] T006 Generate the initial Prisma migration (`npx prisma migrate dev --name init`),
      committing the result under `prisma/migrations/`
- [X] T007 [P] Implement the shared `PrismaClient` singleton in `src/lib/prisma.js`
- [X] T008 [P] Implement the structured logger in `src/logging/logger.js`: a `pino` instance plus
      a `pino-http` middleware factory that attaches a per-request id
- [X] T009 [P] Implement `AppError` (base class carrying `statusCode` + `errorCode`) in
      `src/errors/AppError.js`, and the named error subclasses (`NotFoundError`,
      `ValidationError`, `ConflictError`) in `src/errors/errorCatalog.js`
- [X] T010 Implement the centralized Express error-handling middleware in
      `src/errors/errorHandler.js`: maps `AppError` instances (and unknown errors, defaulted to
      500/`INTERNAL_ERROR`) to the `{ statusCode, errorCode, message, requestId }` shape from
      contracts/openapi.yaml (depends on T009)
- [X] T011 [P] Define the `PaymentGateway` interface/contract (JSDoc-typed `submitPayment(request)`
      and `getPaymentStatus(reference)` shapes) in `src/payment/PaymentGateway.js`, with no
      concrete logic
- [X] T012 [P] Implement `MockPaymentGateway` (the sole concrete implementation, simulating
      approve/decline and returning a `gatewayReference`) in `src/payment/MockPaymentGateway.js`
      (depends on T011)
- [X] T013 Bootstrap the Express app in `src/app.js`: JSON body parsing, the `pino-http`
      middleware from T008, route mounting points for products/carts/transactions, and the
      error-handling middleware from T010 mounted last (depends on T008, T010)
- [X] T014 Implement the HTTP server bootstrap in `src/server.js`, listening on `PORT` from the
      environment (depends on T013)
- [X] T015 Implement the Prisma seed script in `prisma/seed.js`, populating sample `Product`,
      `Cart`/`CartItem`, `Transaction`, and `PromoCode` rows per data-model.md (depends on T005)
- [X] T016 Wire the seed script into Prisma tooling via the `"prisma": { "seed": "node
      prisma/seed.js" }` entry in `package.json` (depends on T015)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Build and Manage a Cart (Priority: P1) 🎯 MVP

**Goal**: A shopper can start a cart, add products with quantities (merging duplicates), update
or remove line items, and retrieve the cart's current contents and running total.

**Independent Test**: Create a cart, add a product with quantity 2, add the same product again
and confirm the quantity merges to 5, update a line item's quantity, remove a line item, and
retrieve the cart to confirm the final state — no checkout or payment involved.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; confirm they FAIL before implementing this phase (constitution
> Principle I)

- [X] T017 [P] [US1] Unit tests for cart creation, add-item quantity merge (FR-002/FR-003),
      quantity update (FR-004), item removal (FR-005), and quantity validation (FR-007) in
      `tests/unit/carts.service.test.js`
- [X] T018 [P] [US1] Integration test for the full cart lifecycle (create → add → add duplicate
      → update → remove → retrieve) against the running Express app in
      `tests/integration/cart-flow.test.js`

### Implementation for User Story 1

- [X] T019 [P] [US1] Implement the carts repository (create cart, find by id with items, upsert
      item by `[cartId, productId]`, update item quantity, delete item) in
      `src/carts/carts.repository.js`
- [X] T020 [US1] Implement `carts.service.js` in `src/carts/carts.service.js`: `createCart`,
      `addItem` (merges quantity per FR-003, snapshots `unitPriceCents`), `updateItemQuantity`,
      `removeItem`, `getCart` (computing `subtotalCents` from items) — depends on T019
- [X] T021 [US1] Implement `src/carts/carts.routes.js` with `POST /carts`, `GET /carts/:cartId`,
      `POST /carts/:cartId/items`, `PATCH /carts/:cartId/items/:itemId`, `DELETE
      /carts/:cartId/items/:itemId` matching contracts/openapi.yaml — depends on T020
- [X] T022 [US1] Mount the carts router at `/api/v1/carts` in `src/app.js` — depends on T021
- [X] T023 [US1] Add validation in `carts.service.js` that rejects quantity ≤ 0 with
      `ValidationError` and missing cart/item/product with `NotFoundError` (FR-007, FR-021) —
      depends on T020, T009
- [X] T024 [US1] Add activity logging (cart created, item added/updated/removed, with cart id and
      resulting quantities) in `carts.service.js` using the logger from T008 (constitution
      Principle II) — depends on T020, T008

**Checkpoint**: User Story 1 is fully functional and independently testable — run T017/T018
against `npm test` / `npm run test:integration`.

---

## Phase 4: User Story 2 - Browse, Filter, and Search Products (Priority: P2)

**Goal**: A shopper can list products with paging, filter by category and price range, and
search by name, in any combination.

**Independent Test**: Query the product catalog with a search term, a category filter, and a
price-range filter (individually and combined), and page through results — independent of any
cart or payment functionality.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; confirm they FAIL before implementing this phase

- [X] T025 [P] [US2] Unit tests for product filtering (category, price range), search (name
      match), paging, and combined-parameter queries (FR-008–FR-011) in
      `tests/unit/products.service.test.js`
- [X] T026 [P] [US2] Integration test issuing paged/filtered/searched product listing requests
      against the running Express app in `tests/integration/product-search.test.js`

### Implementation for User Story 2

- [X] T027 [P] [US2] Implement the products repository (paged Prisma `findMany` with `category`,
      `priceCents` range, and `name` contains-search) in `src/products/products.repository.js`
- [X] T028 [US2] Implement `src/products/products.service.js` exposing `listProducts(params)`
      and `getProduct(id)`, validating paging/filter params and rejecting invalid ones (e.g.
      `minPrice > maxPrice`, negative page) with `ValidationError` — depends on T027, T009
- [X] T029 [US2] Implement `src/products/products.routes.js` with `GET /products` and `GET
      /products/:productId` matching contracts/openapi.yaml — depends on T028
- [X] T030 [US2] Mount the products router at `/api/v1/products` in `src/app.js` — depends on
      T029

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Checkout and Pay for a Cart (Priority: P1)

**Goal**: A shopper checks out a cart; the system computes the final total (with an optional
promo code), submits payment through the mock gateway, and sets the cart's status to `Paid` or
`Failed` accordingly — all as one transactional unit.

**Independent Test**: Check out a cart with known contents (with and without a promo code) and
confirm the computed total, then confirm the cart's status becomes `Paid` when the mock gateway
approves and `Failed` when it declines; confirm a second checkout of a `Paid` cart is rejected.

### Tests for User Story 3 ⚠️

> Write these tests FIRST; confirm they FAIL before implementing this phase

- [X] T031 [P] [US3] Unit tests for `MockPaymentGateway.submitPayment` approve/decline simulation
      in `tests/unit/payment/MockPaymentGateway.test.js`
- [X] T032 [P] [US3] Unit tests for checkout total/discount calculation, promo-code validation
      (valid, invalid, expired code per FR-025), empty-cart rejection (FR-016), and
      already-`Paid` rejection (FR-017) in `tests/unit/checkout.service.test.js`
- [X] T033 [P] [US3] Integration test for the checkout flow covering both an approved and a
      declined outcome (via a test-injectable `MockPaymentGateway` seam) in
      `tests/integration/checkout-flow.test.js`

### Implementation for User Story 3

- [X] T034 [P] [US3] Implement promo-code lookup/validation (active flag, `expiresAt`) in
      `src/carts/promoCode.service.js`
- [X] T035 [US3] Implement `checkout(cartId, { promoCode })` in `carts.service.js`: reject empty
      carts (FR-016) and already-`Paid` carts (FR-017); otherwise compute
      `subtotalCents`/`discountCents`/`totalCents` (using T034), then run the payment submission
      and cart-status/Transaction-row update inside one `prisma.$transaction(async (tx) => {
      ... })` block per constitution Principle III. `carts.service.js` MUST depend only on the
      `PaymentGateway` interface (T011) — the concrete `MockPaymentGateway` (T012) is
      constructor-injected from `app.js`/`server.js`, never imported by name inside
      `carts.service.js`; throws `NotFoundError` if `cartId` does not resolve to an existing
      cart (FR-021) — depends on T020, T011, T034
- [X] T035a [US3] Inside T035's `prisma.$transaction`, re-read the cart's `status` immediately
      before submitting payment and abort with `ConflictError` (no gateway call, no Transaction
      row) if it is no longer `OPEN` (e.g. a concurrent checkout already changed it) — addresses
      spec.md's concurrent/duplicate checkout edge case — depends on T035
- [X] T035b [P] [US3] Unit/integration test simulating two concurrent checkout requests against
      the same cart, asserting only one succeeds (Paid/Failed) and the second is rejected with no
      duplicate Transaction row, in `tests/integration/checkout-flow.test.js` — depends on T035a      
- [X] T036 [US3] Implement `POST /carts/:cartId/checkout` in `carts.routes.js` matching
      contracts/openapi.yaml, returning the resulting `Transaction` — depends on T035
- [X] T037 [US3] Add activity logging for checkout attempts and payment submissions/results
      (cart id, transaction id, outcome) in `carts.service.js` (constitution Principle II) —
      depends on T035, T008

**Checkpoint**: User Stories 1, 2, and 3 all work independently (US3 builds on US1's cart
service and the Foundational payment/error/logging infrastructure).

---

## Phase 6: User Story 4 - Review Transaction History (Priority: P3)

**Goal**: A shopper can retrieve a specific past transaction by id, and search/page through
their transaction history.

**Independent Test**: Check out one or more carts to produce transactions, then retrieve one by
id and separately list/search the transaction history with paging.

### Tests for User Story 4 ⚠️

> Write these tests FIRST; confirm they FAIL before implementing this phase

- [X] T038 [P] [US4] Unit tests for transaction lookup-by-id, status/cart filtering, and paging
      (FR-019, FR-020) in `tests/unit/transactions.service.test.js`
- [X] T039 [P] [US4] Integration test retrieving a transaction by id and searching/paging
      transaction history in `tests/integration/transaction-history.test.js`

### Implementation for User Story 4

- [X] T040 [P] [US4] Implement the transactions repository (find by id, paged `findMany` with
      `status`/`cartId` filters) in `src/transactions/transactions.repository.js`
- [X] T041 [US4] Implement `src/transactions/transactions.service.js` exposing `getTransaction(id)`
      (throws `NotFoundError` for an unknown transaction id, mirroring T023/T035's pattern —
      FR-021) and `listTransactions(params)`, validating paging/filter params and rejecting
      invalid ones (e.g. negative page, unknown `status` value) with `ValidationError`, matching
      T028's validation standard for products (constitution Principle IV) — depends on T040, T009
- [X] T042 [US4] Implement `src/transactions/transactions.routes.js` with `GET
      /transactions/:transactionId` and `GET /transactions` matching contracts/openapi.yaml —
      depends on T041
- [X] T043 [US4] Mount the transactions router at `/api/v1/transactions` in `src/app.js` —
      depends on T042

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span multiple user stories

- [X] T044 [P] Contract tests asserting request/response shapes for every endpoint match
      `contracts/openapi.yaml` (including the error envelope shape) in
      `tests/contract/openapi.contract.test.js`
- [X] T045 [P] Add edge-case coverage across unit/integration suites: invalid product id on add,
      zero/negative quantity, updating/removing a missing line item, retrieving a nonexistent
      cart/transaction, and invalid paging/filter params (negative page, `minPrice > maxPrice`)
      per the spec's Edge Cases section
- [X] T046 Write `README.md` at the repository root covering setup, migration, seed, run, and
      test commands (mirrors [quickstart.md](./quickstart.md)); include a one-line callout that
      a cart's `id` doubles as the anonymous session token and MUST be stored and replayed by
      the client on every subsequent request for that cart (FR-024)
- [X] T047 Execute every scenario in [quickstart.md](./quickstart.md) end-to-end against a freshly
      seeded database and confirm the documented expected results
- [X] T048 Audit all route handlers to confirm no ad-hoc `res.status(...).json(...)` error
      responses exist outside the centralized error handler (constitution Principle II)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends only on Foundational
- **User Story 2 (Phase 4)**: Depends only on Foundational — independent of US1
- **User Story 3 (Phase 5)**: Depends on Foundational AND on US1's `carts.service.js` /
  `carts.repository.js` existing (checkout extends cart operations). T035a/T035b (the
  concurrent-checkout guard and its test) depend on T035 itself and MUST land before Phase 5's
  checkpoint is considered complete — they close the concurrent/duplicate-checkout edge case
  from spec.md that the original T035 alone did not cover
- **User Story 4 (Phase 6)**: Depends on Foundational; independent of US1/US2/US3 code, but
  needs US3's `Transaction` rows to exist for meaningful end-to-end testing
- **Polish (Phase 7)**: Depends on all four user stories being complete

### Within Each User Story

- Tests are written first and MUST fail before the corresponding implementation task
- Repository tasks before service tasks; service tasks before route tasks; route tasks before
  router-mounting tasks

### Parallel Opportunities

- All `[P]`-marked Setup tasks (T003, T004) can run together
- All `[P]`-marked Foundational tasks (T007, T008, T009, T011, T012) can run together once T005
  is done (T010 needs T009; T012 needs T011)
- Once Foundational (Phase 2) completes, US1 (Phase 3) and US2 (Phase 4) can be worked in
  parallel; US3 (Phase 5) can start once US1's service/repository exist; US4 (Phase 6) can start
  once Foundational completes, in parallel with US3

---

## Parallel Example: User Story 1

```bash
# Tests for User Story 1 (write and confirm failing together):
Task: "Unit tests for cart creation/add/update/remove/quantity-merge in tests/unit/carts.service.test.js"
Task: "Integration test for the full cart lifecycle in tests/integration/cart-flow.test.js"

# Then, after tests are red:
Task: "Implement the carts repository in src/carts/carts.repository.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run T017/T018 and confirm the cart lifecycle works end-to-end
5. Demo cart creation/management as the MVP slice

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → MVP
3. Add User Story 2 → validate independently (product discovery)
4. Add User Story 3 → validate independently (checkout/payment — the other core value slice)
5. Add User Story 4 → validate independently (transaction history)
6. Polish (Phase 7) → contract tests, edge cases, README, quickstart validation

---

## Notes

- `[P]` tasks touch different files with no unmet dependencies
- `[Story]` labels trace each task back to its spec.md user story
- Constitution Principle I requires every test task in a story to be written and observed
  failing before its paired implementation tasks begin
- Constitution Principle III requires T035's checkout implementation to use a single
  `prisma.$transaction` covering payment submission and the resulting status/Transaction write
- Constitution Principle V requires `carts.service.js` (T020, T035) to depend only on
  `PaymentGateway` (T011), never importing `MockPaymentGateway` (T012) directly outside of
  dependency wiring in `app.js`/`server.js`
- Commit after each task or logical group; stop at any checkpoint to validate a story
  independently
