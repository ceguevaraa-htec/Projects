---

description: "Task list template for feature implementation"
---

# Tasks: Shopping Cart API

**Input**: Design documents from `/specs/001-shopping-cart-api/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cart-api.md,
quickstart.md

**Tests**: Included. Constitution Principle II requires a service-layer unit test for every
cart operation; plan.md additionally requires a router-level integration test (via supertest)
per endpoint. Both are mandatory, not optional, for this feature.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact, per plan.md's Project Structure

## Path Conventions

Single backend project (per plan.md): `src/` and `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project directories per plan.md: `src/models/`, `src/repositories/`,
      `src/services/`, `src/routers/`, `tests/unit/`, `tests/integration/`
- [ ] T002 Initialize TypeScript/Node.js project: `package.json`, `tsconfig.json`, with
      `express` as a runtime dependency and `typescript`, `vitest`, `supertest`,
      `@types/express`, `@types/supertest`, `@types/node` as dev dependencies
- [ ] T003 [P] Add npm scripts to `package.json`: `dev` (run `src/server.ts` via a TS runner),
      `build` (tsc), `test` (`vitest run`)
- [ ] T004 [P] Add `vitest.config.ts` at repo root configured to discover tests under `tests/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared building blocks every user story needs. The repository is a single,
complete module (a cart and its line items are one aggregate per research.md — all cart
operations share the same `Map`), so it lands here in full rather than being split per story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Define the `Cart`, `LineItem`, and `CartStatus` (`"open" | "checked_out"`) types in
      `src/models/cart.ts`, per data-model.md
- [ ] T006 [P] Implement a minimal structured logger in `src/logger.ts` exposing a function
      that writes one line per call containing `{ action, cartId, productId?, timestamp }`,
      for use by the service layer only (constitution Principle III)
- [ ] T007 [P] Define typed error classes in `src/http.ts`: `CartNotFoundError`,
      `ItemNotFoundError`, `CartFinalizedError`, `EmptyCartCheckoutError`, `ValidationError`,
      plus a helper mapping each to its HTTP status and structured error body
      (404/404/409/409/400) per the Error taxonomy in data-model.md and contracts/cart-api.md
      (constitution Principle IV)
- [ ] T008 Implement the carts repository in `src/repositories/carts.repository.ts`: an
      in-memory `Map<string, Cart>` with `create(): Cart`, `findById(id): Cart | undefined`,
      and `save(cart): void` — data access only, no validation, no logging, no total
      calculation (constitution Principle I) (depends on T005 for the `Cart` type)
- [ ] T009 Create the Express app skeleton in `src/app.ts`: JSON body parsing middleware, a
      central error-handling middleware that maps the typed errors from T007 to their HTTP
      response, and a mount point for the carts router (router itself added in later phases)
      (depends on T007)
- [ ] T010 Create the process entrypoint in `src/server.ts` that imports the app from
      `src/app.ts` and starts it listening on a configurable port

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Build and view a cart (Priority: P1) 🎯 MVP

**Goal**: A client can create a cart, add items to it (merging quantity and overwriting price
on a repeated product id), and retrieve its items, status, and total price.

**Independent Test**: Create a cart via `POST /carts`, add one or more items via
`POST /carts/:cartId/items`, and retrieve it via `GET /carts/:cartId` to confirm the items,
status, and total price are correct, per spec.md User Story 1.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, and confirm they fail before implementing this phase.

- [ ] T011 [P] [US1] Unit tests for create/add/get in `tests/unit/carts.service.test.ts`:
      `createCart` returns a new cart with a generated `id`, `status: "open"`, no items, and
      total price `0` (FR-001); `addItem` on an empty cart adds a line item and recalculates
      the total (FR-002, FR-008); `addItem` for a `productId` already in the cart sums the
      quantity and overwrites the price with the newly supplied value (FR-003); `addItem`
      rejects a quantity that is not strictly greater than zero and rejects a negative price
      (FR-014); `getCart` returns the cart's items, status, and total, or throws
      `CartNotFoundError` for an unknown id (FR-007, FR-013)
- [ ] T012 [P] [US1] Integration tests for `POST /carts`, `POST /carts/:cartId/items`,
      `GET /carts/:cartId` in `tests/integration/carts.router.test.ts` using supertest against
      the app from `src/app.ts`: asserts `201` + body shape on create; `200` + updated cart on
      a valid add, including the merge-and-overwrite-price case; `400` on invalid
      quantity/price; `200` + items/status/total on a valid get; `404` on an unknown cart id
      for both add and get, per contracts/cart-api.md

### Implementation for User Story 1

- [ ] T013 [US1] Implement `createCart()`, `addItem(cartId, productId, quantity, price)`, and
      `getCart(cartId)` in `src/services/carts.service.ts`. Include a shared
      `assertCartOpen(cart)` guard (throws `CartFinalizedError` when `cart.status ===
      "checked_out"`, per FR-012) defined in this file from the start, and have `addItem` call
      it before mutating the cart — `checkout`/`clearCart` don't exist yet in this phase, so the
      guard is unreachable until Phase 5 wires in the `status` transition, but `addItem` is
      written to call it from day one rather than being retrofitted later. Validate
      `quantity > 0` and `price >= 0` on add (throw `ValidationError` otherwise), merge into an
      existing line item by `productId` (sum quantity, overwrite price) or append a new one,
      compute total price as the sum of `quantity × price` across items, throw
      `CartNotFoundError` for an unknown `cartId`, delegate storage to the repository from T008,
      and call the logger from T006 once per successful create/add with
      `{ action, cartId, productId? }` (constitution Principle III; reads are not logged)
- [ ] T014 [US1] Implement `POST /carts`, `POST /carts/:cartId/items`, `GET /carts/:cartId` in
      `src/routers/carts.router.ts`: parse the request, call the corresponding service function
      from T013, and let the error-handling middleware from T009 map thrown errors to their
      response — no validation or logging logic in the router itself (constitution Principle I)
- [ ] T015 [US1] Mount the carts router from T014 onto the Express app in `src/app.ts` at the
      `/carts` base path

**Checkpoint**: User Story 1 is fully functional and independently testable — a client can
build and view a cart end-to-end.

---

## Phase 4: User Story 2 - Adjust cart contents (Priority: P2)

**Goal**: A client can update a line item's quantity or remove it, with the cart's total price
updating accordingly.

**Independent Test**: Starting from a cart with items (from User Story 1), update one item's
quantity and remove another, then retrieve the cart to confirm both changes and the
recalculated total, per spec.md User Story 2.

### Tests for User Story 2 ⚠️

- [ ] T016 [P] [US2] Unit tests for update/remove in `tests/unit/carts.service.test.ts`:
      `updateItemQuantity` with a positive value changes the line item's quantity and
      recalculates the total (FR-004); `updateItemQuantity` with `0` removes the line item
      (FR-005); `updateItemQuantity` with a negative value throws `ValidationError`;
      `updateItemQuantity`/`removeItem` for a `productId` not present in the cart throws
      `ItemNotFoundError` (FR-015); `removeItem` on an existing line item removes it and
      recalculates the total, leaving other items unaffected (FR-006)
- [ ] T017 [P] [US2] Integration tests for `PATCH /carts/:cartId/items/:productId` and
      `DELETE /carts/:cartId/items/:productId` in `tests/integration/carts.router.test.ts`:
      asserts `200` + updated cart (with recalculated total) on a valid update and on a valid
      remove; `200` + item removed on update-to-zero; `400` on a negative quantity; `404` on an
      unknown cart id or an unknown product id for both endpoints, per contracts/cart-api.md

### Implementation for User Story 2

- [ ] T018 [US2] Implement `updateItemQuantity(cartId, productId, quantity)` and
      `removeItem(cartId, productId)` in `src/services/carts.service.ts`, each calling the
      `assertCartOpen(cart)` guard from T013 before mutating the cart (FR-012, unreachable until
      Phase 5 wires in `checkout`, same as `addItem`). Throw `CartNotFoundError`/
      `ItemNotFoundError` as appropriate, treat `quantity === 0` as removal (FR-005), reject a
      negative quantity with `ValidationError`, recompute the total, and log
      `{ action: "update_item" | "remove_item", cartId, productId }` on success (depends on
      T013 for the guard and shared validation helpers/conventions)
- [ ] T019 [US2] Implement `PATCH /carts/:cartId/items/:productId` and
      `DELETE /carts/:cartId/items/:productId` in `src/routers/carts.router.ts`, calling the
      service functions from T018 and letting the error-handling middleware map thrown errors
      to their response (depends on T014 for the router file's existing structure)

**Checkpoint**: User Stories 1 and 2 both work independently — carts can be built, viewed, and
adjusted.

---

## Phase 5: User Story 3 - Finalize or empty a cart (Priority: P3)

**Goal**: A client can check out a cart (finalize + clear, no payment) or clear a cart's
contents directly without checking out.

**Independent Test**: Starting from a cart with items, check it out and confirm the cart is
emptied, finalized, and rejects further mutation; separately, clear a different cart with items
without checking out and confirm it empties but stays open, per spec.md User Story 3.

### Tests for User Story 3 ⚠️

- [ ] T020 [P] [US3] Unit tests for checkout/clear in `tests/unit/carts.service.test.ts`:
      `checkout` on a cart with at least one item clears its items and sets
      `status: "checked_out"` (FR-009); `checkout` on a cart with no items throws
      `EmptyCartCheckoutError` (FR-010); `checkout`, `addItem`, `updateItemQuantity`,
      `removeItem`, and `clearCart` on an already-`checked_out` cart each throw
      `CartFinalizedError` (FR-012); `clearCart` on an open cart with items empties its items,
      recalculates the total to `0`, and leaves `status: "open"` (FR-011)
- [ ] T021 [P] [US3] Integration tests for `POST /carts/:cartId/checkout` and
      `POST /carts/:cartId/clear` in `tests/integration/carts.router.test.ts`: asserts `200` +
      emptied/finalized cart on a valid checkout; `409` on checkout of an empty cart; `200` +
      emptied/open cart on a valid clear; `409` on any mutating request (add/update/remove/
      checkout/clear) against an already-checked-out cart; `404` on an unknown cart id for both
      endpoints, per contracts/cart-api.md

### Implementation for User Story 3

- [ ] T022 [US3] Implement `checkout(cartId)` and `clearCart(cartId)` in
      `src/services/carts.service.ts`, each calling the `assertCartOpen(cart)` guard from T013
      (throws `CartFinalizedError` if the cart is already `checked_out`) before mutating the
      cart — the same guard `addItem`/`updateItemQuantity`/`removeItem` already call, so this
      phase adds no changes to those functions. Throw `CartNotFoundError` for an unknown id,
      `EmptyCartCheckoutError` if `checkout` is called with zero items; on success, empty the
      items and, for `checkout` only, set `status: "checked_out"` — this is the first phase
      where the guard becomes reachable, since it's the only place `status` transitions to
      `checked_out`; log `{ action: "checkout" | "clear", cartId }` on success (depends on T013
      for the guard and shared conventions)
- [ ] T023 [US3] Implement `POST /carts/:cartId/checkout` and `POST /carts/:cartId/clear` in
      `src/routers/carts.router.ts`, calling the service functions from T022 and letting the
      error-handling middleware map thrown errors to their response (depends on T014 for the
      router file's existing structure)

**Checkpoint**: All user stories (build/view, adjust, finalize/empty) are independently
functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and documentation that spans all user stories

- [ ] T024 [P] Run every scenario in `quickstart.md` against the running dev server (`npm run
      dev` + the curl commands) and confirm the observed status codes/bodies match
      contracts/cart-api.md
- [ ] T025 [P] Add a `README.md` at repo root documenting how to install, run (`npm run dev`),
      test (`npm test`), and the seven available endpoints
- [ ] T026 Review the logger output (T006) across `createCart`, `addItem`,
      `updateItemQuantity`, `removeItem`, `checkout`, and `clearCart` to confirm every
      successful mutation logs exactly one entry with `action`, `cartId`, and `productId` where
      applicable, that no read-only operation logs anything (constitution Principle III
      compliance pass), and that every rejected operation (invalid input, unknown cart/item,
      checked-out cart) returns a structured 4xx response rather than an unhandled exception
      (constitution Principle IV compliance pass)
- [ ] T027 [P] Add an integration test in `tests/integration/carts.router.test.ts` confirming a
      request with no `Authorization` header or token still succeeds (e.g. `POST /carts` then
      `GET /carts/:cartId`), making FR-016 ("no user account, login, or session required")
      explicitly verified rather than only implicitly true by the absence of auth middleware

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; T018/T019 build on the service/router
  files T013/T014 create, but do not require US1's tests to pass first
- **User Story 3 (Phase 5)**: Depends on Foundational; T022/T023 build on the same shared files
  as US1/US2. T022 does not modify US1/US2's mutating functions — they already call the shared
  `assertCartOpen` guard from T013; T022 only adds `checkout`/`clearCart` and the `status`
  transition itself
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Tests are written first and must fail before their implementation tasks are done
- Service-layer task before router task (router calls the service)
- Router task before the "mount"/next-story task that extends the same file

### Parallel Opportunities

- T003 and T004 (Setup) can run in parallel
- T006 (logger) and T007 (error types) can run in parallel with T005 (model) in Foundational
- Within each user story, the unit test task and the integration test task (e.g. T011 + T012)
  can run in parallel — different files
- T024, T025, and T027 (Polish) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch both test tasks for User Story 1 together:
Task: "Unit tests for create/add/get in tests/unit/carts.service.test.ts"
Task: "Integration tests for POST/POST:items/GET:cartId in tests/integration/carts.router.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything else)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run `tests/unit/carts.service.test.ts` and
   `tests/integration/carts.router.test.ts` for US1, and the User Story 1 scenario in
   quickstart.md
5. This is a usable MVP — carts can be built and viewed

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → MVP
3. Add User Story 2 → validate independently (US1 still passes)
4. Add User Story 3 → validate independently (US1 + US2 still pass)
5. Polish: quickstart.md full run, README, logging + error-handling compliance pass, no-auth
   test

---

## Notes

- [P] tasks touch different files and have no unmet dependencies
- [Story] label maps each task to its user story for traceability
- Tests are mandatory here (constitution Principle II + plan.md), not optional — confirm each
  fails before writing the corresponding implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before moving to the next
