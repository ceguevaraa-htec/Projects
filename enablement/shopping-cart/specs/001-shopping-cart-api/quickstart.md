# Quickstart: Shopping Cart API

Validates the feature end-to-end per [spec.md](./spec.md)'s user stories. See
[contracts/cart-api.md](./contracts/cart-api.md) for full request/response shapes and
[data-model.md](./data-model.md) for field definitions.

## Prerequisites

- Node.js installed
- Dependencies installed: `npm install`

## Run the service

```bash
npm run dev   # or: npm start, depending on package.json scripts defined during implementation
```

The server listens on a local port (e.g. `http://localhost:3000`).

## Run the tests

```bash
npm test
```

Expect: unit tests (`tests/unit/carts.service.test.ts`) covering every cart operation, and
integration tests (`tests/integration/carts.router.test.ts`) covering the HTTP contract,
all passing.

## Validate User Story 1 — Build and view a cart (P1)

```bash
# Create a cart
curl -X POST http://localhost:3000/carts
# → 201, note the returned "id"

# Add an item
curl -X POST http://localhost:3000/carts/<id>/items \
  -H 'Content-Type: application/json' \
  -d '{"productId": "sku-1", "quantity": 2, "price": 9.99}'

# Add the same product again at a different price
curl -X POST http://localhost:3000/carts/<id>/items \
  -H 'Content-Type: application/json' \
  -d '{"productId": "sku-1", "quantity": 1, "price": 8.99}'

# Retrieve the cart
curl http://localhost:3000/carts/<id>
```

**Expected**: the cart has one line item for `sku-1` with `quantity: 3` and `price: 8.99`
(quantity summed, price overwritten per FR-003), `status: "open"`, and `totalPrice: 26.97`.

## Validate User Story 2 — Adjust cart contents (P2)

```bash
# Update quantity
curl -X PATCH http://localhost:3000/carts/<id>/items/sku-1 \
  -H 'Content-Type: application/json' -d '{"quantity": 1}'

# Remove the item
curl -X DELETE http://localhost:3000/carts/<id>/items/sku-1
```

**Expected**: after the PATCH, `totalPrice` recalculates to `8.99`; after the DELETE, `items` is
empty and `totalPrice` is `0`.

## Validate User Story 3 — Finalize or empty a cart (P3)

```bash
# Add an item back, then check out
curl -X POST http://localhost:3000/carts/<id>/items \
  -H 'Content-Type: application/json' -d '{"productId": "sku-2", "quantity": 1, "price": 5}'
curl -X POST http://localhost:3000/carts/<id>/checkout

# Any further mutation is rejected
curl -X POST http://localhost:3000/carts/<id>/items \
  -H 'Content-Type: application/json' -d '{"productId": "sku-3", "quantity": 1, "price": 1}'
```

**Expected**: checkout returns `status: "checked_out"`, `items: []`, `totalPrice: 0`; the
follow-up add returns `409 CART_FINALIZED`.

```bash
# Separately, on a fresh open cart with items, clear instead of checking out
curl -X POST http://localhost:3000/carts/<newId>/items \
  -H 'Content-Type: application/json' -d '{"productId": "sku-4", "quantity": 1, "price": 3}'
curl -X POST http://localhost:3000/carts/<newId>/clear
```

**Expected**: `items: []`, `totalPrice: 0`, `status` remains `"open"` (further adds succeed).

## Validate edge cases (spot check)

- `GET /carts/does-not-exist` → `404 CART_NOT_FOUND`
- `POST /carts/<id>/items` with `quantity: 0` → `400 VALIDATION_ERROR`
- `POST /carts/<id>/checkout` on a cart with no items → `409 EMPTY_CART_CHECKOUT`
- `PATCH /carts/<id>/items/unknown-sku` → `404` (item not found)
