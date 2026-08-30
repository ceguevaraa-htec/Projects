# Code Generation Plan — Unit 1: Inventory API

**This plan is the single source of truth for Unit 1's Code Generation.** All application code is written under the workspace root (`/Users/cesar.guevara/Projects/enablement/warehouse-inventory`), never under `aidlc-docs/`. Documentation summaries go under `aidlc-docs/construction/unit1-inventory-api/code/`.

## Unit Context
- **Stories implemented**: CAT-1, CAT-2, CAT-3, CAT-4, PROD-1, PROD-2, PROD-3, PROD-4, PROD-5, STK-1, STK-2, HIST-1 (12 stories, per `unit-of-work-story-map.md`).
- **Dependencies**: None (Unit 1 is self-contained; Unit 2 depends on Unit 1, not vice versa).
- **Interfaces/contract exposed**: REST API per FastAPI's auto-generated OpenAPI schema (`/openapi.json`, `/docs`), routers for `categories`, `products`, `products/{id}/stock-adjustments`.
- **Database entities owned**: `categories`, `products`, `stock_adjustments` (SQLite, via SQLAlchemy models).
- **Design source documents**: `functional-design/{domain-entities,business-rules,business-logic-model}.md`, `nfr-requirements/{nfr-requirements,tech-stack-decisions}.md`, `nfr-design/{nfr-design-patterns,logical-components}.md`.

## Steps

- [x] **Step 1 — Project Structure Setup (greenfield)**
  - Create `backend/app/__init__.py`, `backend/app/{db,components,services,api}/__init__.py`
  - Create `backend/tests/{unit,integration}/__init__.py`
  - Create `backend/requirements.txt` (fastapi, uvicorn, sqlalchemy, pydantic, pytest, pytest-cov, hypothesis, httpx — httpx needed for FastAPI's `TestClient`)
  - Create top-level `.gitignore` additions for Python (`__pycache__/`, `*.db`, `.venv/`) if not already covered by the existing `.gitignore`

- [x] **Step 2 — Database/Repository Layer Generation** *(Database component, domain-entities.md)*
  - `backend/app/db/session.py`: SQLAlchemy engine (SQLite, `connect_args={"timeout": 5}` per NFR Design), `SessionLocal`, `get_session()` FastAPI dependency
  - `backend/app/db/models.py`: SQLAlchemy models — `Category` (id, name, deleted_at), `Product` (id, name, price_cents, code, category_id FK, quantity, deleted_at), `StockAdjustment` (id, product_id FK, delta, resulting_balance, created_at)
  - `backend/app/db/base.py`: SQLAlchemy declarative `Base`; schema bootstrap function `create_all(engine)`

- [x] **Step 3 — Database Layer Unit Testing**
  - `backend/tests/unit/test_models.py`: model construction, default values, FK relationships (in-memory SQLite)

- [x] **Step 4 — Database Layer Summary** *(doc)*
  - `aidlc-docs/construction/unit1-inventory-api/code/database-layer-summary.md`

- [x] **Step 5 — Business Logic Generation** *(Components + Services, business-rules.md, business-logic-model.md)*
  - `backend/app/exceptions.py`: `NotFoundError`, `ValidationError`, `ConflictError`, `InvariantViolationError` (each carrying an `error_code` and `message`)
  - `backend/app/components/category_component.py`: `CategoryComponent` — `create`, `get_by_id`, `list_active`, `rename`, `soft_delete`, `hard_delete`, `name_exists`, `get_stock_totals` (excludes soft-deleted products)
  - `backend/app/components/product_component.py`: `ProductComponent` — `create`, `get_by_id`, `list`, `update` (no quantity field), `soft_delete`, `hard_delete`, `code_exists`, `count_by_category`, `set_stock`
  - `backend/app/components/stock_adjustment_component.py`: `StockAdjustmentComponent` — `record`, `list_for_product`, `count_for_product`
  - `backend/app/services/category_service.py`: `CategoryService` — `create_category`, `rename_category` (self-conflict excluded), `delete_category` (hard/soft), `list_categories_with_totals`
  - `backend/app/services/product_service.py`: `ProductService` — `create_product` (category-active + code-uniqueness + `initial_stock >= 0` validation), `update_product` (category-active + code-uniqueness re-check, no quantity field), `delete_product` (hard/soft), `get_product`, `list_products`
  - `backend/app/services/stock_adjustment_service.py`: `StockAdjustmentService` — `adjust_stock` (active-product + non-zero-delta + non-negative-balance validation, atomic write), `get_history`
  - **Explicit session-threading rule (applies to every check-then-write method above: `delete_category`, `create_product`, `update_product`, `delete_product`, `adjust_stock`)**: each such method's *first parameter* is `session: Session`, sourced by the caller (the API router) from `Depends(get_session)` — the service method never creates or requests its own session. Every component call made within that method body passes that exact same `session` instance (e.g. `delete_category(session, category_id)` calls both `ProductComponent.count_by_category(session, category_id)` and `CategoryComponent.soft_delete(session, category_id)`/`hard_delete(session, category_id)` with the identical object). No component method may open a new session internally.

- [x] **Step 6 — Business Logic Unit Testing** *(covers all 12 stories' business-rule branches)*
  - `backend/tests/unit/test_category_service.py`: create/rename (incl. self-conflict no-op)/delete (hard+soft branches)/stock-totals-excludes-soft-deleted-products — CAT-1..4
  - `backend/tests/unit/test_product_service.py`: create/update (incl. category-inactive rejection, code-conflict, quantity-field-rejected)/delete (hard+soft branches)/detail/list-sort-filter — PROD-1..5
  - `backend/tests/unit/test_stock_adjustment_service.py`: increase/decrease/zero-floor rejection/soft-deleted-product rejection/zero-delta rejection/history retrieval (incl. for soft-deleted product) — STK-1, STK-2, HIST-1
  - `backend/tests/unit/test_currency.py`: `dollars_to_cents()`/`cents_to_dollars()` round-trip (property-based test, per NFR Requirements' partial-PBT decision)

- [x] **Step 7 — Business Logic Summary** *(doc)*
  - `aidlc-docs/construction/unit1-inventory-api/code/business-logic-summary.md`
  - **Must include** an explicit "Session Threading" section verifying, per check-then-write method, that: (a) `session` is the method's first parameter, (b) it is passed unchanged into every component call within that method, (c) no component call receives or opens a different session. This makes the rule verifiable after generation rather than merely assumed.

- [x] **Step 8 — API Layer Generation** *(business-rules.md error mapping, nfr-design-patterns.md)*
  - `backend/app/api/schemas.py`: Pydantic request/response models for Category/Product/StockAdjustment, including the `dollars_to_cents()`/`cents_to_dollars()` conversion at (de)serialization boundaries
  - `backend/app/api/categories.py`: `categories` router — `POST /categories`, `PATCH /categories/{id}`, `DELETE /categories/{id}`, `GET /categories`
  - `backend/app/api/products.py`: `products` router — `POST /products`, `PATCH /products/{id}`, `DELETE /products/{id}`, `GET /products/{id}`, `GET /products`
  - `backend/app/api/stock_adjustments.py`: `stock-adjustments` router — `POST /products/{id}/stock-adjustments`, `GET /products/{id}/stock-adjustments`
  - **Explicit session-threading rule (router side)**: every route handler for a check-then-write operation declares `session: Session = Depends(get_session)` and passes `session` as the first positional argument into its one service-method call — completing the session-threading chain described in Step 5 (router → service → components, one instance throughout the request).
  - `backend/app/api/error_handlers.py`: global exception handlers for the 4 domain exceptions + generic `Exception` fallback, each logging via `logging.getLogger(__name__)` and returning `{"error_code", "message"}`
  - `backend/app/main.py`: FastAPI app instance, `logging.basicConfig(...)` at startup, `create_all(engine)` at startup, router mounting, exception-handler registration, static-file mount for `frontend/` (serves Unit 2 once it exists)

- [x] **Step 9 — API Layer Unit + Integration Testing**
  - `backend/tests/unit/test_schemas.py`: Pydantic schema (de)serialization round-trips (property-based, per NFR Requirements)
  - `backend/tests/integration/test_categories_api.py`, `test_products_api.py`, `test_stock_adjustments_api.py`: full FastAPI `TestClient` requests against a temporary on-disk SQLite file, asserting HTTP status + response body for both success and each documented error case

- [x] **Step 10 — API Layer Summary** *(doc)*
  - `aidlc-docs/construction/unit1-inventory-api/code/api-layer-summary.md`

- [x] **Step 11 — Documentation Generation**
  - `backend/README.md`: setup (`venv`, `pip install -r requirements.txt`), run (`uvicorn app.main:app --reload`), test (`pytest --cov=app`), and a pointer to `/docs` for the live OpenAPI reference (per the Units Generation decision — no separately maintained API-contract doc)

- [x] **Step 12 — Deployment Artifacts**
  - None beyond the run instructions in `backend/README.md` — Infrastructure Design was skipped for this unit (local SQLite, no infra to provision); no Dockerfile/IaC is in scope per requirements.md's deployment-model decision.

## Story Traceability Summary
| Story | Covered By Steps |
|---|---|
| CAT-1..4 | 2, 5, 6, 8, 9 |
| PROD-1..5 | 2, 5, 6, 8, 9 |
| STK-1, STK-2 | 2, 5, 6, 8, 9 |
| HIST-1 | 2, 5, 6, 8, 9 |
