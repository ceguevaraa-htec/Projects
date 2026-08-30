# Build Instructions — Warehouse Inventory System

## Prerequisites
- **Build Tool**: None required — a Python virtual environment + `pip`; the frontend is plain static files (no bundler/transpiler).
- **Python Version**: 3.12 (per `unit1-inventory-api/nfr-requirements/tech-stack-decisions.md`). This machine did not have it preinstalled; it was installed in user-space via [uv](https://astral.sh/uv) (no sudo needed):
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  uv python install 3.12
  ```
- **Dependencies**: listed in `backend/requirements.txt` (fastapi, uvicorn, sqlalchemy, pydantic, pytest, pytest-cov, hypothesis, httpx).
- **Environment Variables**: none required. `DATABASE_URL` is optional (defaults to `sqlite:///./inventory.db`; see `backend/app/db/session.py`).
- **System Requirements**: any machine that can run Python 3.12 and a modern browser. No specific memory/disk requirements beyond a typical dev machine (SQLite file grows with data volume, negligible at this project's scale).

## Build Steps

### 1. Install Dependencies
```bash
cd backend
uv venv --python 3.12 .venv   # or: python3.12 -m venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt   # or: pip install -r requirements.txt
```

### 2. Configure Environment
No configuration required for local use — the SQLite file is created automatically on first startup.

### 3. "Build" All Units
There is no compilation step. "Building" means:
- **Unit 1 (Inventory API)**: installing `backend/requirements.txt` (above) is sufficient — Python is interpreted, no bytecode artifacts to produce.
- **Unit 2 (Web UI)**: nothing to build — `frontend/` is served as-is (static HTML/CSS/JS), no bundler in this project's design (per Application Design's Web UI technology decision).

### 4. Verify Build Success
- **Expected Output**: `pip install`/`uv pip install` completes with no errors; `python -c "import app.main"` (from `backend/`, with `PYTHONPATH=.`) imports cleanly.
- **Build Artifacts**: a populated `backend/.venv/` (not committed — see `.gitignore`); no other artifacts.
- **Common Warnings**: none expected on Python 3.12. If you see `DeprecationWarning: on_event is deprecated`, that's stale — this project already uses the `lifespan` context manager (fixed during Unit 1 verification); re-check you're running the current `backend/app/main.py`.

## Troubleshooting

### Build Fails with Dependency Errors
- **Cause**: wrong Python version (< 3.10) — the codebase uses `X | None` PEP 604 syntax, which fails to import on Python 3.9 and earlier (`SQLAlchemy: Could not resolve all types within mapped annotation`).
- **Solution**: install Python 3.12 (see Prerequisites) and recreate the venv with it.

### Build Fails with "database is locked"
- **Cause**: unlikely at this project's scale (single local instance), but possible if two processes point at the same `inventory.db` under heavy concurrent write load.
- **Solution**: the engine is already configured with a 5-second busy-timeout (`backend/app/db/session.py`); if this still occurs, ensure only one server process is running against that database file.
