# Frontend Components — Unit 2: Web UI

## Component Hierarchy
```
index.html
├── <header> — section-switching tabs: "Categories" | "Products"
├── <section id="categories-section"> (categories.js)
│   ├── category-create-form
│   ├── category-list (rows: name, total_stock, rename input, delete button)
│   └── category-form-error (inline error area)
└── <section id="products-section"> (products.js + stock.js)
    ├── product-filter-bar (category <select> filter, sort_by/sort_dir controls)
    ├── product-create-form (name, price, code, category <select>)
    ├── product-list (rows: name, price, code, category, quantity, edit/delete/adjust-stock/history buttons)
    ├── product-form-error (inline error area, shared by create/update)
    ├── stock-adjustment-form (shown per-row when "Adjust Stock" clicked; delta input + submit)
    ├── stock-adjustment-error (inline error area)
    └── history-view (shown when "History" clicked; chronological table for one product)
```
No component framework/router — plain DOM manipulation via vanilla JS, sections toggled with a simple `display: none`/`display: block` switch (Q5: A).

## State (module-level, per JS file — no shared global state object)
- `categories.js`: `let categories = []` (last-fetched list, re-fetched on every mutation and whenever the product create/update form needs the picker).
- `products.js`: `let products = []`, `let currentSort = {sort_by: 'name', sort_dir: 'asc'}`, `let currentCategoryFilter = null`.
- `stock.js`: `let openHistoryProductId = null` (which product's history view, if any, is currently shown).

## User Interaction Flows
See `business-logic-model.md` for the full per-story flows (create/rename/delete/adjust/list/history), including confirmation and error-message handling.

## Form Validation Rules (Client-Side, Non-Authoritative)
- Required-field checks (name/price/code non-empty, category selected) block form submission client-side purely for immediate feedback — Unit 1 re-validates everything server-side regardless (per `business-rules.md`'s framing note).
- `price` input uses `type="number" step="0.01" min="0"` — a browser-level nudge, not a substitute for Unit 1's validation.
- `delta` input (stock adjustment) uses `type="number" step="1"` (no `min`/`max` — both positive and negative values are valid; zero is caught by Unit 1's `INVALID_ADJUSTMENT_DELTA`, not blocked client-side, since the user should see the same message either way and one validation path is simpler to keep correct than two).

## API Integration Points (which Unit 1 endpoint each component uses)
| Component | Endpoint(s) |
|---|---|
| `categories.js` | `GET /categories`, `POST /categories`, `PATCH /categories/{id}`, `DELETE /categories/{id}` |
| `products.js` | `GET /products?sort_by&sort_dir&category_id`, `POST /products`, `PATCH /products/{id}`, `DELETE /products/{id}` (+ `GET /categories` for the category picker) |
| `stock.js` | `POST /products/{id}/stock-adjustments`, `GET /products/{id}/stock-adjustments` |
| `api-client.js` | Not a component itself — the shared `fetch` wrapper + `ERROR_MESSAGES` lookup every component above calls through |

## Automation-Friendly Markup (per Code Generation's Critical Rules)
Every interactive element gets a stable `data-testid`, named `{component}-{element-role}`:
- `category-create-form-submit-button`, `category-list-row-delete-button` (with the category id as a `data-category-id` attribute, not baked into the `data-testid` itself, so the testid stays stable across renders)
- `product-create-form-submit-button`, `product-list-row-edit-button`, `product-list-row-delete-button`, `product-list-row-adjust-stock-button`, `product-list-row-history-button`
- `stock-adjustment-form-submit-button`
- `product-filter-bar-category-select`, `product-filter-bar-sort-select`
