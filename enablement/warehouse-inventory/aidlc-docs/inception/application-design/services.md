# Services — Warehouse Inventory System

**Pattern (Q2: A)**: Each domain component exposes its own service. There is no separate orchestration/facade layer — a service calls into other components' components directly when it needs cross-domain information (e.g. `ProductService` asks `CategoryComponent` whether the category is active). This keeps the system's layering simple, appropriate for a single-process app of this size.

## CategoryService
- **Responsibility**: Orchestrates category use cases, including the one cross-domain check needed for delete-eligibility.
- **Orchestration**:
  - `delete_category`: asks `ProductComponent.count_by_category` for the referencing count (active + soft-deleted), then calls `CategoryComponent.hard_delete` or `CategoryComponent.soft_delete` accordingly.
  - `create_category` / `rename_category`: calls `CategoryComponent.name_exists` before writing, to enforce FR1.1's cross-row-status uniqueness rule.

## ProductService
- **Responsibility**: Orchestrates product use cases, including category validation and delete-eligibility.
- **Orchestration**:
  - `create_product` / `update_product`: calls `CategoryComponent.get_by_id` to confirm the target category exists and is active (`deleted_at IS NULL`) before writing — enforced here regardless of caller (UI or direct API), per FR2.1/FR2.1a.
  - `create_product` / `update_product`: calls `ProductComponent.code_exists` to enforce FR2.3's uniqueness rule.
  - `create_product`: validates `initial_stock >= 0` before calling `ProductComponent.create` — the same non-negative-stock invariant enforced everywhere else in the system applies at creation time, not just to later adjustments.
  - `update_product`: does not accept a stock/quantity field at all (see `ProductComponent.update`'s explicit rule) — stock changes only ever go through `StockAdjustmentService.adjust_stock`.
  - `delete_product`: asks `StockAdjustmentComponent.count_for_product` for the history count, then calls `ProductComponent.hard_delete` or `ProductComponent.soft_delete` accordingly.

## StockAdjustmentService
- **Responsibility**: Orchestrates stock-adjustment use cases, enforcing the non-negative-stock invariant and the soft-deleted-product rejection rule, and keeping the stock-update + history-write atomic.
- **Orchestration**:
  - `adjust_stock`: calls `ProductComponent.get_by_id` to confirm the product exists and is active (rejects if soft-deleted, per FR3.1); computes the resulting balance and rejects if it would go below zero (FR3.2); within a single transaction, calls `ProductComponent.set_stock` and `StockAdjustmentComponent.record` together (NFR1 atomicity).
  - `get_history`: calls `ProductComponent.get_by_id` (any status) to confirm the product exists at all, then `StockAdjustmentComponent.list_for_product` — works for soft-deleted products (FR3.4).

## API Layer's Relationship to Services
The API layer's routers are thin: they parse/validate the HTTP request shape, call exactly one service method, and let the global exception handler translate any raised domain exception into an HTTP response. Routers do not contain business logic or call components directly — only services.

## Web UI's Relationship to the API
The Web UI has no backend services of its own — `api-client.js` is a thin HTTP client, not a service. All orchestration and validation happens server-side; the UI's Functional Design stage (Unit 2, Construction phase) will define how each service-level rejection surfaces as a UI message, not new business logic.
