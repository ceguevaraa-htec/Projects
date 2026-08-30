# Functional Design Plan — Unit 1: Inventory API

## Execution Checklist
- [x] Step A: Finalize domain entity field types and identifiers — **integer auto-increment IDs; price stored internally as `price_cents` (int), converted at the API boundary via single-purpose `cents_to_dollars()`/`dollars_to_cents()` functions; ISO 8601 UTC timestamp strings** (Q1: A, refined)
- [x] Step B: Finalize stock-adjustment endpoint shape — **single endpoint, signed `delta`** (Q2: A)
- [x] Step C: Finalize category-rename self-conflict handling — **uniqueness check excludes the category's own row** (Q3: A)
- [x] Step D: Finalize listing defaults (sort/pagination) — **no pagination, default sort by name ascending, for products/categories AND explicitly for stock-adjustment history** (Q4: A, extended)
- [x] Step E: Finalize error-response body schema — **`{"error_code": ..., "message": ...}`** (Q5: A)
- [x] Step F: Finalize transaction-boundary granularity — **whole service method in one transaction; session/transaction object explicitly shared/passed across component calls within that method, never reopened per call** (Q6: A, refined)
- [x] Step G: Generate `business-logic-model.md`
- [x] Step H: Generate `business-rules.md`
- [x] Step I: Generate `domain-entities.md`
- [x] Step J: Validate against unit-of-work-story-map.md's 12 assigned stories (all covered)

## Context Analyzed
Unit 1 owns all backend business logic (Category, Product, StockAdjustment domains) per `unit-of-work.md`, implementing 12 stories (CAT-1..4, PROD-1..5, STK-1..2, HIST-1). Application Design already fixed component/service boundaries, the exception-hierarchy approach, and per-domain routers — this stage adds the *detailed* business logic those already-named pieces will contain. No frontend component in this unit.

## Clarifying Questions

### Question 1: Domain Entity Field Types and Identifiers
What types should back the domain entities?

A) Integer auto-increment primary keys for all entities; `price` stored as an integer number of cents (avoids floating-point rounding on currency); `deleted_at`/`created_at` as ISO 8601 UTC timestamp strings (recommended — simplest for SQLite, avoids float-currency bugs, and ISO 8601 strings sort/compare correctly and serialize cleanly to JSON)

B) Integer auto-increment primary keys; `price` as a floating-point number (simpler API surface, but risks rounding errors on currency)

C) UUID primary keys for all entities; other fields as in A

D) Other (please describe after [Answer]: tag below)

[Answer]: ⚠️ NOT YET ANSWERED — please fill in before I proceed to generation.

### Question 2: Stock-Adjustment Endpoint Shape
FR3.1 says "increase or decrease... via a dedicated stock-adjustment operation." Should this be:

A) A single endpoint accepting a signed integer `delta` (positive = increase, negative = decrease) — one code path validates the resulting balance ≥ 0 regardless of direction (recommended — one validation path, fewer endpoints, matches "dedicated stock-adjustment operation" as singular)

B) Two separate endpoints — `increase` (positive amount only) and `decrease` (positive amount only, subtracted internally) — clearer intent per-call, but two code paths to keep in sync

C) Other (please describe after [Answer]: tag below)

[Answer]:

### Question 3: Category Rename Self-Conflict
FR1.1 enforces category-name uniqueness across all rows. When renaming a category to the *same* name it already has (a no-op rename), should this:

A) Succeed silently (the uniqueness check excludes the category's own current row) (recommended — a rename request from a UI form that re-submits the unchanged name shouldn't error)

B) Be rejected as a "name already in use" conflict, same as any other duplicate

C) Other (please describe after [Answer]: tag below)

[Answer]:

### Question 4: Listing Defaults (Sort & Pagination)
For `GET /products` (FR2.5) and `GET /categories` (FR1.4):

A) No pagination — return the full result set every time; default sort is by `name` ascending when no sort parameter is given (recommended — matches the "local/demo, low data volume" deployment model from requirements.md; pagination would be unused complexity at this scale)

B) Paginated (e.g. `limit`/`offset` query params), default sort by `name` ascending

C) Other (please describe after [Answer]: tag below)

[Answer]:

### Question 5: Error-Response Body Schema
What exact JSON shape should the global exception handler produce (NFR3)?

A) `{"error_code": "<SCREAMING_SNAKE_CASE>", "message": "<human-readable>"}` — e.g. `{"error_code": "STOCK_WOULD_GO_NEGATIVE", "message": "Cannot decrease stock below zero."}` (recommended — machine-parseable code for the UI's error-translation logic, plus a human string for logs/fallback display)

B) Just `{"detail": "<human-readable>"}` (FastAPI's default convention, simpler but no machine-parseable code for the UI to branch on)

C) Other (please describe after [Answer]: tag below)

[Answer]:

### Question 6: Transaction Boundary Granularity
NFR1 requires the stock-update + history-write to be atomic, and delete-eligibility checks to be atomic with the delete. Should each *entire service method* (e.g. `adjust_stock`, `delete_category`) run inside one SQLite transaction, or only the specific write pair?

A) Each service method that performs a check-then-write runs its full body inside a single SQLite transaction (recommended — SQLite transactions are cheap locally; this is the simplest way to guarantee NFR1 without hand-tracking which specific statements need pairing)

B) Only the specific write pairs (stock update + history insert; delete-eligibility count + delete) are wrapped in transactions, with reads outside

C) Other (please describe after [Answer]: tag below)

[Answer]:

---

**Note**: After you answer, I will analyze responses for ambiguity, ask follow-ups if needed, and then generate `business-logic-model.md`, `business-rules.md`, and `domain-entities.md`.
