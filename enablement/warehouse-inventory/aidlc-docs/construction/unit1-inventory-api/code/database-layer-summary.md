# Database Layer Summary — Unit 1: Inventory API

## Files
- `backend/app/db/base.py` — `Base` declarative class, `create_all(engine)` schema bootstrap (no migrations, per NFR Requirements).
- `backend/app/db/models.py` — `Category`, `Product`, `StockAdjustment` SQLAlchemy models, matching `domain-entities.md` field-by-field (integer PKs, `price_cents` as integer, `deleted_at`/`created_at` as ISO 8601 strings).
- `backend/app/db/session.py` — engine factory with `connect_args={"timeout": 5}` (SQLite busy-timeout, per NFR Design), `SessionLocal` sessionmaker, `get_session()` FastAPI dependency (commit on success, rollback on exception, always closes).
- `backend/tests/conftest.py` — shared `engine`/`session` pytest fixtures using an in-memory SQLite database with `StaticPool` (so all connections within one test share the same in-memory DB).
- `backend/tests/unit/test_models.py` — model construction, defaults, and relationship tests.

## Traceability
- FR1/FR2/FR3 (data model) ← `models.py`
- NFR1 (atomicity) ← `session.py`'s one-session-per-request lifecycle (session sharing is enforced at the service layer, see `business-logic-summary.md`)
- NFR4 (SQLite, local) ← `session.py`'s default `sqlite:///./inventory.db` URL
