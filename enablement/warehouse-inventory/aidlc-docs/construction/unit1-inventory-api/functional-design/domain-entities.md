# Domain Entities — Unit 1: Inventory API

## Category
| Field | Type | Notes |
|---|---|---|
| `id` | integer, auto-increment PK | |
| `name` | string | Unique across **all rows regardless of `deleted_at`** (FR1.1). Rename uniqueness check excludes the row's own current value (a rename to its existing name is a no-op success, not a conflict). |
| `deleted_at` | nullable ISO 8601 UTC timestamp string | `NULL` = active. Set on soft-delete. |

## Product
| Field | Type | Notes |
|---|---|---|
| `id` | integer, auto-increment PK | |
| `name` | string | |
| `price_cents` | integer | **Currency conversion boundary**: all business logic and persistence use integer cents — no floating-point currency arithmetic anywhere in the domain/database layer. The API request/response schema (Unit 1's API layer) is the *only* place a decimal dollar amount (e.g. `9.99`) is seen by external callers; it converts via two single-purpose functions: `dollars_to_cents(amount: Decimal/str) -> int` on the way in, `cents_to_dollars(cents: int) -> Decimal` on the way out. No component or service touches a float/decimal price. |
| `code` | string | Unique across **all rows regardless of `deleted_at`** (FR2.3). |
| `category_id` | integer, FK → Category.id | Must reference an **active** category (`deleted_at IS NULL`) at creation/update time (FR2.1/FR2.1a) — validated by `ProductService`, not a DB-level constraint (an existing product keeps its reference even if the category is later soft-deleted). |
| `quantity` | integer | Current stock. Must be >= 0 at all times (NFR1). Never written directly by `ProductComponent.update()` — only by `StockAdjustmentService.adjust_stock()` via `ProductComponent.set_stock()`. |
| `deleted_at` | nullable ISO 8601 UTC timestamp string | `NULL` = active. Set on soft-delete. |

## StockAdjustment
| Field | Type | Notes |
|---|---|---|
| `id` | integer, auto-increment PK | |
| `product_id` | integer, FK → Product.id | References the product even after it is soft-deleted (never cascaded/modified). |
| `delta` | integer, signed | Positive = increase, negative = decrease. Never zero (a zero-delta adjustment is rejected as a validation error — no-op adjustments are not meaningful history). |
| `resulting_balance` | integer | The product's `quantity` immediately after this adjustment was applied. Denormalized for fast history reads without recomputing from a running sum. |
| `created_at` | ISO 8601 UTC timestamp string | Set at insert time; entries are immutable (FR3.3) — no update/delete operation exists for this entity. |

## Listing & Pagination Decisions (Explicit)
- **`GET /categories`** and **`GET /products`**: no pagination — full result set returned; default sort is `name` ascending when no `sort_by`/`sort_dir` is given (FR1.4/FR2.5).
- **`GET /products/{id}/stock-adjustments`** (history, FR3.4): **also no pagination**, decided explicitly rather than left to inherit the listing default above. A single product's history can grow unbounded in a way a catalog listing cannot (a catalog has a natural upper bound; adjustment history accumulates indefinitely over the product's lifetime). For this learning-scope, local/demo project (per requirements.md's deployment-model decision), unbounded-but-unpaginated is accepted as a known, explicit limitation — not an oversight. Chronological order (oldest first, per FR3.4) is unaffected either way.

## Currency Note
`price_cents` avoids the classic floating-point cents-rounding bug (e.g. `19.99 + 0.01` not equaling `20.00` in binary float). Since this system has no multi-currency requirement (out of scope), a plain integer-cents column is sufficient — no need for a full money/currency-code type.
