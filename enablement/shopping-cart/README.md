# Shopping Cart API

A simple backend API for managing shopping carts: create a cart, add/update/remove items,
retrieve a cart's contents and total, check out (finalize, no payment), or clear a cart. In-memory
storage, no user accounts. See [specs/001-shopping-cart-api/](specs/001-shopping-cart-api/) for
the full spec, plan, and API contract.

## Install

```bash
npm install
```

## Run

```bash
npm run dev     # start the dev server with auto-reload (src/server.ts via tsx)
npm run build    # compile to dist/
npm start        # run the compiled server (after build)
```

The server listens on `http://localhost:3000` by default (override with the `PORT` env var).

## Test

```bash
npm test
```

Runs unit tests (`tests/unit/carts.service.test.ts`) and integration tests
(`tests/integration/carts.router.test.ts`) via Vitest.

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/carts` | Create a new, empty, open cart |
| GET | `/carts/:cartId` | Retrieve a cart's items, status, and total price |
| POST | `/carts/:cartId/items` | Add an item (`productId`, `quantity`, `price`); merges into an existing line item for the same `productId`, summing quantity and overwriting price |
| PATCH | `/carts/:cartId/items/:productId` | Update a line item's `quantity`; `0` removes it |
| DELETE | `/carts/:cartId/items/:productId` | Remove a line item |
| POST | `/carts/:cartId/checkout` | Finalize the cart (clears items, locks it); requires at least one item; no payment involved |
| POST | `/carts/:cartId/clear` | Clear the cart's items without checking out; cart stays open |

Full request/response shapes and status codes: [contracts/cart-api.md](specs/001-shopping-cart-api/contracts/cart-api.md).
