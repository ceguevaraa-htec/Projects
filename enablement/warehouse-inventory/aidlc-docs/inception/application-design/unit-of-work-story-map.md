# Unit of Work Story Map — Warehouse Inventory System

All 16 stories from `stories.md` are assigned below — none unassigned.

## Unit 1 — Inventory API (12 stories)

| Story | Epic |
|---|---|
| CAT-1: Create a Category | Category Management |
| CAT-2: Rename a Category | Category Management |
| CAT-3: Delete a Category | Category Management |
| CAT-4: View Category Listing with Stock Totals | Category Management |
| PROD-1: Create a Product | Product Management |
| PROD-2: Update Product Details | Product Management |
| PROD-3: Delete a Product | Product Management |
| PROD-4: View Product Detail | Product Management |
| PROD-5: Sort and Filter Product Listing | Product Management |
| STK-1: Increase Stock | Stock Adjustments |
| STK-2: Decrease Stock | Stock Adjustments |
| HIST-1: View Stock Adjustment History for a Product | History / Audit Trail |

*Each of these stories is implemented as REST endpoint(s) exposed by the corresponding router, backed by the matching Service and Component(s) — see `application-design.md`'s traceability table for the FR→component mapping.*

## Unit 2 — Web UI (4 stories)

| Story | Epic |
|---|---|
| UI-1: Manage Categories via the Web UI | Web UI |
| UI-2: Manage Products via the Web UI | Web UI |
| UI-3: Adjust Stock via the Web UI | Web UI |
| UI-4: View Listings, Category Totals, and History via the Web UI | Web UI |

*Each UI story is a thin consumer of the corresponding Unit 1 capability (UI-1 → CAT-1/2/3, UI-2 → PROD-1/2/3, UI-3 → STK-1/2, UI-4 → PROD-5/CAT-4/HIST-1) — see `stories.md` for the explicit cross-references already documented in each UI story's acceptance criteria.*

## Coverage Check
- Total stories in `stories.md`: 16
- Assigned to Unit 1: 12
- Assigned to Unit 2: 4
- Unassigned: 0 ✅
