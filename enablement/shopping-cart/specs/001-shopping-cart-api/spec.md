# Feature Specification: Shopping Cart API

**Feature Branch**: `001-shopping-cart-api`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "Build a backend API for managing shopping carts. A client can create a new cart, add an item (product identifier, quantity, and price) to a cart, update the quantity of an item already in a cart, remove an item from a cart, and retrieve a cart's current contents including its calculated total price. A client can also check out a cart, which finalizes it and clears its contents — checkout does not involve any payment. A client can clear a cart's contents without checking out. Each cart is identified by a unique id; there are no user accounts, so any client holding a cart's id can view or modify it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build and view a cart (Priority: P1)

A client creates a new cart, adds items to it (each with a product identifier, quantity, and
price), and retrieves the cart's current contents along with the calculated total price.

**Why this priority**: This is the core value of the feature — without the ability to create a
cart, add items, and see what's in it with a running total, there is no shopping cart. Every
other capability builds on this.

**Independent Test**: Can be fully tested by creating a cart, adding one or more items to it, and
retrieving the cart to confirm the items, status, and total price are correct. Delivers a usable
cart on its own.

**Acceptance Scenarios**:

1. **Given** no existing cart, **When** a client creates a new cart, **Then** the system returns
   a unique cart id and an empty cart (no items, total price of zero).
2. **Given** an existing empty cart, **When** a client adds an item with a product identifier,
   quantity, and price, **Then** the cart contains that item and the total price reflects
   quantity × price for that item.
3. **Given** a cart containing items, **When** a client retrieves the cart, **Then** the response
   includes every item (product identifier, quantity, price), the cart's status (open or checked
   out), and the correct total price across all items.
4. **Given** a cart that already contains an item for a given product identifier, **When** a
   client adds an item with that same product identifier, **Then** the existing line item's
   quantity increases by the newly added quantity (rather than creating a duplicate line item).
5. **Given** a cart that already contains an item for a given product identifier at one price,
   **When** a client adds an item with that same product identifier at a different price,
   **Then** the existing line item's quantity increases by the newly added quantity and its price
   is overwritten with the newly supplied price.

---

### User Story 2 - Adjust cart contents (Priority: P2)

A client updates the quantity of an item already in a cart, or removes an item from a cart
entirely, and the cart's total price updates accordingly.

**Why this priority**: Once a cart can be built and viewed, clients need to correct mistakes and
change their minds (change quantity, remove something) before checking out. This is required for
a realistic cart but depends on User Story 1 existing first.

**Independent Test**: Can be fully tested by starting from a cart that already has items (from
User Story 1), updating one item's quantity, removing another item, and retrieving the cart to
confirm the contents and total price reflect both changes.

**Acceptance Scenarios**:

1. **Given** a cart containing an item, **When** a client updates that item's quantity to a new
   positive value, **Then** the item's quantity changes and the total price is recalculated.
2. **Given** a cart containing an item, **When** a client removes that item, **Then** the item no
   longer appears in the cart and the total price is recalculated without it.
3. **Given** a cart containing multiple items, **When** a client removes one of them, **Then**
   the remaining items are unaffected.

---

### User Story 3 - Finalize or empty a cart (Priority: P3)

A client checks out a cart, which finalizes it and clears its contents (no payment involved), or
clears a cart's contents directly without checking out.

**Why this priority**: Checkout and clearing complete the cart's lifecycle. They matter less than
being able to build and adjust a cart, since a cart that's never finalized or cleared still
delivers value while it's being shopped, so this rounds out the lifecycle rather than being the
first thing a client needs.

**Independent Test**: Can be fully tested by starting from a cart with items (from User Story 1),
checking it out, and confirming the cart's contents are cleared; separately, by starting from a
cart with items and clearing it directly (without checkout) and confirming the same emptied
result.

**Acceptance Scenarios**:

1. **Given** a cart containing items, **When** a client checks out the cart, **Then** the cart is
   finalized, its contents are cleared, and its total price is zero.
2. **Given** a cart that has been checked out, **When** a client attempts to add, update, or
   remove an item on that cart, **Then** the system rejects the change because the cart is
   finalized.
3. **Given** a cart containing items, **When** a client clears the cart without checking out,
   **Then** the cart's contents are removed and its total price is zero, and the cart remains
   open for further changes (unlike checkout).

---

### Edge Cases

- What happens when a client adds, updates, retrieves, checks out, or clears a cart using a cart
  id that does not exist? The system MUST reject the request without creating or modifying any
  cart.
- What happens when a client updates or removes an item using a product identifier that is not
  currently in the cart? The system MUST reject the request without modifying the cart.
- What happens when a client adds an item with a quantity that is zero or negative, or with a
  negative price? The system MUST reject the request without modifying the cart (a quantity of
  zero is not a valid quantity to add — it must be strictly greater than zero).
- What happens when a client updates an item's quantity to zero? The system treats this the same
  as removing that item from the cart.
- What happens when a client checks out a cart that has no items? The system MUST reject the
  request, since there is nothing to finalize.
- What happens when a client attempts any operation (other than retrieval) on a cart that has
  already been checked out? The system MUST reject the request because the cart is finalized.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a client to create a new, empty cart and MUST return a
  unique identifier for that cart.
- **FR-002**: The system MUST allow a client to add an item to an open cart by supplying a
  product identifier, a quantity, and a price for that item.
- **FR-003**: When a client adds an item whose product identifier already exists in the cart, the
  system MUST increase that line item's quantity by the newly added quantity and MUST overwrite
  that line item's price with the newly supplied price, rather than create a duplicate line item.
- **FR-004**: The system MUST allow a client to update the quantity of an item already in an open
  cart.
- **FR-005**: The system MUST treat updating an item's quantity to zero as equivalent to removing
  that item from the cart.
- **FR-006**: The system MUST allow a client to remove an item from an open cart.
- **FR-007**: The system MUST allow a client to retrieve a cart's current contents, including
  every item's product identifier, quantity, and price, and the cart's status (open or checked
  out).
- **FR-008**: The system MUST calculate and return a cart's total price as the sum, across all
  items in the cart, of each item's quantity multiplied by its price.
- **FR-009**: The system MUST allow a client to check out an open cart that contains at least one
  item, which finalizes the cart and clears its contents (no payment is processed).
- **FR-010**: The system MUST reject a checkout request for a cart that has no items.
- **FR-011**: The system MUST allow a client to clear an open cart's contents without checking
  it out, leaving the cart open for further changes.
- **FR-012**: The system MUST reject any attempt to add, update, remove, checkout, or clear items
  on a cart that has already been checked out.
- **FR-013**: The system MUST reject any operation that references a cart id that does not exist.
- **FR-014**: The system MUST reject adding an item with a quantity that is not strictly greater
  than zero (i.e. zero or negative quantities are rejected), and MUST reject adding or updating
  an item with a price below zero.
- **FR-015**: The system MUST reject updating or removing an item by a product identifier that is
  not currently present in the cart.
- **FR-016**: The system MUST NOT require any user account, login, or session — any client
  holding a cart's id may view or modify that cart (see Assumptions).

### Key Entities

- **Cart**: Represents a single shopping cart. Identified by a unique id. Holds a collection of
  line items and a status (open or checked out), both of which are returned to the client on
  retrieval. Its total price is derived from its line items, not stored independently.
- **Line Item**: Represents one product's presence within a cart. Attributes: product identifier,
  quantity, and price (the price supplied when the item was added). Belongs to exactly one cart;
  at most one line item per product identifier per cart.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A client can create a cart, add multiple items, and retrieve a correct total price
  in a single, straightforward sequence of requests with no ambiguity about the result.
- **SC-002**: 100% of retrieved cart totals exactly equal the sum of each line item's quantity
  multiplied by its price, verified across all cart states (freshly created, after additions,
  after updates, after removals).
- **SC-003**: 100% of operations attempted on a nonexistent cart, a checked-out cart, or with
  invalid input (negative quantity/price, unknown product identifier) are rejected without
  altering any cart's stored state.
- **SC-004**: A client can complete a full cart lifecycle — create, add items, adjust items,
  and either check out or clear — using only the cart id, with no additional identity or
  credential of any kind.

## Assumptions

- Adding an item for a product identifier already present in the cart merges into the existing
  line item rather than creating a second line item or erroring: quantities sum, and the price is
  overwritten with the newly supplied price (the most recent add's price wins). This matches
  common shopping-cart behavior and keeps the model simple (one line item per product per cart,
  with a single current price for that line item).
- A checked-out cart is finalized and locked: no further add/update/remove/clear/checkout
  operations are accepted against it, though this specification does not require retrieval to be
  blocked. This gives "finalizes it" concrete, testable meaning.
- Checkout requires at least one item; checking out an empty cart is rejected as there is nothing
  to finalize.
- There is no cart expiration, abandonment cleanup, or maximum item count in this feature —
  carts persist until checked out or explicitly cleared, with no time-based lifecycle.
- Any client possessing a cart's id has full read/write access to that cart; there is no owner,
  session, or authentication concept, consistent with the "no user accounts" requirement.
- Price is supplied by the client at the time an item is added (as stated in the feature
  description) rather than looked up from a separate product catalog, since no product catalog
  or pricing service is described.
