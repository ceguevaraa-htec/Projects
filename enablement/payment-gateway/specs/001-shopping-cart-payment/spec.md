# Feature Specification: Shopping Cart with Mock Payment Gateway

**Feature Branch**: `[001-shopping-cart-payment]`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "Build a shopping cart system with an integrated mock payment gateway. When a user starts shopping, a cart is created. Products can be added to the cart with a specific quantity; if a product already exists in the cart, its quantity is updated instead of creating a duplicate line item. Users can update item quantities and remove items from the cart, and can retrieve the current contents of their cart at any time. Users can browse products with filtering, paging, and searching (e.g. by name, category, price range) so they can quickly find what they want among a large catalog. During checkout, the system calculates the final total for the cart, including any applicable discounts. A payment request is then submitted through a mocked payment gateway using mocked endpoints — no real payment provider is involved. The gateway simulates either approving or declining the transaction. If the payment is approved, the cart's status changes to 'Paid'. If declined, the cart's status changes to 'Failed'. Users can retrieve the status of a past payment/transaction, and can search or page through their transaction history. A database seed must be provided so the system can be set up and tested with realistic sample products, carts, and transactions out of the box."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build and Manage a Cart (Priority: P1)

A shopper starts a shopping session, which creates a cart, and adds products to it with a
chosen quantity. If they add a product that is already in the cart, the existing line item's
quantity increases rather than a duplicate entry being created. The shopper can change a line
item's quantity, remove a line item entirely, and view the current contents of the cart
(products, quantities, and running total) at any time.

**Why this priority**: Without the ability to create a cart and add/update/remove items, there
is no shopping experience at all — every other capability builds on this one.

**Independent Test**: Can be fully tested by creating a cart, adding a product with a quantity,
adding the same product again and confirming the quantity merges, updating a line item's
quantity, removing a line item, and retrieving the cart contents to confirm the final state —
delivers a working cart on its own, independent of checkout or payment.

**Acceptance Scenarios**:

1. **Given** no existing cart for the shopper, **When** the shopper starts shopping, **Then** a
   new, empty cart is created and can be retrieved.
2. **Given** an empty cart, **When** the shopper adds a product with quantity 2, **Then** the
   cart contains one line item for that product with quantity 2.
3. **Given** a cart already containing a product with quantity 2, **When** the shopper adds the
   same product with quantity 3, **Then** the cart still contains a single line item for that
   product, now with quantity 5.
4. **Given** a cart containing a product, **When** the shopper updates that line item's quantity
   to a new value, **Then** the cart reflects the new quantity for that line item.
5. **Given** a cart containing a product, **When** the shopper removes that line item, **Then**
   the product no longer appears in the cart's contents.
6. **Given** a cart with items in it, **When** the shopper retrieves the cart, **Then** the
   response shows all current line items, their quantities, and the cart's running total.

---

### User Story 2 - Browse, Filter, and Search Products (Priority: P2)

A shopper browses the product catalog and narrows it down using filters (such as category or
price range) and a text search (such as by product name), with results delivered a page at a
time so large catalogs stay usable.

**Why this priority**: Shoppers need to be able to find products before they can add them to a
cart; this is the discovery step that feeds User Story 1, but a cart can still be exercised
directly with known product identifiers even before this story exists, so it is ranked below
cart management.

**Independent Test**: Can be fully tested by querying the product catalog with a search term, a
category filter, and a price range filter (individually and combined), and by requesting
successive pages of results — delivers a usable product discovery experience independent of
cart or payment functionality.

**Acceptance Scenarios**:

1. **Given** a catalog with many products, **When** the shopper requests a page of products,
   **Then** the system returns only that page's worth of results along with information needed
   to fetch subsequent pages.
2. **Given** a catalog with products in multiple categories, **When** the shopper filters by a
   specific category, **Then** only products in that category are returned.
3. **Given** a catalog with products at various prices, **When** the shopper filters by a price
   range, **Then** only products whose price falls within that range are returned.
4. **Given** a catalog with products of various names, **When** the shopper searches by a
   keyword matching part of a product's name, **Then** only matching products are returned.
5. **Given** search, filter, and paging parameters combined in one request, **When** the shopper
   submits the request, **Then** the system applies all of them together and returns the
   correctly narrowed, paged result set.

---

### User Story 3 - Checkout and Pay for a Cart (Priority: P1)

A shopper checks out a cart. The system calculates the cart's final total, including any
applicable discounts, and submits a payment request through the mock payment gateway. Depending
on whether the mock gateway approves or declines the request, the cart's status becomes "Paid"
or "Failed".

**Why this priority**: Checkout and payment are the point at which the cart becomes a completed
(or failed) transaction — this is the core value the system exists to deliver, on par with basic
cart management.

**Independent Test**: Can be fully tested by checking out a cart with known contents and
confirming the calculated total is correct, then confirming the cart's status becomes "Paid"
when the mock gateway approves and "Failed" when it declines — delivers the complete
purchase outcome independent of product browsing.

**Acceptance Scenarios**:

1. **Given** a cart with items in it, **When** the shopper initiates checkout, **Then** the
   system computes and returns a final total that reflects the item prices, quantities, and any
   applicable discounts.
2. **Given** a cart at checkout, **When** the payment request submitted to the mock gateway is
   approved, **Then** the cart's status changes to "Paid".
3. **Given** a cart at checkout, **When** the payment request submitted to the mock gateway is
   declined, **Then** the cart's status changes to "Failed".
4. **Given** a cart with no items, **When** the shopper attempts to check out, **Then** the
   system rejects the checkout attempt without submitting a payment request.
5. **Given** a cart that already has status "Paid", **When** the shopper attempts to check out
   that cart again, **Then** the system rejects the second checkout attempt without submitting a
   new payment request.

---

### User Story 4 - Review Transaction History (Priority: P3)

A shopper looks up the status of a specific past payment/transaction, and separately can search
and page through their history of past transactions.

**Why this priority**: This is valuable for transparency and support after a purchase, but it is
not required for a shopper to complete a first purchase, so it is ranked after cart management
and checkout.

**Independent Test**: Can be fully tested by checking out one or more carts to produce
transactions, then retrieving one transaction by its identifier and separately listing/searching
the transaction history with paging — delivers a working history view independent of any new
purchase being made during the test.

**Acceptance Scenarios**:

1. **Given** a completed (approved or declined) payment attempt, **When** the shopper retrieves
   that transaction by its identifier, **Then** the system returns its current status and
   relevant details (cart, amount, outcome, timestamp).
2. **Given** a shopper with multiple past transactions, **When** the shopper requests their
   transaction history, **Then** the results are returned a page at a time.
3. **Given** a shopper with multiple past transactions, **When** the shopper searches their
   transaction history (e.g. by status or date), **Then** only matching transactions are
   returned.

---

### Edge Cases

- What happens when a shopper tries to add a product that does not exist (invalid product
  identifier) to a cart?
- What happens when a shopper tries to set a line item's quantity to zero or a negative number?
- What happens when a shopper tries to update or remove a line item that is not in the cart?
- What happens when a shopper retrieves, updates, or checks out a cart that does not exist?
- How does the system handle a checkout request submitted while a previous checkout for the same
  cart is still being processed (duplicate/concurrent checkout attempts)?
- What total does an empty or all-discounted cart display, and is checkout allowed on a
  zero-total cart?
- What happens when a requested transaction identifier does not exist?
- What is returned when filter, search, or paging parameters are invalid (e.g. a negative page
  number, an unknown category, a price range with a minimum greater than the maximum)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a new cart to be created for a shopper when they start
  shopping.
- **FR-002**: The system MUST allow a product to be added to a cart with a specified quantity.
- **FR-003**: When a product being added already exists as a line item in the cart, the system
  MUST increase that line item's quantity by the newly added amount instead of creating a
  duplicate line item.
- **FR-004**: The system MUST allow the quantity of an existing line item in a cart to be
  updated to a new value.
- **FR-005**: The system MUST allow a line item to be removed from a cart.
- **FR-006**: The system MUST allow the current contents of a cart (line items, quantities, and
  computed running total) to be retrieved at any time.
- **FR-007**: The system MUST reject attempts to add, update, or check out with a line item
  quantity that is zero or negative.
- **FR-008**: The system MUST allow products in the catalog to be listed with support for
  paging.
- **FR-009**: The system MUST allow products to be filtered by category and by price range.
- **FR-010**: The system MUST allow products to be searched by name (or partial name match).
- **FR-011**: The system MUST support combining search, filtering, and paging parameters in a
  single product listing request.
- **FR-012**: The system MUST calculate a cart's final total at checkout, incorporating item
  prices, quantities, and any applicable discounts.
- **FR-013**: The system MUST submit a payment request to the mock payment gateway as part of
  checkout, and MUST NOT change the cart's status until a result (approved or declined) is
  received from the gateway.
- **FR-014**: The system MUST set a cart's status to "Paid" when the mock payment gateway
  approves the payment request.
- **FR-015**: The system MUST set a cart's status to "Failed" when the mock payment gateway
  declines the payment request.
- **FR-016**: The system MUST prevent checkout of a cart that has no line items.
- **FR-017**: The system MUST prevent a cart that already has status "Paid" from being checked
  out again.
- **FR-018**: The system MUST record each checkout attempt as a transaction that captures the
  cart, the computed total, the payment outcome, and a timestamp.
- **FR-019**: The system MUST allow a specific past transaction to be retrieved by its
  identifier, returning its current status and relevant details.
- **FR-020**: The system MUST allow a shopper's transaction history to be searched and paged
  through.
- **FR-021**: The system MUST return a clear error, without side effects, when an operation
  references a cart, product, or transaction identifier that does not exist.
- **FR-022**: The system MUST log cart creation, cart item changes, checkout attempts, payment
  submissions, and payment results as major activities.
- **FR-023**: The system MUST be initializable from a database seed containing realistic sample
  products, carts, and transactions, so it can be set up and tested out of the box.
- **FR-024**: Carts MUST be associated with an anonymous shopper session (no user account or
  login required); a cart and its related transaction history are identified and accessed via a
  session/cart identifier rather than an authenticated user identity.
- **FR-025**: The system MUST allow a shopper to supply a promo/coupon code at checkout, MUST
  validate that code, and MUST apply its corresponding discount to the cart's final total only
  when the code is valid; an invalid or missing code results in no discount being applied (and
  checkout MUST clearly reject an invalid code rather than silently proceeding without a
  discount).

### Key Entities *(include if feature involves data)*

- **Product**: An item available for purchase; has a name, category, price, and any attributes
  needed to support filtering and searching (e.g. description).
- **Cart**: Represents one shopper's in-progress or completed shopping session; has a status
  (e.g. "Open", "Paid", "Failed") and a computed total; contains zero or more cart items.
- **Cart Item**: A line item within a cart linking a product to the quantity of that product the
  shopper wants; unique per product within a given cart.
- **Transaction**: A record of a checkout/payment attempt for a cart; has an identifier, the
  cart it belongs to, the computed total at the time of checkout, the payment outcome
  (approved/declined), and a timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A shopper can go from starting a cart to seeing a final "Paid" or "Failed" result
  in a single checkout flow in under 5 seconds of system processing time.
- **SC-002**: Adding the same product to a cart multiple times never results in more than one
  line item for that product, verified across 100% of repeated-add scenarios.
- **SC-003**: Product searches and filtered listings return correct, correctly-paged results for
  catalogs of at least 10,000 products.
- **SC-004**: 100% of completed checkout attempts (approved or declined) are retrievable
  afterward as a transaction with the correct outcome and total recorded.
- **SC-005**: A shopper can locate a specific past transaction or a specific product without
  scrolling through more than one page of unrelated results, using search/filtering.
- **SC-006**: The system can be stood up from an empty environment to a fully seeded, testable
  state (sample products, carts, and transactions available) in a single setup step.

## Assumptions

- A shopper interacts with one active (non-final-status) cart at a time; starting a new shopping
  session while a prior cart is still "Open" either resumes that open cart or is handled the same
  way it is handled today for repeated "start shopping" actions — the two are functionally
  interchangeable for this feature and no separate multi-cart management is in scope.
- The mock payment gateway's approve/decline decision is simulated by the mock gateway itself
  (e.g. deterministically from the submitted payment details, or randomly) and does not depend on
  any real card network or external processor; the exact simulation rule is an internal detail of
  the mock gateway rather than a user-facing requirement.
- Product catalog data (creation/editing of products themselves) is managed outside this feature
  (e.g. via the database seed and direct data management); this feature covers browsing/searching
  the catalog, not authoring or curating it.
- "Transaction history" in User Story 4 refers to the transactions tied to the requesting
  shopper's own carts, consistent with the shopper-identity model used for carts.
- Discount rules, once defined, apply uniformly to all shoppers rather than being
  shopper-specific loyalty pricing.
- Promo/coupon codes are pre-defined (e.g. via the database seed and direct data management)
  with a discount amount/percentage and a valid/expired state; authoring or issuing new coupon
  codes through this feature's API is out of scope, and a code may be reused across shoppers
  unless a specific single-use rule is introduced later.
- An anonymous shopper session is represented by a cart/session identifier issued when the cart
  is created and supplied by the client on subsequent requests; no additional shopper profile
  data (name, email, etc.) is collected or required by this feature.
