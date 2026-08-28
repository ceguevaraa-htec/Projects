# Personas — Warehouse Inventory System

## Persona 1: Retail Store Clerk

- **Role**: Front-of-store staff responsible for keeping a single retail location's shelves stocked and accurately priced.
- **Characteristics**: Interacts with the system briefly, multiple times a day, often between serving customers. Prefers quick, obvious actions over deep navigation. Primarily cares about a single store's worth of products.
- **Motivations**:
  - Quickly look up a product's price and code (e.g. at a register, or when a customer asks).
  - Adjust stock immediately after a sale, a return, or finding damaged/expired stock.
  - See at a glance which categories are running low so they can flag a reorder.
  - Trust that the system won't let stock go negative if they misclick or double-enter a decrease.
- **Pain Points This System Addresses**: Manual stock counts going out of sync with reality; no record of *why* a number changed; accidentally overselling stock that isn't actually there.

## Persona 2: Warehouse Stock Handler

- **Role**: Warehouse-side staff managing a larger, multi-category catalog across incoming shipments and outgoing distribution to stores.
- **Characteristics**: Interacts with the system in longer sessions (e.g. processing a shipment manifest), manages more products and categories at once, more likely to reorganize categories or retire discontinued product lines.
- **Motivations**:
  - Set up and maintain the category structure (e.g. adding a new category for a new product line, retiring an old one).
  - Bulk-adjust stock after receiving a shipment (many increases) or after fulfilling store orders (many decreases).
  - Investigate discrepancies by reviewing the full adjustment history for a product.
  - Clean up discontinued products/categories without breaking historical records for products that already have transaction history.
- **Pain Points This System Addresses**: No way to safely retire a category/product that still has real history without losing that history; no consolidated view of total stock per category across a large catalog.

## Shared Context
- Both personas operate within the **same trusted, single-user-class environment** — no login/roles are required (per NFR: no authentication in scope), so both personas have identical permissions and see the same system behavior. The distinction here is purely about *usage context and motivation*, not access level.
- Both personas use the same web UI and REST API — there is no persona-specific interface.
