# NFR Requirements — Unit 1: Inventory API

## Scalability
- **Requirement**: Single local instance, low-concurrency internal tool (per requirements.md). No horizontal scaling, load balancing, or capacity planning is in scope.
- **Status**: Settled in Requirements Analysis — no new decision needed here.

## Performance
- **Requirement**: No specific latency/throughput target — a local SQLite-backed API serving a single user at a time has no meaningful performance NFR beyond "responds promptly for interactive use," which standard FastAPI + SQLite easily satisfies at this data scale.
- **Status**: No specific benchmark required; not a design driver for this unit.

## Availability
- **Requirement**: Out of scope — no HA/DR, no failover. If the process stops, the tool is simply unavailable until restarted (acceptable for a local/demo tool).
- **Status**: Resiliency Baseline extension opted out in Requirements Analysis.

## Security
- **Requirement**: Out of scope — no authentication/authorization, no encryption-at-rest requirement, no threat model beyond standard input validation (already covered by the exception hierarchy's `ValidationError`).
- **Status**: Security Baseline extension opted out in Requirements Analysis.

## Reliability
- **Error Handling**: Fully specified in Functional Design (`business-rules.md`) — 4-exception hierarchy, global exception handler, structured `{"error_code", "message"}` response.
- **Logging**: Python standard-library `logging` module, plain human-readable formatter, output to `stdout`. Every caught exception (including the 500 safety-net case) is logged with: timestamp, logger name (module), exception type, message, and the endpoint/method that was being handled. No log aggregation infrastructure is assumed or required (consistent with the local/demo deployment model).
- **Fault Tolerance**: Not applicable beyond the transaction-atomicity guarantees already specified in Functional Design (a failed check-then-write leaves no partial state).

## Maintainability
- **Testing**: pytest + pytest-cov targeting ≥70% coverage (NFR2). Unit tests target components/services in isolation using an in-memory SQLite database (via SQLAlchemy's `sqlite:///:memory:` engine) to avoid disk I/O and test-order coupling; integration tests exercise the full FastAPI app against a temporary on-disk SQLite file.
- **Property-Based Testing**: Per the Requirements Analysis decision (Partial), applied to pure functions and serialization round-trips — concretely: `dollars_to_cents()`/`cents_to_dollars()` (a natural round-trip pair) and any Pydantic request/response schema (de)serialization.
- **Code Organization**: Follows `unit-of-work.md`'s directory layout (`backend/app/{db,components,services,api}`, `backend/tests/{unit,integration}`).
- **Documentation**: FastAPI's auto-generated `/docs` (Swagger UI) and `/openapi.json` serve as the living API reference — no separately maintained API documentation file, per the Units Generation decision.

## Usability
- **Status**: Not applicable to this unit — Unit 1 has no user interface. Usability (delete/soft-delete UX, error-message surfacing, destructive-action confirmation) is addressed in Unit 2's Functional Design.

## Tech Stack Selection Summary
See `tech-stack-decisions.md` for the finalized stack and rationale.
