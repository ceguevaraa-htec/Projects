# API Contract: Shopping Cart API

Base path: `/carts`. All request/response bodies are JSON. Field types per
[data-model.md](../data-model.md).

## POST /carts

Create a new, empty, open cart.

**Request body**: none

**Response 201**:
```json
{ "id": "string", "status": "open", "items": [], "totalPrice": 0 }
```

---

## GET /carts/:cartId

Retrieve a cart's current contents, status, and total price (FR-007).

**Response 200**:
```json
{
  "id": "string",
  "status": "open",
  "items": [{ "productId": "string", "quantity": 1, "price": 9.99 }],
  "totalPrice": 9.99
}
```

**Response 404** (`CartNotFoundError`):
```json
{ "error": "CART_NOT_FOUND", "message": "Cart {cartId} does not exist." }
```

---

## POST /carts/:cartId/items

Add an item to an open cart (FR-002). If `productId` already exists in the cart, quantity is
summed and price is overwritten (FR-003).

**Request body**:
```json
{ "productId": "string", "quantity": 1, "price": 9.99 }
```

**Response 200**: updated cart (same shape as `GET /carts/:cartId`)

**Response 400** (`ValidationError`): `quantity <= 0` or `price < 0`
```json
{ "error": "VALIDATION_ERROR", "message": "quantity must be greater than 0." }
```

**Response 404** (`CartNotFoundError`): unknown `cartId`

**Response 409** (`CartFinalizedError`): cart is `checked_out`
```json
{ "error": "CART_FINALIZED", "message": "Cart {cartId} has already been checked out." }
```

---

## PATCH /carts/:cartId/items/:productId

Update a line item's quantity (FR-004). `quantity === 0` removes the item (FR-005).

**Request body**:
```json
{ "quantity": 3 }
```

**Response 200**: updated cart

**Response 400** (`ValidationError`): `quantity < 0`

**Response 404**: unknown `cartId` (`CartNotFoundError`) or `productId` not in cart
(`ItemNotFoundError`)

**Response 409** (`CartFinalizedError`): cart is `checked_out`

---

## DELETE /carts/:cartId/items/:productId

Remove a line item from an open cart (FR-006).

**Response 200**: updated cart

**Response 404**: unknown `cartId` (`CartNotFoundError`) or `productId` not in cart
(`ItemNotFoundError`)

**Response 409** (`CartFinalizedError`): cart is `checked_out`

---

## POST /carts/:cartId/checkout

Finalize a cart: requires at least one item (FR-010); clears items and locks the cart (FR-009).
No payment is processed.

**Response 200**: updated cart (`status: "checked_out"`, `items: []`, `totalPrice: 0`)

**Response 404** (`CartNotFoundError`): unknown `cartId`

**Response 409**:
- `EmptyCartCheckoutError` — cart has no items:
  ```json
  { "error": "EMPTY_CART_CHECKOUT", "message": "Cannot check out an empty cart." }
  ```
- `CartFinalizedError` — cart already checked out

---

## POST /carts/:cartId/clear

Clear a cart's contents without checking out (FR-011). Cart remains `open`.

**Response 200**: updated cart (`status: "open"`, `items: []`, `totalPrice: 0`)

**Response 404** (`CartNotFoundError`): unknown `cartId`

**Response 409** (`CartFinalizedError`): cart is `checked_out`
