# Integration Test Instructions — Warehouse Inventory System

## Purpose
Test interactions between Unit 1 (Inventory API) and Unit 2 (Web UI), and between the API and its SQLite persistence layer, to ensure they work together correctly.

## Test Scenarios

### Scenario 1: Unit 1 API ↔ SQLite Persistence
- **Description**: Full-stack API tests (not mocked) against a real, temporary SQLite file — confirms the FastAPI routes, service/component layer, and SQLAlchemy models all integrate correctly.
- **Setup**: none — `backend/tests/integration/conftest.py`'s `client` fixture creates a fresh temp-file SQLite DB per test automatically.
- **Test Steps**: `pytest tests/integration` (see `unit-test-instructions.md` for the full command).
- **Expected Results**: all category/product/stock-adjustment endpoints return correct status codes and bodies for both success and every documented error case. **Actual result (verified)**: all integration tests pass as part of the 64-test, 94%-coverage suite.
- **Cleanup**: automatic — `tmp_path` (pytest's built-in temp-directory fixture) is removed after each test.

### Scenario 2: Unit 2 Web UI ↔ Unit 1 API (the actual cross-unit integration)
- **Description**: Confirms the frontend's static assets are served correctly by the backend, and that the exact request/response sequence the UI's JS drives produces the expected results end-to-end.
- **Setup**: boot the real server (not a test double):
  ```bash
  cd backend
  source .venv/bin/activate
  uvicorn app.main:app --reload
  ```
- **Test Steps (verified this session, via curl standing in for the browser)**:
  1. `GET /` → confirm `index.html` is served (`200`, HTML body).
  2. `GET /js/api-client.js` → confirm `200`, `content-type: text/javascript`.
  3. `GET /css/styles.css` → confirm `200`, `content-type: text/css`.
  4. `POST /categories {"name": "Beverages"}` → `201`, category created.
  5. `POST /products {...category_id from step 4...}` → `201`, product created.
  6. `POST /products/{id}/stock-adjustments {"delta": 5}` → `201`, `resulting_balance` reflects the increase.
  7. `GET /products/{id}/stock-adjustments` → history shows the one entry from step 6.
  8. `GET /categories` → `total_stock` for the category reflects the product's current quantity.
  9. `DELETE /categories/{id}` → `200`, `{"outcome": "soft_deleted"}` (since it has a product) — confirms the delete-outcome contract Unit 2's UI relies on to show the correct message.
- **Expected Results**: every step above matched exactly (see `aidlc-docs/audit.md`'s Unit 2 Code Generation entry for the full transcript).
- **Cleanup**: stop the `uvicorn` process; delete the local `inventory.db` file if a clean slate is wanted for the next run.

### Scenario 3: Manual Browser Walkthrough (Recommended Before Sign-Off, Not Yet Performed)
Since no automated browser test exists (see `unit-test-instructions.md`'s note on Unit 2), a human should still open `http://localhost:8000/` in an actual browser and click through each of the 4 UI stories (create/rename/delete a category, create/edit/delete a product, adjust stock, view history) at least once before considering the system fully sign-off-ready. This was not performed in this session — the curl-based Scenario 2 above verifies the API contract the UI depends on, but not the DOM rendering/event-wiring itself.

## Setup Integration Test Environment
### 1. Start Required Services
```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload
```
No other services required — SQLite is file-based, no separate DB server to start.

### 2. Configure Service Endpoints
None needed for local use — the frontend calls relative paths (`/categories`, `/products`, ...), served from the same origin as the API (per Unit 2's Application Design decision), so there's no CORS configuration or base-URL environment variable to set.

## Run Integration Tests
```bash
cd backend && pytest tests/integration --cov=app --cov-report=term-missing
```

## Cleanup
```bash
rm -f backend/inventory.db   # if you want a clean slate
```
