# Phase 1 Data Model: Shopping Cart API

Derived from [spec.md](./spec.md) Key Entities and Functional Requirements.

## Cart

Represents a single shopping cart.

| Field | Type | Notes |
|---|---|---|
| `id` | string | System-assigned, unique. Returned on creation (FR-001). |
| `status` | `"open" \| "checked_out"` | Starts `"open"`. Becomes `"checked_out"` on checkout (FR-009) and is permanent — no operation transitions it back (Assumptions). Returned on retrieval (FR-007). |
| `items` | `LineItem[]` | Zero or more. Empty after creation, after checkout, or after clear. |

**Derived value** (not stored): `totalPrice` = sum over `items` of `quantity × price` (FR-008).
Computed on read, never persisted independently, so it can never drift from its line items.

### State transitions

```
[created] --(add/update/remove item)--> open (unlimited transitions among open states)
open --(clear)--> open (items emptied, status unchanged)
open --(checkout, requires >=1 item)--> checked_out (items emptied, status locked)
checked_out --(any mutating operation)--> REJECTED (FR-012)
```

## LineItem

Represents one product's presence within a cart. Embedded in its parent `Cart` — not an
independently addressable entity (see [research.md](./research.md)'s repository decision).

| Field | Type | Notes |
|---|---|---|
| `productId` | string | Client-supplied. Unique within a cart — at most one line item per `productId` per cart (FR-003). |
| `quantity` | integer > 0 | Client-supplied on add; strictly greater than zero (FR-014). Updated via PATCH; updating to `0` removes the line item (FR-005). |
| `price` | number ≥ 0 | Client-supplied on add. On a duplicate add for the same `productId`, quantity is summed and price is **overwritten** with the newest value (FR-003). |

## Validation rules (service layer)

- **Create cart**: no input; always succeeds (FR-001).
- **Add item**: cart must exist and be `open` (FR-013, FR-012); `quantity` must be `> 0`, `price`
  must be `>= 0` (FR-014). If `productId` already present, merge per FR-003; else append.
- **Update item quantity**: cart must exist and be `open`; `productId` must already be present in
  the cart (FR-015); `quantity` must be `>= 0`. `quantity === 0` removes the line item (FR-005).
- **Remove item**: cart must exist and be `open`; `productId` must already be present (FR-015).
- **Retrieve cart**: cart must exist (FR-013). Allowed regardless of status.
- **Checkout**: cart must exist and be `open`; must have `items.length >= 1` (FR-010); on success,
  `items` cleared and `status` set to `checked_out`.
- **Clear**: cart must exist and be `open`; `items` cleared, `status` unchanged (stays `open`).

## Error taxonomy (maps to HTTP status in the router — see [contracts/cart-api.md](./contracts/cart-api.md))

| Error | Trigger | HTTP status |
|---|---|---|
| `CartNotFoundError` | Unknown `cartId` on any operation (FR-013) | 404 |
| `ItemNotFoundError` | Unknown `productId` on update/remove (FR-015) | 404 |
| `CartFinalizedError` | Mutating operation on a `checked_out` cart (FR-012) | 409 |
| `EmptyCartCheckoutError` | Checkout with zero items (FR-010) | 409 |
| `ValidationError` | Invalid `quantity`/`price` on add or update (FR-014) | 400 |
