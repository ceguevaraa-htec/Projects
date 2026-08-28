# Components — Warehouse Inventory System

## Backend Components (Unit 1 — Inventory API)

### 1. Database Component
- **Purpose**: Owns the SQLite connection/session lifecycle and schema definition.
- **Responsibilities**:
  - Define the schema for `categories`, `products`, `stock_adjustments` (including `deleted_at` on categories/products).
  - Provide a connection/session to the domain components (Category, Product, StockAdjustment).
  - Own schema creation/migration on startup.
- **Interfaces**: A session/connection factory used by all domain components. No business logic.

### 2. CategoryComponent
- **Purpose**: Owns category data and category-level business rules.
- **Responsibilities**:
  - Persistence access for `categories` (create, rename, soft/hard delete, list, get-by-id).
  - Enforce category-name uniqueness against all rows (active + soft-deleted) — FR1.1.
  - Compute per-category stock totals, excluding soft-deleted categories — FR1.4. **Explicit rule**: the total also excludes stock belonging to soft-deleted products, even when those products reference an active category — consistent with FR2.5's listing exclusion, a soft-deleted product's stock is not "current" inventory and should not inflate an otherwise-active category's total.
  - Expose whether a category is eligible for hard-delete (queried by CategoryService, which asks ProductComponent for the referencing-product count).
- **Interfaces**: Consumed by `CategoryService` and (read-only, for validation) by `ProductService`.

### 3. ProductComponent
- **Purpose**: Owns product data and product-level business rules.
- **Responsibilities**:
  - Persistence access for `products` (create, update, soft/hard delete, get-by-id, list with sort/filter) — FR2.
  - Enforce product-code uniqueness against all rows (active + soft-deleted) — FR2.3.
  - Track current stock quantity per product (read/write, invariant enforcement delegated to StockAdjustmentService for adjustment operations).
  - Expose whether a product is eligible for hard-delete (queried by ProductService, which asks StockAdjustmentComponent for the history-entry count).
- **Interfaces**: Consumed by `ProductService` and (read-only, for validation) by `StockAdjustmentService`.

### 4. StockAdjustmentComponent
- **Purpose**: Owns the immutable stock-adjustment history.
- **Responsibilities**:
  - Persistence access for `stock_adjustments` (create entry, list history for a product in chronological order) — FR3.3, FR3.4.
  - Expose whether a product has any history entries (queried by ProductService for delete-eligibility).
- **Interfaces**: Consumed by `StockAdjustmentService`.

### 5. API Layer
- **Purpose**: HTTP boundary — routing, request/response marshalling, and global error handling.
- **Responsibilities**:
  - One router per domain (`categories`, `products`, `stock-adjustments`), each translating HTTP requests into service calls.
  - A single global exception handler that catches the domain-exception hierarchy (and any unhandled exception) and maps it to an HTTP status + structured error body, logging the error with context.
- **Interfaces**: Exposes the REST API surface consumed by the Web UI and any direct API client.

## Frontend Component (Unit 2 — Web UI)

### 6. Web UI Component
- **Purpose**: Static, browser-rendered full-CRUD interface over the REST API.
- **Responsibilities**:
  - Render category/product listings (sortable/filterable), category totals, product detail, and adjustment history.
  - Provide forms for category/product create/edit/delete and stock adjustments.
  - Centralize API calls and error-message translation through a shared client module (`api-client.js`), including confirmation prompts before destructive actions.
- **Interfaces**: Consumes the API Layer's REST endpoints over HTTP; no in-process dependency on backend components.
