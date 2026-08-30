# Logical Components (NFR Design) — Unit 1: Inventory API

These are infrastructure-adjacent logical components that sit alongside the domain components from Application Design, realizing the NFR patterns above. None of these represent new business capability — they are the technical scaffolding the domain components run inside.

## 1. Session Provider (`app/db/session.py`)
- **Responsibility**: Own the SQLAlchemy `engine` (SQLite, with the busy-timeout `connect_args`) and expose `get_session()`, a FastAPI dependency yielding one `Session` per request and closing it afterward (commit on success, rollback on unhandled exception, per FastAPI's dependency-teardown behavior).
- **Used by**: Every API router, via `Depends(get_session)`.

## 2. Schema Bootstrapper (`app/db/schema.py` or inline in `main.py` startup)
- **Responsibility**: Call `Base.metadata.create_all(engine)` once at application startup, creating the `categories`, `products`, and `stock_adjustments` tables if they don't already exist. No migration framework (per NFR Requirements decision).

## 3. Logging Bootstrapper (`main.py`, startup)
- **Responsibility**: One `logging.basicConfig(...)` call configuring format/level/stream for the whole process, executed before the FastAPI app starts serving requests.

## 4. Global Exception Handler (`app/api/error_handlers.py`)
- **Responsibility**: Registered on the FastAPI app instance via `@app.exception_handler(...)` for each of the four domain exception types plus a catch-all `Exception` handler. Each handler: (a) logs the error via the calling module's logger context (using `logging.getLogger(__name__)` inside the handler itself, tagged as `app.api.error_handlers`), (b) maps the exception to the appropriate HTTP status + `{"error_code", "message"}` body per `business-rules.md`'s table.
- **Used by**: Implicitly wraps every router — FastAPI dispatches any exception raised during request handling to the matching registered handler.

## 5. Currency Conversion Utility (`app/api/currency.py` or similar)
- **Responsibility**: The two single-purpose functions `dollars_to_cents()` / `cents_to_dollars()` from Functional Design's currency conversion boundary. Logically sits in the API layer (Pydantic schema layer), since that's the only place a decimal dollar amount is seen — components and services only ever handle `price_cents` as an integer.

## Component Placement Relative to Application Design
None of the above are new *domain* components — `components.md`'s `CategoryComponent`/`ProductComponent`/`StockAdjustmentComponent`/services are unchanged. These are cross-cutting technical elements that the API layer and Database component (from Application Design) are realized through, specific to the FastAPI + SQLAlchemy + SQLite stack chosen in NFR Requirements.
