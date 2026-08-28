# User Stories — Warehouse Inventory System

**Breakdown**: Feature-Based | **Acceptance Criteria Format**: Given/When/Then | **Granularity**: One story per user-facing action, branching outcomes as multiple scenarios.

**Personas**: [RSC] = Retail Store Clerk, [WSH] = Warehouse Stock Handler. Every story applies to both personas identically (see personas.md — shared context) unless a persona is called out as more typical.

---

## Epic: Category Management (FR1)

### Story CAT-1: Create a Category
**As** an inventory staff member ([RSC]/[WSH]), **I want** to create a new category, **so that** I can group related products (e.g. Beverages, Snacks, Household).

**Acceptance Criteria**:
- Given no category with the given name exists (active or soft-deleted), when I create a category with a valid name, then the category is created and appears in the category listing.
- Given a category with that name already exists and is active, when I try to create it again, then the system rejects the request with a clear error.
- Given a category with that name exists but is soft-deleted, when I try to create a new category with the same name, then the system rejects the request — the name stays reserved until the soft-deleted category is hard-deleted.

**INVEST**: Independent, Negotiable (naming rules TBD in design), Valuable (foundation for organizing products), Estimable, Small, Testable.

### Story CAT-2: Rename a Category
**As** an inventory staff member ([WSH] typically), **I want** to rename an existing category, **so that** I can correct or update its label without losing its products.

**Acceptance Criteria**:
- Given an active category exists, when I rename it, then the new name is reflected in listings and all its existing products remain linked to it.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

### Story CAT-3: Delete a Category
**As** an inventory staff member ([WSH] typically), **I want** to delete a category I no longer need, **so that** my category list stays clean without losing product history.

**Acceptance Criteria**:
- Given a category has zero products referencing it (active or soft-deleted), when I delete it, then the category is permanently removed (hard delete) and no longer appears anywhere.
- Given a category has one or more products referencing it, when I delete it, then the category is soft-deleted (hidden from listings and from the category picker when creating/editing a product), while its existing products keep their category reference unchanged.
- Given a category is soft-deleted, when I view the category listing or the category picker, then it does not appear.

**INVEST**: Independent, Negotiable, Valuable (prevents orphaned data), Estimable, Small, Testable.

### Story CAT-4: View Category Listing with Stock Totals
**As** an inventory staff member ([RSC]/[WSH]), **I want** to see all active categories with their total stock, **so that** I can quickly see which product groups are running low.

**Acceptance Criteria**:
- Given active categories exist with products, when I view the category listing, then each category shows the sum of its products' current stock quantities.
- Given a category is soft-deleted, when I view the category listing, then it and its stock total are excluded.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

---

## Epic: Product Management (FR2)

### Story PROD-1: Create a Product
**As** an inventory staff member ([WSH] typically), **I want** to add a new product with its name, price, code, and category, **so that** it becomes trackable in the system.

**Acceptance Criteria**:
- Given a valid active category exists and the product code is not already in use (by an active or soft-deleted product), when I create a product, then it is created with an initial stock quantity and appears in listings.
- Given the product code is already in use, when I try to create the product, then the system rejects the request with a clear error.
- Given the chosen category is soft-deleted (in the UI), when I try to create a product in it, then the category is not offered as a valid option in the picker.
- Given a create request is sent directly to the API (bypassing the UI) referencing a soft-deleted or non-existent category id, when the API processes it, then the request is rejected at the API level with a clear error — the same rule applies whether or not the UI is involved.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

### Story PROD-2: Update Product Details
**As** an inventory staff member ([WSH] typically), **I want** to update a product's name, price, code, or category, **so that** its information stays accurate over time.

**Acceptance Criteria**:
- Given a product exists, when I update its name/price/category, then the changes are reflected immediately in listings and detail views.
- Given I try to change its code to one already in use by another product, then the system rejects the update.
- Given an update request (via UI or direct API call) reassigns the product to a soft-deleted or non-existent category id, when the API processes it, then the request is rejected at the API level with a clear error, and the product's category is left unchanged.
- **Note**: Stock quantity is not updated through this action — see Stock Adjustment stories.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

### Story PROD-3: Delete a Product
**As** an inventory staff member ([WSH] typically), **I want** to delete a product I no longer carry, **so that** it stops cluttering listings without erasing its transaction history.

**Acceptance Criteria**:
- Given a product has zero stock-adjustment history entries, when I delete it, then it is permanently removed (hard delete) and its product code becomes available for reuse.
- Given a product has one or more stock-adjustment history entries, when I delete it, then it is soft-deleted (hidden from normal listings), its code remains reserved, and its full history stays retrievable.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

### Story PROD-4: View Product Detail
**As** an inventory staff member ([RSC]/[WSH]), **I want** to view a single product's full details, **so that** I can confirm its price, code, category, and current stock.

**Acceptance Criteria**:
- Given a product exists, when I view its detail, then I see its name, price, code, category, and current stock quantity.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

### Story PROD-5: Sort and Filter Product Listing
**As** an inventory staff member ([RSC]/[WSH]), **I want** to sort and filter the product listing, **so that** I can quickly find the products I care about.

**Acceptance Criteria**:
- Given multiple products exist, when I sort by name, price, or stock quantity (ascending or descending), then the listing reflects that order.
- Given multiple categories exist, when I filter by a category, then only that category's products appear.
- Given a product is soft-deleted, when I view the listing (with or without filters), then it does not appear.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

---

## Epic: Stock Adjustments (FR3)

### Story STK-1: Increase Stock
**As** an inventory staff member ([WSH] typically, after receiving a shipment), **I want** to increase a product's stock quantity, **so that** the system reflects newly received inventory.

**Acceptance Criteria**:
- Given an active product exists, when I increase its stock by a positive amount, then its stock quantity goes up by that amount and a history entry is recorded with the delta, timestamp, and resulting balance.
- Given a product is soft-deleted, when I attempt to increase its stock, then the system rejects the request, the stock quantity is unchanged, and no history entry is created.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

### Story STK-2: Decrease Stock
**As** an inventory staff member ([RSC] typically, after a sale or finding damaged stock), **I want** to decrease a product's stock quantity, **so that** the system reflects what's actually on hand — while never going negative.

**Acceptance Criteria**:
- Given an active product has stock ≥ the requested decrease amount, when I decrease its stock, then its stock quantity goes down by that amount and a history entry is recorded with the delta, timestamp, and resulting balance.
- Given a product's stock is less than the requested decrease amount, when I attempt the decrease, then the system rejects the request, the stock quantity is unchanged, and no history entry is created.
- Given a product is soft-deleted, when I attempt to decrease its stock, then the system rejects the request, the stock quantity is unchanged, and no history entry is created — a soft-deleted product's existing history remains viewable (HIST-1), but it cannot receive new adjustments.

**INVEST**: Independent, Negotiable, Valuable (protects the core zero-floor invariant), Estimable, Small, Testable.

---

## Epic: History / Audit Trail (FR3.4)

### Story HIST-1: View Stock Adjustment History for a Product
**As** an inventory staff member ([WSH] typically, investigating a discrepancy), **I want** to view the full chronological history of stock adjustments for a product, **so that** I can understand how its current stock level was reached.

**Acceptance Criteria**:
- Given a product has one or more recorded adjustments, when I view its history, then I see each entry in chronological order with its timestamp, quantity delta, and resulting balance.
- Given a product is soft-deleted (because it has history), when I view its history, then it is still fully retrievable.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

---

## Epic: Web UI (FR4)

### Story UI-1: Manage Categories via the Web UI
**As** an inventory staff member ([RSC]/[WSH]), **I want** to create, rename, and delete categories directly from the web page, **so that** I don't need a separate tool (e.g. Postman) to manage the catalog structure.

**Acceptance Criteria**:
- Given I am on the category management page, when I create, rename, or delete a category, then the same rules and outcomes as CAT-1/CAT-2/CAT-3 apply, and the page reflects the result without a manual refresh.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

### Story UI-2: Manage Products via the Web UI
**As** an inventory staff member ([RSC]/[WSH]), **I want** to create, update, and delete products directly from the web page, **so that** day-to-day catalog maintenance doesn't require the raw API.

**Acceptance Criteria**:
- Given I am on the product management page, when I create, update, or delete a product, then the same rules and outcomes as PROD-1/PROD-2/PROD-3 apply, and the page reflects the result without a manual refresh.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

### Story UI-3: Adjust Stock via the Web UI
**As** an inventory staff member ([RSC]/[WSH]), **I want** to increase or decrease a product's stock from the web page, **so that** I can update stock without a separate API client.

**Acceptance Criteria**:
- Given I am on a product's detail page, when I submit a stock increase or decrease, then the same rules and outcomes as STK-1/STK-2 apply, including a visible error message when a decrease is rejected for going below zero.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

### Story UI-4: View Listings, Category Totals, and History via the Web UI
**As** an inventory staff member ([RSC]/[WSH]), **I want** to see the product listing (sortable/filterable), category stock totals, and a product's adjustment history on the web page, **so that** I have one place to check the state of the inventory.

**Acceptance Criteria**:
- Given I am on the web UI, when I use the sort/filter controls, then the listing behaves as in PROD-5.
- Given I am on the category overview, when I view it, then it behaves as in CAT-4.
- Given I select a product's history view, when I open it, then it behaves as in HIST-1.

**INVEST**: Independent, Negotiable, Valuable, Estimable, Small, Testable.

---

## Persona-to-Story Map

| Persona | Primary Stories |
|---|---|
| **Retail Store Clerk [RSC]** | PROD-4, PROD-5, STK-2, HIST-1 (spot checks), UI-3, UI-4 |
| **Warehouse Stock Handler [WSH]** | CAT-1, CAT-2, CAT-3, CAT-4, PROD-1, PROD-2, PROD-3, STK-1, HIST-1 (investigations), UI-1, UI-2 |
| **Both** | All stories are technically accessible to both (no RBAC); the table above reflects typical day-to-day usage, not access restriction. |
