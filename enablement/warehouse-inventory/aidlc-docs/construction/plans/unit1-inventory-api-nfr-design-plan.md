# NFR Design Plan — Unit 1: Inventory API

## Execution Checklist
- [x] Step A: Finalize DB session/connection lifecycle pattern — **FastAPI `Depends(get_session)`, one session per request** (Q1: A)
- [x] Step B: Finalize SQLite concurrent-write handling — **`PRAGMA busy_timeout`** (Q2: A)
- [x] Step C: Finalize logger configuration pattern — **`logging.basicConfig()` at startup + `getLogger(__name__)` per module** (Q3: A)
- [x] Step D: Generate `nfr-design-patterns.md`
- [x] Step E: Generate `logical-components.md`

## Category Coverage Notes
- **Scalability Patterns**: N/A — out of scope per NFR Requirements (single local instance, no scaling mechanism needed).
- **Security Patterns**: N/A — out of scope per NFR Requirements (no auth/threat model in scope).
- **Performance Patterns**: No specific latency/throughput target exists to optimize against (per NFR Requirements); the one performance-adjacent decision that *does* need to be made is DB connection handling under FastAPI's threaded request handling — folded into Question 1/2 below rather than a separate performance question.

## Clarifying Questions

### Question 1: DB Session/Connection Lifecycle Pattern
`business-rules.md` requires one session per check-then-write service method, explicitly shared across component calls within that method. How should FastAPI wire this up?

A) **FastAPI dependency injection** (`Depends(get_session)`) creates one SQLAlchemy `Session` per incoming HTTP request, injected into the router function, which passes it down into the service method call — the router never creates its own session, and the same session instance flows through every component call made during that request (recommended — matches FastAPI's idiomatic per-request-scoped resource pattern, and guarantees exactly one session per request without extra bookkeeping)

B) A single, module-level global `Session` shared across all requests — simpler wiring, but risks cross-request interference and doesn't match SQLAlchemy's recommended one-session-per-unit-of-work practice

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2: SQLite Concurrent-Write Handling
SQLite serializes writes at the file level; even in this project's low-concurrency/single-instance scope, two near-simultaneous requests (e.g. two browser tabs) can still hit a transient "database is locked" error.

A) Configure SQLAlchemy's SQLite engine with a busy-timeout (e.g. `PRAGMA busy_timeout=5000`) so a write waits briefly for a lock to clear instead of failing immediately — no explicit retry loop needed in application code; this is a connection-level setting, not a resilience pattern under NFR1/NFR3's remit) (recommended — solves the realistic transient-lock case with one config line, no added code complexity)

B) No special handling — let a locked-database error surface as the generic 500 case through the global exception handler; accept the rare failure as acceptable for this project's scope

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3: Logger Configuration Pattern
A) One `logging.basicConfig(...)` call at application startup (in `main.py`) sets the format/level/stream for the whole app; each module obtains its logger via `logging.getLogger(__name__)` so log lines show which module raised them (recommended — standard Python idiom, matches the plain-formatter/stdout decision from NFR Requirements)

B) A single shared logger instance imported by every module (no per-module `__name__` distinction in log output)

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

**Note**: After you answer, I will analyze responses for ambiguity, ask follow-ups if needed, and then generate `nfr-design-patterns.md` and `logical-components.md`.
