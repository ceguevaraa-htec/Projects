<!--
Sync Impact Report
- Version change: (unratified template) → 1.0.0
- Modified principles: n/a (initial ratification — template placeholders replaced)
- Added sections:
  - Core Principles: I. Upstream SDD Chain Is Authoritative, II. Layered Architecture &
    Centralized Domain Logic, III. Test-First Development, IV. Structured Observability &
    Consistent Error Contract, V. Simplicity & Fixed Technology Stack
  - Scope Boundaries (Section 2)
  - Development Workflow & Traceability (Section 3)
  - Governance
- Removed sections: none (first fill of the template scaffold)
- Templates requiring updates: .specify/templates/plan-template.md, spec-template.md,
  tasks-template.md, checklist-template.md — ⚠ pending manual review to confirm each still
  aligns with the traceability and upstream-authority rules below (not modified by this command
  per its scope guard).
- Follow-up TODOs: none — all placeholders resolved from user-supplied input and the existing
  SDD artifacts in specs/.
-->

# Team Allocation Platform Constitution

## Core Principles

### I. Upstream SDD Chain Is Authoritative
This project's Spec Kit stages build on an already-completed, human-reviewed SDD chain and MUST
treat it as binding rather than re-derive or re-litigate it. The authoritative documents are:
Product Brief (`specs/Product-Brief-Team-Allocation-Platform.md`), PRD with 27 functional
requirements (`specs/PRD-Team-Allocation-Platform.md`), Technical Constraints
(`specs/TECH-CONSTRAINTS-Team-Allocation-Platform.md`), Solution Design Plan with 9 NFRs and 13
ADRs (`specs/SDP-Team-Allocation-Platform.md`), UX Specification v1.1
(`specs/UX-Team-Allocation-Platform.md`), and the BFF Contract with its OpenAPI spec
(`specs/BFF-CONTRACT-Team-Allocation-Platform.md`, `specs/contracts/openapi-spec.yaml`). The BFF
Contract and OpenAPI spec are the single source of truth for every endpoint, request/response
schema, and error code — `/speckit.specify` and `/speckit.plan` MUST reference them directly and
MUST NOT re-derive API shapes from scratch. Any change that would contradict a decision already
ratified in these documents requires amending the source document first, not overriding it
silently at a later Spec Kit stage.

### II. Layered Architecture & Centralized Domain Logic
The system MUST follow the three-layer architecture ratified in the SDP: REST API (Express
routes) → Domain Logic → data access (Kysely over SQLite). Domain Logic is the single owner of
capacity validation, bench computation, skill-match tiering, date/overlap comparison, and
report-data assembly; these rules MUST NOT be duplicated or reimplemented in route handlers, the
frontend, or any other caller (SDP ADR-0005). All date/time comparisons — "today," overlap
detection, and window computation — MUST go through the one shared date-comparison utility
mandated by SDP NFR-0009. Rationale: centralization is what keeps the capacity rule, the
edit/delete restrictions, and the bench/report numbers from silently drifting apart as the
codebase grows.

### III. Test-First Development
Domain Logic changes MUST be covered by Vitest unit tests achieving greater than 70% coverage
(SDP NFR-0001), explicitly including the edge cases already enumerated there: over-assignment/
over-capacity attempts, boundary values (0% and 100% capacity), and past/future date-boundary
conditions on assignment edit/delete rules. Every feature touching persistence MUST include
integration tests that run against a real SQLite database instance (not mocked), with the
database reset/cleaned up after each test run (SDP NFR-0002). Tests are written and expected to
fail before the corresponding implementation lands; this is NON-NEGOTIABLE for Domain Logic.

### IV. Structured Observability & Consistent Error Contract
Every API request MUST be logged as a structured JSON entry capturing timestamp, method, route,
duration, and status code, scoped to the HTTP boundary only — internal operations such as PDF
generation or capacity validation are not separately instrumented (SDP NFR-0003). Every API error
response, with no exceptions, MUST use the `{ error_code, message }` JSON envelope (SDP
NFR-0005/ADR-0009), with `error_code` in SCREAMING_SNAKE_CASE and a distinct code per validation
rule (e.g., `CAPACITY_EXCEEDED`, `PROJECT_NOT_ACTIVE`, `INVALID_STATUS_TRANSITION`) rather than a
single generic failure code, so the frontend can render the specific messages already defined in
the UX Specification's Notifications sections.

### V. Simplicity & Fixed Technology Stack
The technology stack is fixed and MUST NOT be expanded without amending the Technical
Constraints and SDP first: TypeScript on Node.js, Express, Kysely over SQLite (no ORM beyond
Kysely), Vitest, and a vanilla HTML/CSS/JS frontend with no SPA framework (ADR-0002). The system
MUST remain free of authentication/authorization infrastructure — the Manager/Employee split is
a client-side UI concept only (ADR-0011) — and free of cloud services, containerization, and
CI/CD (ADR-0012), consistent with the single local-machine deployment target. All dependencies
MUST use permissive open-source licenses (MIT, Apache 2.0, or equivalent); dependencies with
copyleft obligations (e.g., GPL) MUST NOT be introduced (SDP NFR-0008). Rationale: this is a
solo, local, demo-scale build with no team to onboard and no production deployment target —
every added technology or abstraction must earn its place against that reality.

## Scope Boundaries

The following are explicitly out of scope for the entire product, per the PRD's Scope
Exclusions, and MUST NOT be implemented under any feature or task in this project: payroll and
compensation management, time tracking/timesheet capture, performance reviews, hiring/recruiting
workflows, real authentication/authorization, multi-tenant/multi-organization support, approval
workflows for assignments, billing rates or any financial/cost data, complex skill taxonomies or
certifications beyond a simple catalog with proficiency levels, and integrations with external
HR/PM systems. A Spec Kit stage that encounters a request touching any of these MUST flag it as
out of scope rather than accommodate it, and MUST direct the requester back to the PRD if they
believe scope should change.

## Development Workflow & Traceability

Every feature specified, planned, or implemented through Spec Kit MUST be traceable to a
specific identifier from the upstream chain: `FR-xxxx` (PRD functional requirements), `NFR-xxxx`
(SDP non-functional requirements), or `ADR-xxxx` (SDP architectural decisions). `/speckit.specify`
MUST reference these IDs directly rather than restating the requirement in new language, since
restating risks introducing drift from the already-reviewed upstream documents. Any new
requirement discovered during Spec Kit work that has no corresponding upstream ID MUST be
flagged explicitly as a gap against the PRD/SDP/UX Spec — following the same pattern already
used throughout this project's SDD history (e.g., the UX Spec's flagged project-status-transition
and employee-self-service-identity gaps, later resolved and traced back into the BFF Contract) —
rather than silently implemented as an assumption. API-shape work in `/speckit.plan` MUST use the
OpenAPI spec (`specs/contracts/openapi-spec.yaml`) as the literal contract, not a description to
be reinterpreted.

## Governance

This constitution supersedes any conflicting practice adopted ad hoc during Spec Kit stages, but
it does not supersede the upstream SDD documents it is built from — where this constitution
summarizes an SDP/PRD/UX/BFF decision, the source document remains the detailed and binding
version, and a conflict between this constitution and a source document is a defect in this
constitution to be corrected, not a license to deviate from the source. Amendments to this
constitution that would contradict a ratified upstream decision (an ADR, an NFR, or a PRD
functional requirement) MUST NOT be made here — the correct amendment path is to first update the
relevant upstream document (PRD, SDP, UX Spec, or BFF Contract) through its own owning process,
and only then reflect that change here.

Amendment procedure: propose the change with its rationale and its upstream source (or note that
it is a new, unratified project convention), classify the change as MAJOR (backward-incompatible
principle removal or redefinition), MINOR (new principle or materially expanded guidance), or
PATCH (clarification or wording fix), update the version accordingly, and record the change in
the Sync Impact Report at the top of this file. Every plan, spec, and task produced by Spec Kit
MUST be checked for compliance with the Core Principles and Scope Boundaries above before being
accepted; unjustified complexity or scope creep relative to the upstream chain must be flagged
during review, not implemented and revisited later.

**Version**: 1.0.0 | **Ratified**: 2026-09-22 | **Last Amended**: 2026-09-22
