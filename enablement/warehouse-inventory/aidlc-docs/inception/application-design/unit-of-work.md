# Units of Work — Warehouse Inventory System

**Terminology**: This is a monolith-style greenfield build decomposed into two logical **Units of Work** for sequential implementation — neither is an independently deployable microservice; "Unit" here means a development/design grouping, consistent with `core-workflow.md`'s per-unit Construction loop.

## Unit 1 — Inventory API

- **Responsibility**: The entire backend — persistence, domain business rules, and the REST API surface. Owns: `Database`, `CategoryComponent`, `ProductComponent`, `StockAdjustmentComponent`, `CategoryService`, `ProductService`, `StockAdjustmentService`, and the API Layer (per-domain routers + global exception handler).
- **Maps to Application Design**: All backend components/services from `components.md`/`services.md`.
- **Maps to Requirements**: FR1 (Category Management), FR2 (Product Management), FR3 (Stock Adjustments), plus NFR1 (Data Integrity), NFR2 (Testability), NFR3 (Reliability/Error Handling), NFR4 (Persistence).
- **Construction stages**: Functional Design (EXECUTE), NFR Requirements (EXECUTE), NFR Design (EXECUTE), Infrastructure Design (SKIP), Code Generation (EXECUTE) — per `execution-plan.md`.

## Unit 2 — Web UI

- **Responsibility**: The full-CRUD static browser interface consuming Unit 1's REST API. Owns: `index.html`, `api-client.js`, `categories.js`, `products.js`, `stock.js`.
- **Maps to Application Design**: The Web UI Component from `components.md`.
- **Maps to Requirements**: FR4 (Web UI).
- **Construction stages**: Functional Design (EXECUTE — delete/soft-delete UX, destructive-action confirmation, surfacing the 3 API-level rejection cases), NFR Requirements (SKIP), NFR Design (SKIP), Infrastructure Design (SKIP), Code Generation (EXECUTE) — per `execution-plan.md`.

## Code Organization Strategy (Greenfield — Q2: A)

```
warehouse-inventory/                  # workspace root — application code lives here
├── backend/                          # Unit 1 — Inventory API
│   ├── app/
│   │   ├── db/                       # Database component: connection/session, schema
│   │   ├── components/               # CategoryComponent, ProductComponent, StockAdjustmentComponent
│   │   ├── services/                 # CategoryService, ProductService, StockAdjustmentService
│   │   ├── api/                      # routers: categories, products, stock-adjustments + exception handler
│   │   └── main.py                   # app entrypoint (FastAPI instance, router mounting, exception handler registration)
│   └── tests/
│       ├── unit/                     # component/service tests, mocked or in-memory DB
│       └── integration/              # real API + temp SQLite file
├── frontend/                         # Unit 2 — Web UI
│   ├── index.html
│   └── js/
│       ├── api-client.js
│       ├── categories.js
│       ├── products.js
│       └── stock.js
├── aidlc-docs/                       # AI-DLC documentation only (this file's directory tree)
└── requirements.txt / pyproject.toml # backend dependencies (finalized in NFR Requirements)
```

- The backend serves `frontend/` as static files (per requirements.md's "served as static files by the backend") — the two top-level directories are a source-organization choice, not a deployment-topology one; there is still a single running process.
- Unit boundary is enforced by directory, not by a build step — no bundler/transpiler needed for the vanilla-JS frontend.
