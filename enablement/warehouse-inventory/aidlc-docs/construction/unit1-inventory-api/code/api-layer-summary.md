# API Layer Summary — Unit 1: Inventory API

## Files
- `backend/app/api/currency.py` — `dollars_to_cents()` / `cents_to_dollars()`, the sole currency-conversion boundary.
- `backend/app/api/schemas.py` — Pydantic request/response models. `ProductUpdateRequest` uses `extra="forbid"` so a `quantity`/`stock` field in the request body is rejected (HTTP 422) at the parsing boundary — the earliest point such a request can be rejected, ahead of `ProductService.update_product`'s own defense-in-depth check.
- `backend/app/api/categories.py`, `products.py`, `stock_adjustments.py` — per-domain routers, one per Application Design's router decision. Every check-then-write route declares `session: Session = Depends(get_session)` and passes it as the service call's first argument, completing the session-threading chain documented in `business-logic-summary.md`.
- `backend/app/api/error_handlers.py` — `register_exception_handlers(app)`, mapping the 4 domain exceptions to their HTTP status (404/400/409/422) plus a catch-all 500 handler; every path logs via `logging.getLogger(__name__)`.
- `backend/app/main.py` — app assembly: logging bootstrap, router mounting, exception-handler registration, `create_all()` on startup, static mount for `frontend/` (Unit 2).

## Known Deviation (documented, not accidental)
`ProductUpdateRequest`'s `extra="forbid"` rejection of a stray `quantity` field returns FastAPI/Pydantic's default validation-error body shape (HTTP 422, `{"detail": [...]}, `) rather than this project's `{"error_code", "message"}` shape — because Pydantic's own request-parsing validation happens before any application code (including the global domain-exception handlers) runs. `ProductService.update_product` still independently raises the project's own `ValidationError("VALIDATION_ERROR", ...)` for the same case, for any caller that reaches the service layer directly (e.g. future non-HTTP callers); the HTTP-level rejection is simply reached first and is judged intentional and acceptable for the project's demo/local scope, not a gap to fix.

## Test Coverage
- `backend/tests/unit/test_schemas.py` — schema construction, cents↔decimal conversion, one property-based JSON round-trip test.
- `backend/tests/integration/{conftest,test_categories_api,test_products_api,test_stock_adjustments_api}.py` — full `TestClient` requests against a temporary on-disk SQLite file, covering the success path and every documented error case (404/400/409/422) for each of the 12 assigned stories.

## Traceability
All 12 of Unit 1's assigned stories (CAT-1..4, PROD-1..5, STK-1..2, HIST-1) have at least one integration test exercising their corresponding endpoint(s), in addition to the unit-level service tests from `business-logic-summary.md`.

## ✅ Verified (Python 3.12, via `uv`)
This machine originally only had Python 3.9.6 (incompatible with the code's `X | None` PEP 604 syntax, required by the approved 3.12 NFR decision). At the user's request, Python 3.12.14 was installed in user-space via `uv` (no sudo required: `curl -LsSf https://astral.sh/uv/install.sh | sh` then `uv python install 3.12`), and a `.venv` was created with it.

**Full verification performed and passing**:
- `pytest --cov=app --cov-report=term-missing`: **64 passed, 0 warnings, 94% coverage** (well above the 70% NFR2 target).
- Two real bugs were found and fixed by this verification (not just theoretical review):
  1. `DELETE` routes with `status_code=204` needed an explicit `response_model=None` — FastAPI's return-type-inferred response model conflicted with the "204 must have no body" rule.
  2. `main.py` used the deprecated `@app.on_event("startup")`; replaced with a `lifespan` async context manager.
- 4 initially-failing tests were test-authoring bugs (asserting an id changed after a SQLite rowid could legitimately be reused, and two tests that accidentally exercised hard-delete instead of soft-delete) — fixed in the test files, not the application code.
- Live smoke test: booted `uvicorn app.main:app`, confirmed `/openapi.json` lists all 5 expected route groups, and a real `POST /categories` + `GET /categories` round-trip returned the expected JSON.

Coverage detail (94% overall): `app/db/session.py` at 61% (the uncovered lines are the in-memory-SQLite special-case branch and module-level engine construction, both exercised indirectly via fixtures rather than directly asserted); every other file is 86–100%.

## Post-Generation Amendment (from Unit 2 Functional Design)
Unit 2's Functional Design identified that `DELETE /categories/{id}` and `DELETE /products/{id}` returning `204 No Content` gave the Web UI no way to distinguish a hard-delete from a soft-delete outcome — needed for CAT-3/PROD-3's distinct-UX requirement. Both endpoints were changed to return **`200 OK`** with `{"outcome": "hard_deleted" | "soft_deleted"}` (new `DeleteOutcomeResponse` schema). The corresponding integration test assertions were updated to check the new body; the full suite was re-run and still passes: **64 passed, 94% coverage** (unchanged, since this only changed the delete endpoints' response shape, not their logic).
