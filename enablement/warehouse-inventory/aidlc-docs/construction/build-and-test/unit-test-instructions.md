# Unit Test Execution — Warehouse Inventory System

## Run Unit Tests

### 1. Execute All Unit Tests (Unit 1 — Inventory API)
```bash
cd backend
source .venv/bin/activate
export PYTHONPATH=.
pytest tests/unit --cov=app --cov-report=term-missing
```

### 2. Execute the Full Suite (Unit + Integration Together)
```bash
pytest --cov=app --cov-report=term-missing
```

### 3. Review Test Results
- **Actual result (verified this session)**: **64 passed, 0 failed, 0 warnings**.
- **Test Coverage (actual, verified)**: **94%** overall (target: ≥70%, per NFR2). Per-file detail:
  - 100%: `categories.py`, `currency.py`, `stock_adjustments.py`, `db/models.py`, `db/base.py`, `exceptions.py`, `services/category_service.py`, `services/product_service.py`, `services/stock_adjustment_service.py`, all `__init__.py` files
  - 89–98%: `error_handlers.py`, `products.py`, `schemas.py`, `components/*.py`, `main.py`
  - 61%: `db/session.py` (uncovered lines are the in-memory-SQLite special-case branch and module-level engine construction — exercised indirectly via fixtures, not directly asserted)
- **Test Report Location**: printed to terminal via `--cov-report=term-missing`; add `--cov-report=html` for a browsable report under `backend/htmlcov/`.

### 4. Unit 2 (Web UI) — No Automated Unit Tests
Unit 2 never executed NFR Requirements (skipped per the execution plan, since it has no server-side logic of its own), so no JS testing framework was ever selected. Verification instead consisted of:
```bash
cd frontend
node --check js/api-client.js js/categories.js js/products.js js/stock.js
```
All 4 files pass (verified this session). See `integration-test-instructions.md` for how the frontend's actual behavior was verified against the live backend.

### 5. Fix Failing Tests
If tests fail:
1. Review the pytest output — each failure shows the assertion and traceback.
2. Cross-reference the failing test's docstring/name against `unit1-inventory-api/functional-design/business-rules.md` to confirm which business rule it's protecting.
3. Fix the application code (not the test) unless the test itself has a bug (this happened once during this session — see `audit.md`'s "Unit 1 Code Generation - Complete" entry for the 4 test-authoring bugs found and fixed).
4. Re-run until green.
