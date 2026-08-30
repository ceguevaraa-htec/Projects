<!--
Sync Impact Report
- Version change: (none) → 1.0.0
- Modified principles: N/A (initial ratification)
- Added sections:
  - Core Principles: I. Test-First Development, II. Global Error Handling & Observability,
    III. Transactional Data Integrity, IV. Consistent REST API Design,
    V. Payment Gateway Isolation (Separation of Concerns)
  - Technology & Data Constraints
  - Development Workflow & Quality Gates
  - Governance
- Removed sections: N/A (initial ratification)
- Deferred TODOs: none
-->

# Shopping Cart & Payment Gateway API Constitution

## Core Principles

### I. Test-First Development (NON-NEGOTIABLE)
Unit tests MUST be written and reviewed before implementation code for every major component,
including cart operations (add/update/remove items, retrieve cart), checkout/total calculation,
and mock payment gateway endpoints (submission and status retrieval). Tests MUST be written to
fail first against the not-yet-implemented behavior, then implementation proceeds only to make
them pass (Red-Green-Refactor). A pull request that adds or changes cart, checkout, or payment
behavior without accompanying unit tests MUST NOT be merged.
Rationale: Cart and payment logic directly affects financial correctness; defining expected
behavior as tests first prevents ambiguity and regressions as the system evolves.

### II. Global Error Handling & Observability
The API MUST implement a single, centralized error-handling mechanism that intercepts unhandled
exceptions and translates them into a consistent error response shape (e.g. status code, error
code, human-readable message, correlation/request id) across all endpoints. Handlers and
services MUST NOT invent ad-hoc error formats. Every major activity MUST be logged, including:
cart creation and item changes, checkout attempts (with computed totals/discounts), payment
submissions, and payment results (approved/declined) with enough context (cart id, transaction
id, timestamp, outcome) to reconstruct the sequence of events during an incident review.
Rationale: Predictable error contracts simplify client integration, and a complete activity log
is required to audit and debug payment outcomes after the fact.

### III. Transactional Data Integrity
All state changes to carts and payments (item add/update/remove, status transitions, payment
submission and result recording) MUST be persisted to the relational database (SQLite) within a
transaction boundary that either fully commits or fully rolls back. Partial writes that could
leave a cart or payment record in an inconsistent state (e.g. cart marked "Paid" without a
corresponding recorded payment result) are forbidden. Multi-step operations (e.g. checkout →
payment request → status update) MUST be wrapped so that failure at any step does not corrupt
previously committed data.
Rationale: Money and inventory-affecting state must never be left ambiguous; transactional
persistence is the minimum guarantee for a trustworthy checkout flow.

### IV. Consistent REST API Design
All endpoints exposing products, carts, and transactions MUST follow predictable REST
conventions: resource-oriented URLs, standard HTTP methods and status codes for CRUD operations,
and a uniform approach to filtering, paging, and searching (consistent query parameter naming,
e.g. `page`, `pageSize`, `sort`, `q`, and field-specific filters) reused across every listable
resource. New endpoints MUST match the conventions already established for existing resources
rather than introducing one-off patterns.
Rationale: Consistency reduces integration effort for API consumers and prevents accidental
divergence as more resources (products, carts, transactions) are added over time.

### V. Payment Gateway Isolation (Separation of Concerns)
Mock payment gateway logic (payment submission, status simulation, approve/decline decisioning)
MUST live behind a well-defined interface/module boundary, separate from cart and checkout
logic. Cart/checkout code MUST depend only on this interface (e.g. a `PaymentGateway` contract)
and MUST NOT contain payment-provider-specific logic. The mock implementation MUST be
replaceable by a real payment provider implementation without changes to cart or checkout code.
Rationale: Isolating the payment boundary keeps the mock swappable for a real provider later and
prevents payment-specific concerns from leaking into core cart behavior.

## Technology & Data Constraints

The system MUST use a lightweight relational database that can run locally, with SQLite as the
default choice for development and testing. A database seed script MUST be provided so the
schema and representative product/cart/transaction data can be recreated for local setup and
testing. Schema changes MUST be expressed as migrations rather than manual, undocumented edits
to the database file.

## Development Workflow & Quality Gates

Every change touching cart, checkout, or payment behavior MUST include: (a) unit tests written
before or alongside the change per Principle I, (b) verification that errors surface through the
global error handler per Principle II, (c) confirmation that persistence changes are
transactional per Principle III, (d) conformance to existing REST conventions per Principle IV,
and (e) confirmation that payment logic changes stay behind the payment gateway interface per
Principle V. Code review MUST verify these five points before approval; a reviewer who cannot
confirm one of them MUST request changes rather than approve.

## Governance

This constitution supersedes ad-hoc conventions and prior undocumented practice for this
project. Amendments require: (1) a documented rationale for the change, (2) an update to this
file following the same structure, and (3) a version bump following semantic versioning —
MAJOR for backward-incompatible governance or principle removals/redefinitions, MINOR for new
principles or materially expanded guidance, PATCH for clarifications and wording fixes. All pull
requests and reviews MUST verify compliance with the Core Principles above; any deviation must be
explicitly justified in the PR description and, if accepted, tracked as a follow-up amendment
rather than left as silent drift. Complexity or exceptions to these principles must be justified
in writing, not merely assumed acceptable.

**Version**: 1.0.0 | **Ratified**: 2026-08-30 | **Last Amended**: 2026-08-30
