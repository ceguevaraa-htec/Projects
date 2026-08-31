# Phase 1 Data Model: Shopping Cart with Mock Payment Gateway

Derived from the spec's Key Entities and Functional Requirements. Field names are the intended
Prisma schema field names; types are Prisma scalar types.

**Enum casing note**: spec.md refers to cart/transaction outcomes in prose as "Paid" / "Failed" /
"approved" / "declined". The API and database use the upper-case enum values defined below
(`OPEN`/`PAID`/`FAILED` for `Cart.status`, `APPROVED`/`DECLINED` for `Transaction.status`) as the
actual wire and storage representation — clients and tests MUST match this casing, not the
spec's prose casing.

## Product

Represents a catalog item available for purchase (FR-008–FR-011).

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `name` | `String` | Indexed for search (FR-010) |
| `category` | `String` | Indexed for filtering (FR-009) |
| `priceCents` | `Int` | Price stored as integer cents to avoid floating-point total errors |
| `description` | `String?` | Optional |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

**Validation rules**: `name` required, non-empty; `priceCents >= 0`.

## Cart

Represents one shopper session's in-progress or completed shopping cart (FR-001, FR-006,
FR-012–FR-017, FR-024).

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | Doubles as the anonymous session/cart token (FR-024) |
| `status` | `String` (enum: `OPEN`, `PAID`, `FAILED`) | Default `OPEN` |
| `promoCodeId` | `String?` | FK → PromoCode, set at checkout if a valid code was supplied |
| `discountCents` | `Int?` | Snapshot of the discount amount applied at checkout |
| `totalCents` | `Int?` | Snapshot of the final total computed at checkout (null until checkout) |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |
| `items` | `CartItem[]` | Relation |
| `transactions` | `Transaction[]` | Relation (checkout attempts for this cart) |

**Validation rules / state transitions**:
- `status` starts `OPEN` on creation (FR-001).
- `OPEN → PAID` only when the mock gateway approves (FR-014); `OPEN → PAID` sets `totalCents`
  and `discountCents`.
- `OPEN → FAILED` only when the mock gateway declines (FR-015).
- A cart already `PAID` MUST NOT transition again via checkout (FR-017) — a repeat checkout
  attempt is rejected before a new `Transaction` row is created.
- Checkout is rejected (no state change, no `Transaction` row) when `items` is empty (FR-016).

## CartItem

A line item linking a `Cart` to a `Product` and quantity; unique per product within a cart
(FR-002–FR-005).

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `cartId` | `String` | FK → Cart |
| `productId` | `String` | FK → Product |
| `quantity` | `Int` | `> 0` (FR-007) |
| `unitPriceCents` | `Int` | Snapshot of `Product.priceCents` at time of add, so later price changes don't retroactively alter an open cart |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

**Constraints**: `@@unique([cartId, productId])` — enforces "no duplicate line items" (FR-003) at
the schema level; adding an existing product updates `quantity` on the existing row instead of
inserting.

**Validation rules**: `quantity >= 1` on create/update (FR-007); removing a `CartItem` deletes
the row (FR-005).

## Transaction

A record of one checkout/payment attempt for a cart (FR-018, FR-019, FR-020).

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `cartId` | `String` | FK → Cart |
| `status` | `String` (enum: `APPROVED`, `DECLINED`) | Outcome from the mock gateway |
| `totalCents` | `Int` | Total computed and submitted for this attempt |
| `discountCents` | `Int` | Discount applied for this attempt (0 if none) |
| `promoCodeId` | `String?` | FK → PromoCode, if one was used |
| `gatewayReference` | `String` | Opaque id returned by `PaymentGateway.submitPayment` |
| `createdAt` | `DateTime @default(now())` | Timestamp of the attempt (FR-018) |

**Validation rules**: Created only as part of the checkout flow (FR-013, FR-018), inside the same
transaction as the resulting `Cart.status` update, so a `Transaction` row and its cart's status
are never inconsistent with each other (constitution Principle III).

## PromoCode

Supports FR-025 (checkout-time discount via coupon code). Not one of the spec's originally named
Key Entities, but required to make FR-025 concrete and seedable per FR-023.

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `code` | `String @unique` | The code the shopper supplies at checkout |
| `discountType` | `String` (enum: `PERCENT`, `FIXED`) | |
| `discountValue` | `Int` | Percent (0-100) or fixed cents amount, per `discountType` |
| `active` | `Boolean @default(true)` | Invalid/expired codes set `active = false` |
| `expiresAt` | `DateTime?` | Optional expiration |

**Validation rules**: A code is valid for use only when `active` is true and (`expiresAt` is null
or in the future); an invalid/unknown code causes checkout to reject with a clear error rather
than silently proceeding without a discount (FR-025).

## Relationships

```text
Product 1───* CartItem *───1 Cart 1───* Transaction
                                  *
                                  │
                                  1
                             PromoCode
```

- One `Product` can appear in many `CartItem`s (across different carts).
- One `Cart` has many `CartItem`s (at most one per `Product`, enforced by the unique
  constraint) and many `Transaction`s (one per checkout attempt, though in practice at most one
  successful attempt per FR-017).
- One `PromoCode` can be referenced by many `Cart`s/`Transaction`s.
