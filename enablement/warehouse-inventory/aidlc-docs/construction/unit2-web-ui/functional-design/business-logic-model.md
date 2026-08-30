# Business Logic Model — Unit 2: Web UI

Unit 2 has no server-side business rules of its own — every workflow below is a thin UI wrapper around a Unit 1 endpoint. Each workflow shows the interaction flow, including confirmation and error-surfacing, per the approved Functional Design decisions.

## Workflow: Manage Categories (UI-1 → CAT-1/2/3/4)
1. On loading the Categories section, `categories.js` calls `GET /categories` via `api-client.js` and renders the list (name + total stock per row).
2. **Create**: user fills the "New Category" form, submits → `POST /categories`. On success, re-fetch and re-render the list. On error (`CATEGORY_NAME_ALREADY_EXISTS`), show the mapped message in the inline error area next to the form; the list is untouched.
3. **Rename**: user edits a category's name inline, submits → `PATCH /categories/{id}`. Same success/error handling as create.
4. **Delete**: user clicks "Delete" on a category row → `window.confirm("Delete category '<name>'? This cannot be undone if it has no products.")`. If confirmed → `DELETE /categories/{id}`.
   - Response `{"outcome": "hard_deleted"}` → show "Category permanently deleted." and remove the row.
   - Response `{"outcome": "soft_deleted"}` → show "Category archived — it still has products, so it was hidden rather than removed." and remove the row (soft-deleted categories don't appear in `GET /categories` either way, per FR1.3).
   - Error (`CATEGORY_NOT_FOUND`, e.g. deleted by another tab) → inline error, re-fetch the list to resync.

## Workflow: Manage Products (UI-2 → PROD-1/2/3)
1. **Create**: user fills the "New Product" form (name, price, code, category — a `<select>` populated from `GET /categories`, so only active categories are ever offered), submits → `POST /products`. Errors mapped: `CATEGORY_INACTIVE`/`CATEGORY_NOT_FOUND` (category picker went stale — re-fetch categories and prompt retry), `PRODUCT_CODE_ALREADY_EXISTS`, `INVALID_INITIAL_STOCK`.
2. **Update**: user edits a product's fields inline, submits → `PATCH /products/{id}`. Same error set as create, minus `INVALID_INITIAL_STOCK` (not applicable to update).
3. **Delete**: user clicks "Delete" on a product row → `window.confirm(...)`. If confirmed → `DELETE /products/{id}`.
   - `{"outcome": "hard_deleted"}` → "Product permanently deleted." Row removed.
   - `{"outcome": "soft_deleted"}` → "Product archived — it has stock history, so it was hidden rather than removed. Its history remains viewable." Row removed from the listing (soft-deleted products are excluded from `GET /products`, but the History workflow below can still reach it directly by id if the user has its link/id).

## Workflow: Adjust Stock (UI-3 → STK-1/2)
1. From a product's detail row, user enters a signed delta and submits → `POST /products/{id}/stock-adjustments`.
2. Success → show the new `resulting_balance` inline, refresh the product's displayed quantity.
3. Errors mapped: `PRODUCT_INACTIVE` ("This product has been archived and can no longer receive stock changes."), `INVALID_ADJUSTMENT_DELTA` ("Enter a non-zero amount."), `STOCK_WOULD_GO_NEGATIVE` ("Not enough stock — cannot go below zero."), `PRODUCT_NOT_FOUND` (resync product list).

## Workflow: View Listings, Category Totals, and History (UI-4 → PROD-5/CAT-4/HIST-1)
1. **Product listing**: `sort_by`/`sort_dir`/`category_id` controls trigger `GET /products?...`; re-render on change. No client-side sorting/filtering duplication — always re-queries the API, so it always reflects the authoritative order/filter Unit 1 defines.
2. **Category totals**: rendered directly from `GET /categories`'s `total_stock` field (already computed server-side, per Unit 1's Application Design fix excluding soft-deleted products).
3. **History**: user clicks "History" on a product (including one reached by direct id even if soft-deleted, since the listing excludes it but its id may still be known from a prior view) → `GET /products/{id}/stock-adjustments`, rendered as a chronological table (timestamp, delta, resulting balance).
