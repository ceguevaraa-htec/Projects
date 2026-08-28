# Requirements: Warehouse Inventory System

## Intent Analysis Summary
- **User Request**: Build an inventory management tool for retail stores and warehouses — organize products into categories, view product details (name, price, code), update stock quantities with a full audit history, prevent stock from going below zero, support sorting/filtering of product listings, and show total stock per category.
- **Request Type**: New Project (Greenfield)
- **Scope Estimate**: System-wide (new application, API + web UI + persistence layer)
- **Complexity Estimate**: Moderate — multiple entities (categories, products, stock adjustments) with relational integrity, an invariant to enforce (stock >= 0), an audit trail, and cross-cutting NFRs (test coverage, global error handling).
- **Requirements Depth**: Standard

## Technology Decisions (from clarifying questions)
- **Language / Framework**: Python, using FastAPI or Flask (final framework choice deferred to Application/NFR Design) with SQLite as the relational datastore.
- **Interface**: REST API is the primary interface. A web UI is also provided, built as static HTML/CSS + vanilla JS calling the REST API via `fetch` (served as static files by the backend — no separate frontend build/framework). **Revision**: the UI now performs full CRUD (see FR4) rather than being read-only. This does not change the technology decision — `fetch` natively supports `POST`/`PUT`/`DELETE`, so plain HTML/CSS/vanilla JS remains sufficient; no SPA framework is required. (Resolved directly rather than re-opening a question, since it's a capability confirmation, not a new architectural choice — flag if you'd prefer otherwise.)
- **Deployment Model**: Single local instance / demo / low-concurrency internal tool. No requirement for high-concurrency multi-client transactional guarantees.
- **Authentication**: None required — single-user / trusted-environment scope.

## Functional Requirements

### FR1 — Category Management
- FR1.1: Users can create, rename, and delete categories via the API (e.g. Beverages, Snacks, Household). Category names are unique; uniqueness is enforced against **all rows regardless of `deleted_at`** (mirroring the product-code reservation rule in FR2.3) — a soft-deleted category's name stays reserved and cannot be reused by a new category, while a hard-deleted category's name is freed since no row remains to enforce the constraint.
- FR1.2: Each product belongs to exactly one category.
- FR1.3: **Delete behavior is conditional**:
  - A category with **zero products referencing it** (counting active *and* soft-deleted products — see FR2.3) can be **hard-deleted** (row removed).
  - A category with **one or more products referencing it** MUST NOT be hard-deleted. Instead it is **soft-deleted**: marked deleted rather than removed, and its existing products keep their category reference unchanged (no orphaning, no cascading changes to those products).
  - A soft-deleted category no longer appears in normal category listings, nor as a selectable option when creating/editing a product.
- FR1.4: The system displays the total stock quantity (sum of all product quantities) per category. This total-stock view **excludes soft-deleted categories** by default (there is currently no UI/API path to view stock still associated with a soft-deleted category — flagged as a possible future enhancement, out of scope for now).

### FR2 — Product Management
- FR2.1: Users can create products via the API. **Category validation is enforced at the API level, not merely as a UI dropdown restriction**: a create request referencing a soft-deleted (or non-existent) category id MUST be rejected with a clear error, even when called directly (e.g. via curl/Postman) rather than through the UI.
- FR2.1a: Users can update an existing product's details (name, price, code, category) via the API. The same API-level category validation from FR2.1 applies here: an update that reassigns a product to a soft-deleted (or non-existent) category id MUST be rejected.
- FR2.1b: Users can delete products via the API (see FR2.3 for conditional hard/soft-delete behavior).
- FR2.2: Each product has: name, price, unique product code, category, and current stock quantity.
- FR2.3: **Delete behavior is conditional**:
  - A product with **zero stock-adjustment history entries** can be **hard-deleted** (row removed). Once hard-deleted, its product code is freed and may be reused by a new product (no history references the deleted row, so nothing is left to reserve it).
  - A product with **one or more stock-adjustment history entries** MUST NOT be hard-deleted. Instead it is **soft-deleted**: marked deleted rather than removed, preserving its history entries' references intact.
  - A soft-deleted product's product code remains **reserved** (not reusable by a new product) because the row — and the unique-code constraint on it — still exists.
  - A soft-deleted product no longer appears in normal product listings, but its history remains fully retrievable (FR3.4 still works for a soft-deleted product).
- FR2.4: Users can view detailed information for a single product (name, price, code, category, current stock).
- FR2.5: Users can view a listing of products, with support for:
  - Sorting by name, price, or stock quantity (ascending/descending)
  - Filtering by category
  - Soft-deleted products are excluded from this listing by default.

### FR3 — Stock Adjustments
- FR3.1: Users can increase or decrease a product's stock quantity via a dedicated stock-adjustment operation (distinct from general product-detail updates). **Stock adjustments are rejected on a soft-deleted product** — a soft-deleted product must not receive further stock changes, even though its existing history remains fully viewable (FR3.4).
- FR3.2: The system MUST reject any adjustment that would bring a product's stock below zero (business invariant — no negative stock, ever).
- FR3.3: Every stock adjustment (increase or decrease) is recorded as an immutable history entry containing: timestamp, product reference, quantity delta, and resulting stock balance.
- FR3.4: Users can retrieve the full stock-adjustment history for a given product, in chronological order.

### FR4 — Web UI (Full CRUD)
- FR4.1: The web UI supports full CRUD for categories and products — create, edit, and delete (hard or soft, per FR1.3/FR2.3 as applicable) — plus stock adjustments (FR3.1), plus the existing listing/history/category-total views.
- FR4.2: The web page displays the product listing with the same sort/filter capabilities as FR2.5.
- FR4.3: The web page displays total stock per category (FR1.4).
- FR4.4: The web page displays the stock-adjustment history for a selected product (FR3.4), including for soft-deleted products.
- FR4.5: The UI performs all operations directly against the REST API — no restriction requiring a separate client (e.g. curl/Postman) for mutating operations.

## Data Model Note: Soft Delete Representation
To keep soft delete consistent across entities, both `categories` and `products` gain a nullable `deleted_at` timestamp column:
- `deleted_at IS NULL` → entity is active and appears in normal listings / selectors.
- `deleted_at IS NOT NULL` → entity is soft-deleted: excluded from normal listings and category selectors, but still referenced by dependent rows (products → category; stock-history → product) without modification.
- A nullable timestamp (rather than a boolean `is_deleted` flag) is used so the system also records *when* the soft delete occurred, which is useful for audit/debugging at negligible extra cost.
- Hard delete removes the row entirely and is only permitted when the conditional checks in FR1.3 / FR2.3 pass (zero referencing products for a category; zero history entries for a product).
- Uniqueness constraints (product code on `products`; name on `categories`) remain enforced against all rows regardless of `deleted_at`, so a soft-deleted product's code — and a soft-deleted category's name — stay reserved; a hard-deleted row's code/name is naturally freed since no row remains to enforce the constraint.
- Category-reference and stock-adjustment validation (rejecting a soft-deleted category on product create/update; rejecting stock adjustments on a soft-deleted product) is enforced in the API/service layer itself, not only in the UI — a direct API call bypassing the UI is held to the same rules.

## Non-Functional Requirements

### NFR1 — Data Integrity
- Stock quantity must never be negative; this is enforced at the data-modification boundary (not just validated client-side).
- Stock adjustments and their resulting balance must be written atomically (product stock update + history record creation succeed or fail together).
- Delete-eligibility checks are enforced atomically with the delete itself (e.g. the "zero history entries" / "zero referencing products" check and the resulting hard-delete or soft-delete happen within the same transaction), preventing a race where a stock adjustment or product creation slips in between the check and the delete.

### NFR2 — Testability
- Unit test coverage of at least **70%** across the codebase.
- Property-based testing (PBT) is applied on a **partial** basis: enforced for pure functions and any serialization/deserialization round-trips (e.g. request/response schema mapping); not required elsewhere.

### NFR3 — Reliability / Error Handling
- Global error handling/catching is implemented at the API boundary — no unhandled exceptions should surface as raw stack traces to a client.
- All errors are logged with appropriate context (timestamp, endpoint, error type/message) to support diagnosis.
- API responses use consistent, structured error payloads (e.g. HTTP status + error code/message).

### NFR4 — Persistence
- A lightweight relational database that runs locally is used (SQLite), requiring no external database server.

### NFR5 — Security / Resiliency (explicitly out of scope for this iteration)
- No authentication/authorization is required for this scope.
- The formal AWS-Well-Architected-derived Security Baseline and Resiliency Baseline extensions are **not** enforced for this project (opted out) — this is treated as a demo/internal tool, not a production-hardened system.

## Out of Scope
- Multi-user accounts, authentication, and role-based access control.
- High-concurrency multi-client write support beyond what SQLite provides by default.
- Viewing or reporting stock totals still associated with a soft-deleted category (default: excluded entirely; flagged as a possible future enhancement).
- Restoring/undeleting a soft-deleted category or product (not requested; soft delete is currently one-directional).
- Formal resiliency (HA/DR) and security-hardening practices beyond basic error handling.

## Summary
This is a Python-based (FastAPI/Flask) REST API backed by SQLite, providing full CRUD for categories and products with **conditional delete semantics**: hard delete when safe (no dependent rows), soft delete via a `deleted_at` timestamp when dependent rows exist (products referencing a category; history entries referencing a product) — preserving referential integrity without cascading or orphaning. Uniqueness (category name, product code) is enforced against all rows regardless of soft-delete status, so soft-deleted entities keep their name/code reserved. Stock-adjustment operations enforce a strict non-negative-stock invariant, reject adjustments on soft-deleted products, and produce a complete, immutable audit history. Product create/update requests reject a soft-deleted (or non-existent) category at the API level — not just as a UI restriction. Product listings are sortable/filterable and exclude soft-deleted entities by default; category views show per-category stock totals, excluding soft-deleted categories. The web UI supports **full CRUD** — including soft/hard delete and stock adjustments — built as plain HTML/CSS/vanilla JS calling the REST API via `fetch` (no framework change needed, since `fetch` supports all HTTP methods). Non-functional requirements center on ≥70% unit test coverage and global error handling with structured logging; authentication, formal resiliency, and formal security-baseline practices remain explicitly out of scope for this iteration.
