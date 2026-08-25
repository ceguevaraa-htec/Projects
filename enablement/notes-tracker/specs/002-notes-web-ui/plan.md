# Implementation Plan: Notes Web UI

**Branch**: `002-notes-web-ui` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-notes-web-ui/spec.md`

## Summary

Add a multi-page web UI (list, create, edit) over the existing notes REST API, served as
static files from the existing Express app — no separate frontend project, no build step, no
framework. Vanilla JS is split into small, importable modules (not inline scripts) so the pure
logic (validation, preview truncation, timestamp formatting, and delete-row DOM removal) can be
unit-tested with Vitest + jsdom; full multi-page navigation flows are validated manually via an
extended quickstart.md, since that requires a running server and real browser navigation rather
than something jsdom cheaply provides. One shared, hand-written responsive stylesheet covers
all three pages, matching constitution v1.1.0's frontend constraint.

## Technical Context

**Language/Version**: TypeScript on Node.js for the existing backend (unchanged); plain
JavaScript (ES modules, no TypeScript, no transpilation) for the frontend, per constitution's
frontend constraint

**Primary Dependencies**: `express.static` (already available via the existing `express`
dependency) to serve the frontend; no new runtime dependency. `jsdom` added as a dev dependency
so Vitest can exercise DOM-manipulating frontend logic in a browser-like environment without a
real browser

**Storage**: No change — the existing in-memory `Map<string, Note>` behind the REST API. This
feature adds no server-side state; the browser fetches/mutates notes entirely through the
existing endpoints.

**Testing**: Vitest (existing), with `jsdom` as the test environment for a new
`tests/unit/frontend/` suite covering pure/DOM logic: content-preview truncation, timestamp
formatting, form validation (empty/whitespace title or content), and delete-row DOM removal.
Full end-to-end multi-page flows (page navigation, redirects after submit, the actual `fetch`
calls hitting a running server) are **not** unit-tested — see research.md for why — and are
instead covered by an extended `quickstart.md` manual validation pass, consistent with how
001-notes-crud-service's quickstart.md was used.

**Target Platform**: Desktop and mobile web browsers (frontend); existing Node.js server
process (backend, unchanged)

**Project Type**: Single project — the frontend is added as a `public/` directory served by
the existing Express app, not a separate frontend project/process

**Performance Goals**: None specified — out of scope per constitution (not a production system)

**Constraints**: No frontend framework, no CSS framework/library, no build step/bundler, no
TypeScript on the frontend, responsive layout required at ~375px and ~1280px+ (constitution
v1.1.0 Technology Constraints)

**Scale/Scope**: 3 static pages (list/create/edit) + 1 shared stylesheet + a handful of small
JS modules, over the existing 5-endpoint REST API — no new backend endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Constraint | Check | Status |
|---|---|---|
| I. Layered Architecture | No change to the backend's repository/service/router layering; the frontend is a presentation layer that only calls the existing API, introducing no new backend layer violations | PASS |
| II. Test-First Development | Frontend pure/DOM logic (validation, truncation, formatting, delete-row removal) gets Vitest+jsdom unit tests; this doesn't apply to the backend, which is unchanged | PASS |
| III. Observability via Structured Logging | No new mutating backend actions are introduced (the UI calls the existing create/update/delete endpoints, which already log); no new logging requirement is created | PASS |
| IV. Simplicity & Minimal Dependencies | Frontend uses no framework and no CSS framework/library, per Principle IV's explicit frontend clarification; only dev dependency added is `jsdom`, needed for the testing story above | PASS |
| Technology Constraints (Frontend) | Plain HTML/CSS/vanilla JS, served as static files by the existing Express app, no build step/bundler beyond serving static files, responsive at mobile/desktop widths via CSS flexbox/grid + media query | PASS |
| Technology Constraints (out-of-scope items) | No auth/accounts added; no design system, animations, or accessibility auditing attempted beyond basic usability/responsiveness | PASS |

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-notes-web-ui/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── pages.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
public/                        # NEW — served as static files by the existing Express app
├── index.html                 # the list page (served at "/")
├── create.html
├── edit.html
├── styles.css                 # single shared, hand-written responsive stylesheet
└── js/
    ├── api.js                 # fetch wrappers for GET/POST/PATCH/DELETE /notes
    ├── format.js              # pure: truncateContent(), formatTimestamp()
    ├── validation.js          # pure: validateNoteForm({ title, content })
    ├── list.js                # index.html page logic: load, render, delete handling
    ├── create.js               # create.html page logic
    └── edit.js                 # edit.html page logic

src/
├── app.ts                     # MODIFIED — adds express.static(public/) before the API routes
└── ... (existing backend files, unchanged)

tests/
├── unit/
│   ├── notes.service.test.ts  # existing, unchanged
│   └── frontend/              # NEW
│       ├── format.test.ts
│       ├── validation.test.ts
│       └── list-dom.test.ts   # jsdom: renders a note list, then verifies delete removes the row
└── integration/
    └── notes.router.test.ts   # existing, unchanged
```

**Structure Decision**: Single project — the frontend lives in a new `public/` directory at
the repository root, served as static files by the existing Express app (`src/app.ts` gets one
new `express.static` line; no new server process, no separate frontend project). This matches
the user's explicit instruction and keeps Option 1 (single project) from the base template
rather than the frontend/backend split option, since there is exactly one server process and
one deployable unit. Frontend JS is split into small ES modules under `public/js/` (not inline
`<script>` tags) specifically so the pure/DOM logic is importable by Vitest+jsdom tests under
`tests/unit/frontend/` — this is the one structural choice driven by the testing decision in
research.md, not by the constitution (which doesn't require it).
