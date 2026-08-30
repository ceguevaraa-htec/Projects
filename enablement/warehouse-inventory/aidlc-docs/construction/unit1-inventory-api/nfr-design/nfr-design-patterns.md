# NFR Design Patterns — Unit 1: Inventory API

## Pattern: Per-Request Session Scope (Dependency Injection)
- **Applies to**: NFR1 (Data Integrity), the shared-session rule in `business-rules.md`.
- **Pattern**: A FastAPI dependency `get_session()` yields one SQLAlchemy `Session` per incoming HTTP request (using the standard `yield`-based FastAPI dependency, which closes the session after the response is sent, or on exception). Every router function declares `session: Session = Depends(get_session)` and passes that exact `session` object into the one service-method call it makes. Services pass the same `session` into every component method they call within that method body — never opening a second session.
- **Why this satisfies NFR1**: Because all component calls within one request share one session/transaction, a commit (or rollback, on an exception propagating up) applies to every write made during that request atomically — exactly the guarantee `business-rules.md`'s transaction rules require, achieved through FastAPI's own request lifecycle rather than manual transaction bookkeeping in each service method.

## Pattern: SQLite Busy-Timeout (Transient Lock Handling)
- **Applies to**: Reliability, under the realistic (if rare) case of two near-simultaneous requests contending for a SQLite write lock.
- **Pattern**: The SQLAlchemy engine is created with `connect_args={"timeout": 5}` (SQLAlchemy's pysqlite dialect maps this to SQLite's `busy_timeout` pragma, in seconds) — a connection attempting a write against a locked database waits up to 5 seconds for the lock to clear before raising, rather than failing immediately.
- **Why this is a config setting, not a resilience feature**: This is a one-line engine configuration, not a retry loop, circuit breaker, or other resilience pattern — consistent with the Resiliency Baseline extension being opted out. It simply makes SQLite's own locking behavior tolerant of the sub-second overlap that can occur even in this project's low-concurrency scope (e.g. two browser tabs submitting near-simultaneously), without adding any application-level retry logic.
- **What happens beyond the timeout**: If the lock still hasn't cleared after 5 seconds, SQLAlchemy raises `OperationalError`, which is *not* one of the four domain exceptions — it falls through to the global exception handler's generic 500 case (per `business-rules.md`), logged with full context.

## Pattern: Per-Module Logger with Centralized Configuration
- **Applies to**: NFR3 (Error Handling / Logging).
- **Pattern**: `main.py` calls `logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", stream=sys.stdout)` exactly once at application startup. Every other module obtains its logger via `logger = logging.getLogger(__name__)` at module level, so every log line is automatically tagged with the originating module (e.g. `app.services.stock_adjustment_service`) without repeating configuration.
- **Where logging happens**: The global exception handler is the single place that logs *errors* (all four domain exceptions plus the generic-500 fallback), each with: timestamp (from the formatter), logger name (which layer raised it), the exception's `error_code` (domain exceptions) or exception class name (fallback), the human message, and the request path/method it occurred on. Services and components do not log directly — this avoids duplicate log lines for the same failure and keeps logging a single cross-cutting concern at the API boundary, matching NFR3's "global error catching with appropriate error logging" intent.

## Patterns Explicitly Not Applied (Out of Scope)
- No retry/circuit-breaker logic beyond the busy-timeout config above (Resiliency Baseline opted out).
- No caching layer — the data volumes and single-instance scope don't warrant one.
- No rate limiting, authentication middleware, or encryption-at-rest (Security Baseline opted out).
- No horizontal-scaling pattern (no load balancer, no stateless-session requirement beyond what's already true of a per-request SQLAlchemy session).
