# NFR Requirements Plan — Unit 1: Inventory API

## Execution Checklist
- [x] Step A: Finalize web framework — **FastAPI** (Q1: A)
- [x] Step B: Finalize persistence library / ORM approach — **SQLAlchemy** (Q2: A)
- [x] Step C: Finalize testing framework and coverage tool — **pytest + pytest-cov** (Q3: A)
- [x] Step D: Finalize logging approach — **stdlib `logging`, plain formatter, stdout** (Q4: A)
- [x] Step E: Finalize dependency management and Python version — **`requirements.txt` + `venv`, Python 3.12** (Q5: A)
- [x] Step F: Finalize schema-creation approach — **create-on-startup, no migrations** (Q6: A)
- [x] Step G: Generate `nfr-requirements.md`
- [x] Step H: Generate `tech-stack-decisions.md`

## Category Coverage Notes (categories not requiring a new question)
- **Scalability Requirements**: Already settled in requirements.md — single local instance, no high-concurrency requirement. No question needed.
- **Availability Requirements**: Out of scope per requirements.md (no HA/DR, Resiliency Baseline extension opted out). No question needed.
- **Security Requirements**: Out of scope per requirements.md (no auth, Security Baseline extension opted out). No question needed.
- **Usability Requirements**: N/A for this unit — Unit 1 has no UI; usability is addressed in Unit 2's Functional Design.
- **Reliability Requirements (error handling)**: Already fully specified in Unit 1's Functional Design (exception hierarchy, error codes, global handler). Only the *logging* half of reliability is still open — see Question 4.

## Clarifying Questions

### Question 1: Web Framework
requirements.md deferred the final FastAPI-vs-Flask choice to this stage; Units Generation already assumed FastAPI's auto-generated OpenAPI schema as the API contract.

A) **FastAPI** — confirms and finalizes the assumption already used in `unit-of-work-dependency.md` (OpenAPI-as-contract); gives request/response validation via Pydantic models, native async support (not required here, but no cost), and straightforward global-exception-handler registration matching the exception hierarchy already designed (recommended — avoids reworking an already-made dependent decision)

B) **Flask** — would require an add-on (e.g. `flask-smorest` or `apispec`) to produce the OpenAPI schema Unit 2 depends on, and manual request-validation code

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2: Persistence Library / ORM Approach
`business-rules.md` already uses "session" as the transaction/shared-context concept passed across component calls within one service method.

A) **SQLAlchemy** (Core or ORM) — gives an explicit `Session` object matching the shared-session requirement directly, supports swapping to an in-memory SQLite DB for unit tests without touching business logic, and generates the schema from Python model definitions (recommended)

B) Raw `sqlite3` standard-library module with hand-written SQL and a manually-passed `Connection` object as the "session" — no extra dependency, but more boilerplate for query building and no in-memory test-swap convenience beyond SQLite's own `:memory:` mode

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3: Testing Framework and Coverage Tool
To meet the ≥70% coverage NFR meaningfully (not just line-count padding):

A) **pytest** + **pytest-cov** (wraps `coverage.py`) — most common Python testing stack, supports fixtures well-suited to swapping in an in-memory SQLite DB per test, clear coverage reporting (recommended)

B) Standard-library `unittest` + `coverage.py` run separately — no extra test-runner dependency, more verbose test syntax

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4: Logging Approach
NFR3 requires "appropriate error logging" with context (timestamp, endpoint, error type/message).

A) Python's standard `logging` module, configured with a plain human-readable formatter (`%(asctime)s %(levelname)s %(name)s: %(message)s`), writing to `stdout` — simplest option, sufficient for a local/demo tool where logs are read directly in a terminal, not shipped to a log aggregator (recommended given the deployment-model decision already made in requirements.md)

B) Python's standard `logging` module configured with a structured JSON formatter — easier to grep/parse programmatically, more setup for a system that (per requirements.md) has no log-aggregation infrastructure to consume it

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5: Dependency Management and Python Version
A) A plain `requirements.txt` (pinned versions) + standard-library `venv`, targeting **Python 3.12** — lowest-friction setup for a local/demo project, no additional tooling to install (recommended)

B) **Poetry** (or another lockfile-based manager) for deterministic dependency resolution — more setup overhead, better reproducibility guarantees than this project's scope calls for

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6: Schema Creation Approach
A) **Create tables on application startup** if they don't already exist (e.g. `Base.metadata.create_all()` in SQLAlchemy) — no migration framework; appropriate for a greenfield app with no prior schema version to migrate from (recommended — Alembic-style migrations solve a problem this project doesn't have yet)

B) **Alembic** migrations from the start, even though there's no prior schema to migrate

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

**Note**: After you answer, I will analyze responses for ambiguity, ask follow-ups if needed, and then generate `nfr-requirements.md` and `tech-stack-decisions.md`.
