<!--
Sync Impact Report
Version change: 1.0.0 → 1.1.0
Modified principles: none redefined — IV. Simplicity & Minimal Dependencies gained a
  clarifying note extending its existing minimal-dependency philosophy to an optional
  frontend (no new normative rule, no removal)
Added principles: none
Added sections: none (no new top-level section — amendment expands Technology Constraints)
Modified sections:
  - Technology Constraints: added an optional-frontend bullet (plain HTML/CSS/vanilla JS,
    no framework/bundler, responsive layout required); reworded the "UX/UI consistency"
    out-of-scope item to "Visual design polish beyond basic usability and responsiveness"
    to avoid contradicting the new responsiveness requirement
Removed sections: none
Deferred / TODO placeholders: none — all template tokens resolved
Templates requiring follow-up: none (plan/spec/tasks templates are consumed at runtime and
  already reference "Constitution Check" generically; no edits made per scope guard)
Rationale for MINOR bump: adds scope (an optional frontend technology constraint) without
  removing or redefining any existing principle — matches the versioning policy's MINOR case
  ("a new principle or materially expanded guidance added").
-->

# Notes Tracker Constitution

## Core Principles

### I. Layered Architecture
The service MUST be organized into three strictly separated layers:

- **Repository layer**: owns all data access. For this project, an in-memory store (e.g. a
  `Map`) with no persistence across restarts. Contains no business logic and no HTTP concerns.
- **Service layer**: owns business logic and orchestration (validation rules, note lifecycle,
  logging of mutating actions). Calls the repository layer only; never touches HTTP
  request/response objects.
- **Router layer**: owns HTTP concerns only (route definitions, request parsing, status codes,
  response shaping). Contains no business logic and no direct data access — it delegates to the
  service layer.

Each layer MUST depend only downward (router → service → repository). Upward or sideways
dependencies (e.g. repository importing service code, router touching the store directly) are
prohibited. Rationale: strict layering keeps each piece independently testable and swappable
(e.g. replacing the in-memory store later) without touching unrelated code.

### II. Test-First Development
Every feature — create, list/view, update, delete — MUST have at least one unit test covering
its service-layer behavior before it is considered done. Tests SHOULD be written before or
alongside implementation (TDD-style) wherever practical; when written after, they MUST still
land in the same change as the feature. A feature without a passing test is not complete.
Tests run via Vitest. Rationale: unit tests at the service layer verify business logic in
isolation from HTTP and storage details, catching regressions cheaply.

### III. Observability via Structured Logging
Every mutating action (create, update, delete) MUST emit a log entry recording, at minimum: the
action type, the affected note's id, and a timestamp. Logging MUST happen in the service layer
(not the router, not the repository), so business-meaningful events are logged regardless of
how they were triggered. Read-only actions (list/view) are not required to be logged.
Rationale: consistent, layer-owned logging gives visibility into system behavior without
coupling observability to the transport (HTTP) layer.

### IV. Simplicity & Minimal Dependencies
The project MUST avoid persistent storage, authentication/authorization, and any dependency not
strictly required for HTTP handling (Express) or testing (Vitest). New abstractions (interfaces,
factories, generic frameworks) MUST NOT be introduced ahead of an actual second use case
("no premature abstraction"). When in doubt, prefer the simplest implementation that satisfies
the other principles. Rationale: this is a learning/practice project — its value is in
demonstrating clean layering, testing discipline, and observability, not feature breadth or
production hardening. If a frontend is added, it follows this same minimal-dependency
philosophy: no frontend framework and no CSS framework/library (e.g. no Bootstrap/Tailwind) —
hand-written responsive CSS only (see Technology Constraints).

## Technology Constraints

- **Language/runtime**: TypeScript on Node.js.
- **HTTP layer**: Express, used only for routing and request/response handling.
- **Testing**: Vitest for all unit tests.
- **Storage**: in-memory only (e.g. a `Map`); no database, no persistence across restarts.
- **Frontend (optional)**: plain HTML, CSS, and vanilla JavaScript only, served as static files
  by the existing Express app (or a separate lightweight static server). No frontend framework
  (React, Vue, etc.), no build step/bundler beyond what's needed to serve static files. The UI
  MUST be responsive: usable and legible on both mobile-width (~375px) and desktop-width
  (~1280px+) viewports, using CSS (e.g. flexbox/grid and media queries) rather than a fixed
  desktop-only layout.
- **Explicitly out of scope**: authentication/authorization, security hardening, performance or
  scalability requirements, visual design polish beyond basic usability and responsiveness (a
  design system, animations, accessibility auditing, and branding are not requirements;
  responsive layout across mobile and desktop viewports IS a requirement per the frontend bullet
  above), deployment or infrastructure practices. These MUST NOT be added as requirements to
  specs or plans for this project unless this constitution is amended first.

## Development Workflow

- Work proceeds through the Spec Kit flow: constitution → specify → clarify → plan → tasks →
  implement, in that order, for each feature.
- Each note operation (create, view/list, update, delete) is implemented across all three layers
  (repository → service → router) in the same change, with its service-layer unit test included.
- Code review (self or peer) MUST verify: correct layer placement of new code, presence of a
  passing test for the feature, and presence of a log entry for any new mutating action.
- No feature is merged/considered complete if it violates Principle I (layering), II (testing),
  or III (logging) without an explicit, documented exception approved via a constitution
  amendment.

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
  storage mechanism, or skips a required test or log entry MUST be checked against this
  constitution before being accepted; unresolved conflicts block completion of the feature.

**Version**: 1.1.0 | **Ratified**: 2026-08-23 | **Last Amended**: 2026-08-25
