# Business Logic Model — Unit 1: Inventory API

Each workflow below maps to one or more of Unit 1's 12 assigned stories (see `unit-of-work-story-map.md`) and shows the sequence of component/service calls, all within the transaction rules from `business-rules.md`.

## Workflow: Create a Category (CAT-1)
1. API layer receives `POST /categories { name }`, calls `CategoryService.create_category(name)`.
2. `CategoryService` calls `CategoryComponent.name_exists(name)` — if true, raise `ConflictError(CATEGORY_NAME_ALREADY_EXISTS)`.
3. Else, `CategoryComponent.create(name)` — returns the new `Category`.

## Workflow: Rename a Category (CAT-2)
1. API layer receives `PATCH /categories/{id} { name }`, calls `CategoryService.rename_category(id, name)`.
2. `CategoryComponent.get_by_id(id)` — if `None`, raise `NotFoundError(CATEGORY_NOT_FOUND)`.
3. If `name == current name`, skip the uniqueness check (self-conflict no-op, Q3: A) and return the category unchanged.
4. Else, `CategoryComponent.name_exists(name)` excluding this id — if true, raise `ConflictError(CATEGORY_NAME_ALREADY_EXISTS)`.
5. Else, `CategoryComponent.rename(id, name)`.

## Workflow: Delete a Category (CAT-3)
1. API layer receives `DELETE /categories/{id}`, calls `CategoryService.delete_category(id)`.
2. `CategoryComponent.get_by_id(id)` — if `None`, raise `NotFoundError(CATEGORY_NOT_FOUND)`.
3. Within one transaction: `ProductComponent.count_by_category(id)` (active + soft-deleted).
4. If count == 0 → `CategoryComponent.hard_delete(id)`. Else → `CategoryComponent.soft_delete(id)`.
5. **[Updated per Unit 2 Functional Design]** The response is `200 OK` with `{"outcome": "hard_deleted" | "soft_deleted"}` (not `204 No Content`) — added so the Web UI can present distinct messaging for each outcome.

## Workflow: View Category Listing with Stock Totals (CAT-4)
1. API layer receives `GET /categories`, calls `CategoryService.list_categories_with_totals()`.
2. `CategoryComponent.list_active()` + `CategoryComponent.get_stock_totals()` (which itself excludes soft-deleted products under active categories, per the Application Design fix).
3. Merge into a response list of `{id, name, total_stock}`, sorted by `name` ascending, no pagination.

## Workflow: Create a Product (PROD-1)
1. API layer receives `POST /products { name, price, code, category_id, initial_stock }` — `price` (decimal) converted to `price_cents` via `dollars_to_cents()` at this boundary.
2. `ProductService.create_product(...)`:
   a. `CategoryComponent.get_by_id(category_id)` — `None` → `NotFoundError(CATEGORY_NOT_FOUND)`; `deleted_at != NULL` → `ConflictError(CATEGORY_INACTIVE)`.
   b. `ProductComponent.code_exists(code)` — true → `ConflictError(PRODUCT_CODE_ALREADY_EXISTS)`.
   c. `initial_stock < 0` → `ValidationError(INVALID_INITIAL_STOCK)`.
   d. `ProductComponent.create(...)`.
3. Response converts `price_cents` back to decimal via `cents_to_dollars()`.

## Workflow: Update Product Details (PROD-2)
1. API layer receives `PATCH /products/{id} { name?, price?, code?, category_id? }` (never `quantity`/`stock` — rejected as `ValidationError` if present).
2. `ProductService.update_product(id, fields)`:
   a. `ProductComponent.get_by_id(id)` — `None` → `NotFoundError(PRODUCT_NOT_FOUND)`.
   b. If `category_id` present and changed: re-run the category-active check (as in PROD-1.a).
   c. If `code` present and changed: re-run the code-uniqueness check, excluding this product's own row.
   d. `ProductComponent.update(id, fields)`.

## Workflow: Delete a Product (PROD-3)
1. API layer receives `DELETE /products/{id}`, calls `ProductService.delete_product(id)`.
2. `ProductComponent.get_by_id(id)` — `None` → `NotFoundError(PRODUCT_NOT_FOUND)`.
3. Within one transaction: `StockAdjustmentComponent.count_for_product(id)`.
4. If count == 0 → `ProductComponent.hard_delete(id)` (code freed). Else → `ProductComponent.soft_delete(id)` (code stays reserved).
5. **[Updated per Unit 2 Functional Design]** The response is `200 OK` with `{"outcome": "hard_deleted" | "soft_deleted"}` (not `204 No Content`) — added so the Web UI can present distinct messaging for each outcome.

## Workflow: View Product Detail (PROD-4)
1. API layer receives `GET /products/{id}`, calls `ProductService.get_product(id)`.
2. `ProductComponent.get_by_id(id)` — `None` → `NotFoundError(PRODUCT_NOT_FOUND)`. (Allowed for soft-deleted products too, to support history viewing.)

## Workflow: Sort and Filter Product Listing (PROD-5)
1. API layer receives `GET /products?sort_by=&sort_dir=&category_id=`, calls `ProductService.list_products(sort_by, sort_dir, category_id_filter)`.
2. `ProductComponent.list(...)` — excludes soft-deleted products, applies default `name`/`asc` if params omitted, no pagination.

## Workflow: Increase or Decrease Stock (STK-1, STK-2)
1. API layer receives `POST /products/{id}/stock-adjustments { delta }`, calls `StockAdjustmentService.adjust_stock(id, delta)`.
2. Within one transaction:
   a. `ProductComponent.get_by_id(id)` — `None` → `NotFoundError(PRODUCT_NOT_FOUND)`; `deleted_at != NULL` → `ConflictError(PRODUCT_INACTIVE)`.
   b. `delta == 0` → `ValidationError(INVALID_ADJUSTMENT_DELTA)`.
   c. `resulting_balance = current_quantity + delta`; if `< 0` → `InvariantViolationError(STOCK_WOULD_GO_NEGATIVE)` — no writes occur.
   d. `ProductComponent.set_stock(id, resulting_balance)` and `StockAdjustmentComponent.record(id, delta, resulting_balance)` — both within the same transaction (NFR1).

## Workflow: View Stock Adjustment History (HIST-1)
1. API layer receives `GET /products/{id}/stock-adjustments`, calls `StockAdjustmentService.get_history(id)`.
2. `ProductComponent.get_by_id(id)` (any status) — `None` → `NotFoundError(PRODUCT_NOT_FOUND)`.
3. `StockAdjustmentComponent.list_for_product(id)` — chronological (oldest first), no pagination.

## Cross-Cutting: Global Exception Handling
Every workflow above raises one of the four domain exceptions on failure and performs **no partial writes** — reads/checks that fail short-circuit before any write executes, and writes within a transaction succeed or roll back together. The global exception handler at the API layer catches the exception type, maps it to the HTTP status + error body from `business-rules.md`, logs it with request context (endpoint, exception type, message, timestamp), and returns the structured response — no raw stack trace ever reaches the client (NFR3).
