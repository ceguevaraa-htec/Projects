# Warehouse Inventory API (Unit 1)

A Python/FastAPI + SQLite REST API for managing categories, products, and stock adjustments.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run

Run from inside `backend/` (where Setup left you, with `.venv` activated):

```bash
uvicorn app.main:app --reload
```

The API is served at `http://localhost:8000`. A SQLite file `inventory.db` is created automatically on first startup (no migrations — schema is created from the SQLAlchemy models).

- Interactive API docs (Swagger UI): `http://localhost:8000/docs`
- Raw OpenAPI schema: `http://localhost:8000/openapi.json`

This is the live source of truth for the API contract — there is no separately maintained API-contract document (per the Units Generation decision).

## Test

```bash
cd backend
pytest --cov=app --cov-report=term-missing
```

Targets ≥70% coverage (NFR2). Unit tests (`tests/unit/`) use an in-memory SQLite database; integration tests (`tests/integration/`) exercise the full FastAPI app against a temporary on-disk SQLite file.

## Project Structure
```
backend/
├── app/
│   ├── db/            # SQLAlchemy engine/session, models, schema bootstrap
│   ├── components/     # CategoryComponent, ProductComponent, StockAdjustmentComponent
│   ├── services/       # CategoryService, ProductService, StockAdjustmentService
│   ├── api/            # Pydantic schemas, per-domain routers, global exception handlers
│   ├── exceptions.py    # Domain exception hierarchy
│   └── main.py          # App entrypoint
└── tests/
    ├── unit/           # Component/service/schema tests (in-memory SQLite)
    └── integration/     # Full-API tests (temp on-disk SQLite file)
```
