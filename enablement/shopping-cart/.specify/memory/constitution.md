<!--
Sync Impact Report
Version change: 1.0.0 → 1.0.1
Modified principles: none redefined
Added principles: none
Added sections: none
Modified sections:
  - Technology Constraints: added a clarifying bullet stating the service supports multiple
    independent carts identified by a system-assigned cart id, with no user accounts, sessions,
    or ownership — any client holding a cart id can read or modify it. Clarifies existing scope
    (Principle V simplicity) rather than introducing new behavior.
Removed sections: none
Deferred / TODO placeholders: none — all template tokens resolved
Templates requiring follow-up: none (plan/spec/tasks templates are consumed at runtime and
  already reference "Constitution Check" generically; no edits made per scope guard)
Rationale for PATCH bump: wording clarification of existing scope, not a new or redefined
  principle — matches the versioning policy's PATCH case.
-->

# Shopping Cart Constitution

## Core Principles

### I. Layered Architecture
The service MUST be organized into three strictly separated layers:

- **Repository layer**: owns all data access. For this project, an in-memory store (e.g. a
  `Map`) with no persistence across restarts. Contains no business logic and no HTTP concerns.
- **Service layer**: owns business logic and orchestration (cart lifecycle rules — add, update,
  remove, clear; total calculation; checkout; logging of mutating actions). Calls the repository
  layer only; never touches HTTP request/response objects.
- **Router layer**: owns HTTP concerns only (route definitions, request parsing, status codes,
  response shaping). Contains no business logic and no direct data access — it delegates to the
  service layer.

Each layer MUST depend only downward (router → service → repository). Upward or sideways
dependencies (e.g. repository importing service code, router touching the store directly) are
prohibited. Rationale: strict layering keeps each piece independently testable and swappable
(e.g. replacing the in-memory store later) without touching unrelated code.

### II. Test-First Development
Every cart operation — add item, update item, remove item, retrieve cart contents, calculate
total, checkout, clear cart — MUST have at least one unit test covering its service-layer
behavior before it is considered done. Tests SHOULD be written before or alongside implementation
(TDD-style) wherever practical; when written after, they MUST still land in the same change as
the feature. An operation without a passing test is not complete. Rationale: unit tests at the
service layer verify business logic (especially total calculation and lifecycle transitions) in
isolation from HTTP and storage details, catching regressions cheaply.

### III. Observability via Structured Logging
Every major activity — cart creation, item add/update/remove, total calculation, checkout, cart
clear — MUST emit a log entry recording, at minimum: the action type, the affected cart's id
(and item id where applicable), and a timestamp. Logging MUST happen in the service layer (not
the router, not the repository), so business-meaningful events are logged regardless of how they
were triggered. Rationale: consistent, layer-owned logging gives visibility into cart behavior
without coupling observability to the transport (HTTP) layer.

### IV. Robust Error Handling
Every cart operation MUST validate its inputs (e.g. non-existent cart or item, invalid or
negative quantity, checkout of an empty cart) and MUST fail with a clear, typed error rather than
throwing an unhandled exception or silently succeeding. The router layer MUST translate service
errors into appropriate HTTP status codes and a structured error response body. Rationale:
explicit error handling at the boundary keeps failures diagnosable and prevents an inconsistent
cart state from ever being persisted.

### V. Simplicity & Minimal Dependencies
The project MUST avoid persistent storage, authentication/authorization, and any dependency not
strictly required for HTTP handling or testing. New abstractions (interfaces, factories, generic
frameworks) MUST NOT be introduced ahead of an actual second use case ("no premature
abstraction"). When in doubt, prefer the simplest implementation that satisfies the other
principles. Rationale: this is a learning/practice project — its value is in demonstrating clean
layering, testing discipline, error handling, and observability, not feature breadth or
production hardening.

## Technology Constraints

- **Storage**: in-memory only (e.g. a `Map`); no database, no persistence across restarts.
- **Multiple carts, no accounts**: the service supports multiple independent carts, each
  identified by a system-assigned cart id; there are no user accounts, sessions, or ownership —
  any client with a cart id can read or modify that cart. This is not multi-tenancy or auth; it
  is simply multiple independent cart records, matching Principle V's simplicity constraint.
- **Explicitly out of scope**: authentication/authorization, security hardening, performance or
  scalability requirements, persistence, payment processing (checkout is a state transition only,
  not real payment integration), a frontend/UI, deployment or infrastructure practices. These
  MUST NOT be added as requirements to specs or plans for this project unless this constitution
  is amended first.

## Development Workflow

- Work proceeds through the Spec Kit flow: constitution → specify → clarify → plan → tasks →
  implement, in that order, for each feature.
- Each cart operation is implemented across all three layers (repository → service → router) in
  the same change, with its service-layer unit test included.
- Code review (self or peer) MUST verify: correct layer placement of new code, presence of a
  passing test for the operation, presence of a log entry for any new mutating action, and
  presence of input validation/error handling.
- No feature is merged/considered complete if it violates Principle I (layering), II (testing),
  III (logging), or IV (error handling) without an explicit, documented exception approved via a
  constitution amendment.

## Governance

- **Authority**: This constitution supersedes ad hoc conventions for this project. Specs, plans,
  and tasks MUST comply with it; where they conflict, the constitution wins unless amended.
- **Amendment procedure**: Amendments are made by editing this file via the `/speckit-constitution`
  command, updating the version per the policy below, setting `Last Amended` to the date of
  change, and recording the change in a Sync Impact Report comment at the top of the file.
- **Versioning policy** (semantic versioning):
  - **MAJOR**: backward-incompatible principle removal or redefinition (e.g. dropping the
    layering requirement, allowing persistent storage).
  - **MINOR**: a new principle or materially expanded guidance added.
  - **PATCH**: wording clarifications and non-semantic refinements.
- **Compliance review**: Any change to the codebase that introduces a new dependency, a new
  storage mechanism, or skips a required test, log entry, or error-handling path MUST be checked
  against this constitution before being accepted; unresolved conflicts block completion of the
  feature.

**Version**: 1.0.1 | **Ratified**: 2026-08-26 | **Last Amended**: 2026-08-26
