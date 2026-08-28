# Application Design — Warehouse Inventory System (Consolidated)

This document consolidates `components.md`, `component-methods.md`, `services.md`, and `component-dependency.md`. See those files for full detail.

## Design Decisions (from application-design-plan.md)
1. **Component boundaries**: One component per domain — `CategoryComponent`, `ProductComponent`, `StockAdjustmentComponent` — plus a shared `Database` component.
2. **Service-layer pattern**: Each domain component has its own service (`CategoryService`, `ProductService`, `StockAdjustmentService`); services call other components directly for cross-domain checks. No separate orchestration layer.
3. **Error-handling architecture**: A custom exception hierarchy (`NotFoundError`, `ValidationError`, `ConflictError`, `InvariantViolationError`) raised by services, caught by a single global exception handler in the API layer that maps to HTTP status + structured body and logs with context.
4. **API layer organization**: One router per domain (`categories`, `products`, `stock-adjustments`), each calling exactly one service method per endpoint.
5. **Web UI structure**: Single-page static app (`index.html` + `api-client.js`, `categories.js`, `products.js`, `stock.js`), with `api-client.js` centralizing `fetch` calls and error-message translation.

## Component Summary
| Component | Layer | Responsibility |
|---|---|---|
| Database | Backend (Unit 1) | SQLite connection/session/schema |
| CategoryComponent | Backend (Unit 1) | Category persistence, name uniqueness, stock totals |
| ProductComponent | Backend (Unit 1) | Product persistence, code uniqueness, stock read/write |
| StockAdjustmentComponent | Backend (Unit 1) | Immutable history persistence |
| API Layer | Backend (Unit 1) | Routing + global exception handling |
| Web UI Component | Frontend (Unit 2) | Full-CRUD browser interface over the REST API |

## Service Summary
| Service | Orchestrates |
|---|---|
| CategoryService | Category CRUD; category-delete eligibility (via ProductComponent) |
| ProductService | Product CRUD; category-active validation (via CategoryComponent); product-delete eligibility (via StockAdjustmentComponent) |
| StockAdjustmentService | Stock adjustment with invariant + soft-delete-product rejection; atomic stock-update + history-write |

## Dependency Summary
```
Web UI --HTTP/JSON--> API Layer (routers, wrapped by global exception handler)
API Layer --> Services --> Domain Components --> Database
```
No circular dependencies; cross-domain reads only (CategoryComponent and ProductComponent never call each other directly — only their Services reach across, read-only).

## Traceability to Requirements
- FR1 (Categories) → CategoryComponent + CategoryService + `categories` router
- FR2 (Products) → ProductComponent + ProductService + `products` router
- FR3 (Stock Adjustments) → StockAdjustmentComponent + StockAdjustmentService + `stock-adjustments` router
- FR4 (Web UI) → Web UI Component
- NFR1 (Data Integrity) → atomic operations in StockAdjustmentService and each Service's delete-eligibility checks
- NFR3 (Error Handling) → custom exception hierarchy + global exception handler
- NFR4 (Persistence) → Database component (SQLite)

## Validation
- Every functional requirement (FR1–FR4) maps to at least one component, service, and API router — no orphaned requirements.
- Every component has a clear, non-overlapping responsibility; no two components own the same table.
- The service layer fully covers the cross-domain checks identified in requirements.md (category-delete eligibility, product-delete eligibility, category-active validation, soft-deleted-product rejection) — none are left unassigned.
- Design intentionally stops at method signatures and dependencies — detailed business-rule logic (exact validation order, specific transaction boundaries, error message text) is deferred to Functional Design (Construction phase, per-unit), consistent with this stage's scope.

## Explicit Rules Added (Post-Review)
Three behaviors that would otherwise have been left implementer-dependent are now stated explicitly in `components.md`/`component-methods.md`/`services.md`:
1. `CategoryComponent.get_stock_totals()` excludes stock belonging to soft-deleted products, even when their category is active (consistent with FR2.5's listing exclusion).
2. `ProductComponent.update()`'s `fields` parameter excludes stock/quantity entirely — the only path to change stock is `StockAdjustmentService.adjust_stock()`.
3. `ProductService.create_product()` validates `initial_stock >= 0` before creation, applying the non-negative-stock invariant at creation time, not only to later adjustments.
