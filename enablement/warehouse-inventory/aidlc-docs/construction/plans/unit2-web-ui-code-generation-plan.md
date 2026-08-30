# Code Generation Plan — Unit 2: Web UI

**This plan is the single source of truth for Unit 2's Code Generation.** Application code is written under `frontend/` at the workspace root (`/Users/cesar.guevara/Projects/enablement/warehouse-inventory`), never under `aidlc-docs/`.

## Unit Context
- **Stories implemented**: UI-1, UI-2, UI-3, UI-4 (4 stories, per `unit-of-work-story-map.md`).
- **Dependencies**: Unit 1 (Inventory API) — REST contract per its OpenAPI schema and the delete-outcome amendment.
- **Design source documents**: `unit2-web-ui/functional-design/{business-logic-model,business-rules,domain-entities,frontend-components}.md`.
- **No backend of its own** — no NFR Requirements/Design/Infrastructure Design (skipped per execution plan).

## Steps

- [x] **Step 1 — Project Structure Setup (greenfield)**
  - Create `frontend/index.html`, `frontend/js/{api-client,categories,products,stock}.js`, `frontend/css/styles.css`

- [x] **Step 2 — API Client Generation** *(business-rules.md's error-mapping + confirmation rules)*
  - `frontend/js/api-client.js`: `ERROR_MESSAGES` lookup, a `request(method, path, body)` wrapper around `fetch` that parses JSON, throws a typed `ApiError {errorCode, message}` on non-2xx responses (translating via `ERROR_MESSAGES` with fallback to the raw `message`), and thin per-resource functions (`listCategories`, `createCategory`, `renameCategory`, `deleteCategory`, `listProducts`, `createProduct`, `updateProduct`, `deleteProduct`, `getProductHistory`, `adjustStock`)

- [x] **Step 3 — Categories Section Generation** *(UI-1 → CAT-1..4)*
  - `frontend/js/categories.js`: render category list with totals, create form, inline rename, delete with `window.confirm()` + outcome-specific messaging, inline error area

- [x] **Step 4 — Products Section Generation** *(UI-2, UI-4 → PROD-1..5)*
  - `frontend/js/products.js`: render product list (sort/filter controls re-querying the API), create/update forms (category `<select>` populated from `GET /categories`), delete with confirm + outcome messaging, inline error area

- [x] **Step 5 — Stock Adjustment & History Generation** *(UI-3, UI-4 → STK-1/2, HIST-1)*
  - `frontend/js/stock.js`: per-product adjust-stock form, history view (chronological table)

- [x] **Step 6 — Page Assembly**
  - `frontend/index.html`: header with section tabs, both sections' markup with `data-testid` attributes per `frontend-components.md`, script tags loading the 4 JS files
  - `frontend/css/styles.css`: minimal styling (no framework)

- [x] **Step 7 — Smoke Testing** *(no dedicated JS test framework, per NFR Requirements' original scope — this unit was never assigned NFR Requirements, so no new testing-framework decision is introduced here)*
  - Manual verification: boot Unit 1 (`uvicorn app.main:app`), open `frontend/index.html` through the backend's static mount (`http://localhost:8000/`), exercise each of the 4 stories' flows against the real API, confirm error/success messaging matches `business-logic-model.md`

- [x] **Step 8 — Documentation Generation**
  - `aidlc-docs/construction/unit2-web-ui/code/frontend-summary.md`: files created, story traceability, manual smoke-test results

## Story Traceability Summary
| Story | Covered By Steps |
|---|---|
| UI-1 | 2, 3, 6, 7 |
| UI-2 | 2, 4, 6, 7 |
| UI-3 | 2, 5, 6, 7 |
| UI-4 | 2, 4, 5, 6, 7 |
