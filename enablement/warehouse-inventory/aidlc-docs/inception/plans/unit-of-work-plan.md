# Unit of Work Plan — Warehouse Inventory System

## Execution Checklist
- [x] Step A: Confirm unit decomposition and boundaries — **Unit 1 (Inventory API) / Unit 2 (Web UI)**, sequential dependency (Q1: A)
- [x] Step B: Confirm greenfield code organization / directory structure — **`backend/` and `frontend/` top-level directories** (Q2: A)
- [x] Step C: Confirm API-contract sharing approach between units — **FastAPI auto-generated OpenAPI schema** as source of truth (Q3: A)
- [x] Step D: Confirm test organization per unit — **per-unit `tests/` with unit + integration split for backend, smoke-test pass for frontend** (Q4: A)
- [x] Step E: Generate `unit-of-work.md` (unit definitions, responsibilities, code organization)
- [x] Step F: Generate `unit-of-work-dependency.md` (dependency matrix)
- [x] Step G: Generate `unit-of-work-story-map.md` (story → unit mapping, all 16 stories assigned)
- [x] Step H: Validate unit boundaries and dependencies against application-design.md
- [x] Step I: Confirm every story in stories.md is assigned to a unit (12 + 4 = 16, 0 unassigned)

## Category Coverage Notes
- **Team Alignment**: Not applicable — single-developer/agent implementation, no team-ownership boundaries to negotiate. No question asked for this category.
- **Business Domain**: Already settled in Application Design (Category/Product/StockAdjustment domains map to backend components) — reflected in Question 1 rather than a separate question, to avoid re-litigating an already-approved decision.

## Clarifying Questions

### Question 1: Unit Decomposition and Boundaries
Workflow Planning and Application Design already converged on a 2-unit split. Confirming before generating formal unit artifacts:

A) **Unit 1 — Inventory API**: Database, CategoryComponent, ProductComponent, StockAdjustmentComponent, their Services, and the API Layer (routers + global exception handler). **Unit 2 — Web UI**: the static single-page app (`index.html`, `api-client.js`, `categories.js`, `products.js`, `stock.js`). Sequential dependency: Unit 2 depends on Unit 1's REST contract. (recommended — matches the boundary already used throughout Application Design and the approved execution plan)

B) A different split — please describe after [Answer]: tag below

[Answer]: A

### Question 2: Greenfield Code Organization
How should the repository be laid out at the workspace root?

A) Two top-level directories — `backend/` (Python package: `app/` with `components/`, `services/`, `api/`, `db/`, `tests/`) and `frontend/` (static files: `index.html`, `js/`) — clearly separating the two units on disk (recommended — mirrors the unit boundary directly, easy to navigate)

B) A single top-level `app/` Python package that also serves the frontend's static files from a `static/` subfolder (more conventional for a single-process Flask/FastAPI app that serves its own UI)

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3: API-Contract Sharing Between Units
How should Unit 2 (Web UI) know Unit 1's exact request/response shapes during implementation?

A) Rely on the framework's auto-generated OpenAPI schema (FastAPI's built-in `/openapi.json` + `/docs`) as the source of truth; Unit 2 is implemented against the endpoint list and error-body shape documented in Unit 1's Functional Design (recommended — no extra artifact to maintain, FastAPI generates this for free)

B) Maintain a separate hand-written `api-contract.md` describing every endpoint, independent of framework tooling

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4: Test Organization Per Unit
How should tests be organized to support the ≥70% coverage NFR?

A) Per-unit `tests/` directory (`backend/tests/unit/`, `backend/tests/integration/`) with unit tests targeting components/services in isolation (mocked DB or in-memory SQLite) and integration tests hitting the real API + a temp SQLite file; Unit 2 gets a lighter smoke-test pass (no full test framework needed for static JS) (recommended)

B) A single top-level `tests/` directory covering both units without per-unit separation

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

**Note**: After you answer, I will analyze responses for ambiguity, ask follow-ups if needed, request approval, and then generate `unit-of-work.md`, `unit-of-work-dependency.md`, and `unit-of-work-story-map.md`.
