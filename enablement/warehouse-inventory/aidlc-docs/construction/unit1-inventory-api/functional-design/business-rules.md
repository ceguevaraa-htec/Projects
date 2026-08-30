# Business Rules — Unit 1: Inventory API

## Exception Hierarchy → HTTP Mapping
| Exception | HTTP Status | When Raised |
|---|---|---|
| `NotFoundError` | 404 | Referenced entity (category/product) does not exist at all (no row, any status) |
| `ValidationError` | 400 | Malformed input the request itself is responsible for (e.g. zero-delta adjustment, negative `initial_stock`, missing required field) |
| `ConflictError` | 409 | A uniqueness constraint would be violated (duplicate active category name, duplicate product code) or a referenced category/product is soft-deleted where an active one is required |
| `InvariantViolationError` | 422 | A well-formed request would violate a core business invariant if applied (decrease would take stock below zero) |
| *(any other unhandled exception)* | 500 | Caught by the global exception handler as a safety net; logged with full context, generic message returned to the client (no stack trace leaked) |

## Error Response Body (Q5: A)
```json
{"error_code": "STOCK_WOULD_GO_NEGATIVE", "message": "Cannot decrease stock below zero."}
```
`error_code` is a stable, machine-parseable `SCREAMING_SNAKE_CASE` identifier the Web UI (Unit 2) branches on to choose a user-facing message; `message` is a human-readable fallback (also what gets logged).

### Error Codes Catalog
| `error_code` | Exception | Example Trigger |
|---|---|---|
| `CATEGORY_NOT_FOUND` | NotFoundError | Category id doesn't exist |
| `PRODUCT_NOT_FOUND` | NotFoundError | Product id doesn't exist |
| `CATEGORY_NAME_ALREADY_EXISTS` | ConflictError | Create/rename to a name already used by an active or soft-deleted category (excluding the row's own current name on rename) |
| `PRODUCT_CODE_ALREADY_EXISTS` | ConflictError | Create/update to a code already used by an active or soft-deleted product |
| `CATEGORY_INACTIVE` | ConflictError | Product create/update references a soft-deleted category |
| `PRODUCT_INACTIVE` | ConflictError | Stock adjustment attempted on a soft-deleted product |
| `INVALID_INITIAL_STOCK` | ValidationError | `initial_stock < 0` on product create |
| `INVALID_ADJUSTMENT_DELTA` | ValidationError | `delta == 0` on a stock adjustment |
| `STOCK_WOULD_GO_NEGATIVE` | InvariantViolationError | `current_quantity + delta < 0` |

## Category Business Rules
- **Create**: reject with `CATEGORY_NAME_ALREADY_EXISTS` if `name` matches any row (active or soft-deleted).
- **Rename**: reject with `CATEGORY_NOT_FOUND` if the category doesn't exist (any status). Reject with `CATEGORY_NAME_ALREADY_EXISTS` if the new name matches a *different* row (active or soft-deleted) — **the check excludes the category's own current row**, so renaming to the same name it already has succeeds as a no-op (Q3: A).
- **Delete**: count products referencing the category (`ProductComponent.count_by_category`, active + soft-deleted). If 0 → hard delete. If >= 1 → soft delete (set `deleted_at`). Existing products' `category_id` is never modified.
- **Stock totals**: sum `quantity` across a category's products, excluding (a) soft-deleted categories entirely and (b) any soft-deleted product's `quantity`, even under an active category.
- **Listing**: excludes soft-deleted categories; no pagination; default sort by `name` ascending.

## Product Business Rules
- **Create**: validate, in order: (1) referenced category exists and is active (`CATEGORY_NOT_FOUND` / `CATEGORY_INACTIVE`), (2) `code` not already used by any row (`PRODUCT_CODE_ALREADY_EXISTS`), (3) `initial_stock >= 0` (`INVALID_INITIAL_STOCK`). Only after all three pass is the row created.
- **Update**: `fields` accepted are `name`, `price_cents`, `code`, `category_id` — **never** `quantity`. If `category_id` is changing, re-run the category-active check. If `code` is changing, re-run the uniqueness check (excluding the product's own row). Attempting to include a stock/quantity field in the update request is a `ValidationError` (the field doesn't exist on this operation).
- **Delete**: count history entries for the product (`StockAdjustmentComponent.count_for_product`). If 0 → hard delete (code freed). If >= 1 → soft delete (code stays reserved).
- **Listing**: excludes soft-deleted products; supports `sort_by ∈ {name, price, quantity}` and `sort_dir ∈ {asc, desc}` (default `name`/`asc`); supports `category_id` filter; no pagination.
- **Detail view**: works for an active product; a soft-deleted product's detail view is still allowed (needed to support viewing its history, FR3.4) but is excluded from listings.

## Stock Adjustment Business Rules
- **Single endpoint, signed delta** (Q2: A): `POST /products/{id}/stock-adjustments { "delta": <signed int> }`.
- Validate, in order: (1) product exists at all (`PRODUCT_NOT_FOUND` if no row), (2) product is active — reject with `PRODUCT_INACTIVE` if soft-deleted (FR3.1), (3) `delta != 0` (`INVALID_ADJUSTMENT_DELTA`), (4) `current_quantity + delta >= 0` (`STOCK_WOULD_GO_NEGATIVE` if not, FR3.2).
- On success: within one transaction, update the product's `quantity` to `current_quantity + delta` and insert a `StockAdjustment` row with `delta` and the new `resulting_balance` (NFR1 atomicity).
- **History retrieval**: works regardless of the product's active/soft-deleted status (FR3.4); returned in chronological order (oldest first); no pagination (explicit decision, see domain-entities.md).

## Transaction Rules (Q6: A, refined)
- Every service method that performs a check-then-write (`CategoryService.delete_category`, `ProductService.create_product`, `ProductService.update_product`, `ProductService.delete_product`, `StockAdjustmentService.adjust_stock`) runs its **entire body inside one SQLite transaction/session**.
- **Explicit rule**: the transaction/session object is created once at the top of the service method and passed explicitly into every component call made within that method (e.g. `CategoryService.delete_category` passes the *same* session into both `ProductComponent.count_by_category(session, ...)` and `CategoryComponent.soft_delete(session, ...)` / `hard_delete(session, ...)`). A component method must never open its own new session internally — doing so would silently defeat the atomicity guarantee by letting the count-check and the delete commit as two separate transactions.
- Read-only single-component methods (e.g. `ProductService.get_product`, `ProductService.list_products`) may use a lightweight per-call session, since there is no check-then-write pair to protect.
