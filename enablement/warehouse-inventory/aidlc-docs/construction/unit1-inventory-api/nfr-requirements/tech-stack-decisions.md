# Tech Stack Decisions — Unit 1: Inventory API

| Decision | Choice | Rationale |
|---|---|---|
| Web framework | **FastAPI** | Finalizes the assumption already used in `unit-of-work-dependency.md` (auto-generated OpenAPI schema as the API contract Unit 2 codes against); Pydantic-based request/response validation; clean global-exception-handler registration matching the exception hierarchy from Functional Design. |
| Persistence / ORM | **SQLAlchemy** (ORM) | Provides an explicit `Session` object matching the shared-session/transaction requirement from `business-rules.md`; supports an in-memory SQLite engine for fast, isolated unit tests; schema generated from Python model classes. |
| Database | **SQLite** (via SQLAlchemy) | Per requirements.md's technical hint — lightweight, local, no external DB server. |
| Testing framework | **pytest** + **pytest-cov** | Standard, fixture-friendly stack; `pytest-cov` reports against the ≥70% coverage NFR (NFR2) directly. |
| Property-based testing | **Hypothesis** (used partially, per Requirements Analysis decision) | Applied to `dollars_to_cents()`/`cents_to_dollars()` round-trips and Pydantic schema (de)serialization only — not the full business-logic surface. |
| Logging | Standard-library **`logging`**, plain formatter, `stdout` | Sufficient for a local/demo tool with no log-aggregation infrastructure; captures timestamp, exception type/message, and request context on every caught error. |
| Dependency management | **`requirements.txt`** + **`venv`** | Lowest-friction setup appropriate to project scope; no lockfile tooling overhead. |
| Python version | **3.12** | Current stable, no legacy-compatibility constraint in scope. |
| Schema management | **Create-on-startup** (`Base.metadata.create_all()`) | Greenfield app, no prior schema version to migrate from — a migration framework (Alembic) would solve a problem this project doesn't yet have. |
| ASGI server (for running FastAPI) | **uvicorn** | Standard, minimal-config ASGI server paired with FastAPI for local execution. |

## Key Libraries (requirements.txt, indicative)
```
fastapi
uvicorn
sqlalchemy
pydantic
pytest
pytest-cov
hypothesis
```
Exact pinned versions to be finalized during Code Generation.
