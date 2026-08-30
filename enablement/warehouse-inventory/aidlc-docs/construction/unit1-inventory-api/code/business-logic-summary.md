# Business Logic Summary — Unit 1: Inventory API

## Files
- `backend/app/exceptions.py` — `DomainError` base + `NotFoundError`/`ValidationError`/`ConflictError`/`InvariantViolationError`, each carrying `error_code` and `message`.
- `backend/app/components/category_component.py` — `CategoryComponent` (as a module of functions): `create`, `get_by_id`, `list_active`, `rename`, `soft_delete`, `hard_delete`, `name_exists`, `get_stock_totals`.
- `backend/app/components/product_component.py` — `ProductComponent`: `create`, `get_by_id`, `list_products`, `update`, `soft_delete`, `hard_delete`, `code_exists`, `count_by_category`, `set_stock`.
- `backend/app/components/stock_adjustment_component.py` — `StockAdjustmentComponent`: `record`, `list_for_product`, `count_for_product`.
- `backend/app/services/category_service.py`, `product_service.py`, `stock_adjustment_service.py` — orchestration per `business-logic-model.md`'s 12 workflows.

**Note on component/service representation**: `components.md`/`services.md` describe these as classes (e.g. `CategoryComponent`). They are implemented as modules of plain functions taking `session` explicitly (e.g. `category_component.create(session, name)`) rather than classes with methods — functionally equivalent (a module is a namespace, same as a class with only static methods would be), and simpler given there is no per-instance state to hold. Call sites read as `<component_module>.<method>(session, ...)`, matching the method tables in `component-methods.md` one-to-one.

## Session Threading (Explicit Verification)
Per the Code Generation plan's explicit refinement, every check-then-write service method takes `session: Session` as its **first parameter**, sourced by the caller from `Depends(get_session)`, and passes that exact instance into every component call it makes. Verified below:

| Service Method | `session` is 1st param | Component calls made | Same `session` instance passed? |
|---|---|---|---|
| `category_service.delete_category` | ✅ | `product_component.count_by_category(session, ...)`, `category_component.hard_delete(session, ...)` / `soft_delete(session, ...)` | ✅ — identical `session` object threaded through both |
| `product_service.create_product` | ✅ | `category_component.get_by_id(session, ...)`, `product_component.code_exists(session, ...)`, `product_component.create(session, ...)` | ✅ |
| `product_service.update_product` | ✅ | `product_component.get_by_id(session, ...)`, `category_component.get_by_id(session, ...)` (conditional), `product_component.code_exists(session, ...)` (conditional), `product_component.update(session, ...)` | ✅ |
| `product_service.delete_product` | ✅ | `product_component.get_by_id(session, ...)`, `stock_adjustment_component.count_for_product(session, ...)`, `product_component.hard_delete(session, ...)` / `soft_delete(session, ...)` | ✅ |
| `stock_adjustment_service.adjust_stock` | ✅ | `product_component.get_by_id(session, ...)`, `product_component.set_stock(session, ...)`, `stock_adjustment_component.record(session, ...)` | ✅ |

No component function creates or opens a new session — every component function's signature takes `session: Session` as its first parameter and uses it directly (`session.get(...)`, `session.add(...)`, `session.flush()`, `session.scalars(...)`); none constructs a `SessionLocal()` internally. This can be spot-checked by grepping the components directory for `SessionLocal` or `sessionmaker` — neither appears, confirming components never source their own session.

Read-only single-component service methods (`category_service.list_categories_with_totals`, `product_service.get_product`, `product_service.list_products`, `stock_adjustment_service.get_history`) also take `session` as their first parameter for consistency, even though they have no check-then-write pair to protect — this keeps the calling convention uniform across the service layer.

## Business Rule Coverage (test file → rule)
| Rule (from `business-rules.md`) | Verified By |
|---|---|
| Category name uniqueness (all rows), rename self-conflict excluded | `test_category_service.py` |
| Category conditional hard/soft delete | `test_category_service.py` |
| Category stock totals exclude soft-deleted categories & soft-deleted products | `test_category_service.py` |
| Product category-active validation (create + update), API-level (not just UI) | `test_product_service.py` |
| Product code uniqueness (all rows) | `test_product_service.py` |
| Product `update()` rejects a quantity field | `test_product_service.py` |
| Product conditional hard/soft delete, code reserved/freed | `test_product_service.py` |
| `initial_stock >= 0` validation | `test_product_service.py` |
| Stock adjustment: non-negative invariant | `test_stock_adjustment_service.py` |
| Stock adjustment: zero-delta rejected (decided in Functional Design, confirmed here) | `test_stock_adjustment_service.py` |
| Stock adjustment: soft-deleted product rejected | `test_stock_adjustment_service.py` |
| History: chronological order, retrievable for soft-deleted product | `test_stock_adjustment_service.py` |
| Currency conversion round-trip | `test_currency.py` (property-based) |
