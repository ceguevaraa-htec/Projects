# Application Design Plan — Warehouse Inventory System

## Execution Checklist

- [x] Step A: Finalize component boundaries — **one component per domain** (Category, Product, StockAdjustment) + shared Database component (Q1: A)
- [x] Step B: Finalize service-layer pattern — **each domain component exposes its own service**, calling other components directly as needed, no separate orchestration layer (Q2: A)
- [x] Step C: Finalize error-handling architecture — **custom exception hierarchy + single global exception handler** at the API framework level (Q3: A)
- [x] Step D: Finalize API layer organization — **one router per domain** (Q4: A)
- [x] Step E: Finalize Web UI structure — **single-page static app** with a shared `api-client.js` centralizing error-message translation (Q5: A)
- [x] Step F: Generate `components.md` (component definitions, responsibilities, interfaces)
- [x] Step G: Generate `component-methods.md` (method signatures, purpose, I/O types — no detailed business rules yet)
- [x] Step H: Generate `services.md` (service definitions, responsibilities, orchestration)
- [x] Step I: Generate `component-dependency.md` (dependency matrix, communication patterns, data flow)
- [x] Step J: Generate consolidated `application-design.md`
- [x] Step K: Validate design completeness and consistency against requirements.md and stories.md

## Context Analyzed
From `requirements.md` and `stories.md`: three core domains (Category, Product, Stock Adjustment/History), a REST API surface with global error handling, a SQLite persistence layer, and a full-CRUD web UI. Business-rule *detail* (exact validation sequencing, transaction boundaries) is deferred to Functional Design; this stage only identifies components, their responsibilities, and how they talk to each other.

## Clarifying Questions

### Question 1: Component Boundaries
How should the backend be split into components?

A) One component per domain — `CategoryComponent`, `ProductComponent`, `StockAdjustmentComponent` — each owning its own persistence access and business rules, plus a shared `Database` component (recommended — matches the domain boundaries already established in requirements/stories, keeps each component small and testable)

B) A single `InventoryComponent` handling categories, products, and stock adjustments together, plus a shared `Database` component (simpler wiring, but larger/less isolated component)

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2: Service-Layer Pattern
How should orchestration across components be handled (e.g. "deleting a category" needs to check products; "creating a product" needs to check the category exists and isn't soft-deleted)?

A) Each domain component exposes its own service with orchestration methods that call into other components directly as needed (e.g. `ProductService.create()` calls `CategoryComponent.get_active()` internally) — no separate orchestration layer (recommended for this system's size — avoids an extra layer for what is still a small, single-process app)

B) A single top-level `InventoryOrchestrationService` sits above all domain components and is the only entry point the API layer calls, coordinating cross-domain checks itself

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3: Error-Handling Architecture
How should the "global error catching with appropriate error logging" NFR be structured?

A) A custom domain-exception hierarchy (e.g. `NotFoundError`, `ValidationError`, `ConflictError`, `InvariantViolationError`) raised by components/services, caught by a single global exception handler at the API framework level that maps each exception type to an HTTP status + structured error body and logs it (recommended — keeps business logic free of HTTP concerns, centralizes logging/formatting)

B) Each API route handles its own try/except and formats its own error response; a catch-all middleware only handles truly unexpected exceptions

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4: API Layer Organization
How should REST endpoints be organized?

A) One router/module per domain — `categories` router, `products` router, `stock-adjustments` router — mounted under a common API prefix (recommended — mirrors the component boundaries from Question 1, easy to navigate)

B) A single flat router file containing all endpoints

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5: Web UI Structure
How should the full-CRUD web UI be structured, given it needs deliberate design (per your Workflow Planning decision) for delete/soft-delete flows, destructive-action confirmation, and surfacing the 3 API-level rejection cases as clear messages?

A) A single-page static app (`index.html` + a few JS modules: `api-client.js`, `categories.js`, `products.js`, `stock.js`) with client-side view-switching (no page reloads), all calling the same `api-client.js` wrapper around `fetch` so error-message translation (raw API error → user-facing message) happens in one place (recommended — keeps error-surfacing logic centralized per NFR intent)

B) Multiple static HTML pages (e.g. `categories.html`, `products.html`), each with its own inline script, navigated via normal links

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

**Note**: After you answer, I will analyze responses for ambiguity, ask follow-ups if needed, and then generate the application design artifacts (components.md, component-methods.md, services.md, component-dependency.md, application-design.md).
