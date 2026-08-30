# Frontend Summary — Unit 2: Web UI

## Files Created
- `frontend/index.html` — single page, JS-toggled Categories/Products sections, all `data-testid`-annotated interactive elements per `frontend-components.md`.
- `frontend/css/styles.css` — minimal, framework-free styling.
- `frontend/js/api-client.js` — centralized `fetch` wrapper, `ERROR_MESSAGES` lookup (9 codes mapped, generic fallback for anything else), per-resource functions for every Unit 1 endpoint.
- `frontend/js/categories.js` — UI-1 (CAT-1..4): create, inline rename, delete with confirm + outcome-specific messaging, category list with totals.
- `frontend/js/products.js` — UI-2 (PROD-1..3) plus the listing half of UI-4 (PROD-5): create **and update** (a dual-purpose form toggled by an "Edit" button — not explicitly spelled out as a single form in `business-logic-model.md`, but the simplest way to cover PROD-2 without a second form), delete with confirm + outcome messaging, sort/filter controls that re-query the API on every change, category picker kept in sync on category mutations.
- `frontend/js/stock.js` — UI-3 (STK-1/2) and the history half of UI-4 (HIST-1): stock adjustment form, chronological history view.

## Story Traceability
| Story | Implementation |
|---|---|
| UI-1 | `categories.js` + `#categories-section` in `index.html` |
| UI-2 | `products.js`'s create/edit form + delete handling |
| UI-3 | `stock.js`'s adjustment form |
| UI-4 | `products.js`'s filter bar/listing, `categories.js`'s totals column, `stock.js`'s history view |

## Manual Smoke Test Results (per the plan's Step 7 — no JS test framework was adopted, since Unit 2 never executed NFR Requirements)
- **Syntax check**: `node --check` on all 4 JS files — all pass.
- **Static serving**: booted Unit 1 (`uvicorn app.main:app`), confirmed `GET /` serves `index.html`, `GET /js/api-client.js` and `GET /css/styles.css` both return `200` with correct MIME types (`text/javascript`, `text/css`) — the backend's static mount for `frontend/` works as designed in Unit 1's NFR Design.
- **End-to-end API flow** (the exact sequence the UI drives): create category → create product in it → adjust stock (+5) → fetch history (shows the entry) → fetch category totals (correctly reflects 15) → delete the category (correctly returns `{"outcome": "soft_deleted"}` since it has a product) — all matched expected behavior exactly.

## Known Limitation
No automated browser-based UI test (e.g. Playwright/Puppeteer driving the actual DOM) was run — this wasn't in scope, since Unit 2 never went through NFR Requirements (which is where a JS testing-framework choice would have been made) per the approved execution plan. The `data-testid` attributes are in place specifically so such tests could be added later without relying on brittle selectors.
