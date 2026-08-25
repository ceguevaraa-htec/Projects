# Phase 0 Research: Notes Web UI

Most technical decisions were specified directly by the user or fixed by the project
constitution (v1.1.0). One decision — how far to take automated frontend testing — was
explicitly left to this plan to resolve; that's the only substantive research item below.

## Decision: Serve the frontend from the existing Express app via `express.static`

- **Rationale**: Explicit user requirement ("no separate server process"); `express` is
  already a dependency, so `express.static` adds zero new runtime dependencies. Matches
  constitution's frontend constraint (served as static files by the existing Express app).
- **Alternatives considered**: A separate lightweight static server (constitution allows it as
  an alternative) — rejected because the user explicitly asked to reuse the existing app, and
  it avoids running two processes for a single-purpose learning project.

## Decision: Plain HTML + vanilla JS, split into small ES modules rather than inline scripts

- **Rationale**: Explicit user requirement (plain HTML/CSS/vanilla JS, no build step, no
  TypeScript on the frontend). Splitting JS into small files under `public/js/` (`api.js`,
  `format.js`, `validation.js`, plus one file per page) rather than writing it inline in each
  HTML file is a structural choice made specifically to satisfy the testing decision below:
  Vitest can `import` a standalone `.js` module directly, but can't easily import a `<script>`
  block embedded in an HTML file without extra tooling — and extra tooling would violate the
  no-build-step constraint.
- **Alternatives considered**: Inline `<script>` tags per page — simpler to read in isolation,
  but would leave the pure logic (validation, truncation, formatting) untestable without
  introducing an HTML-parsing test harness, which is more machinery than a small `import`-based
  module split.

## Decision: Vitest + jsdom for the frontend's pure/DOM logic; manual quickstart.md for full page flows

This was the one point the user explicitly left to this plan's judgment ("if full DOM testing
adds too much complexity for this scope, rely on the existing quickstart-style manual
validation approach instead and note that explicitly as a plan decision").

- **Decision**: Add `jsdom` as a dev dependency and write Vitest unit tests for exactly the
  logic that's cheap and valuable to test in isolation: `truncateContent()`,
  `formatTimestamp()`, `validateNoteForm()`, and a small DOM-rendering/removal function used by
  the list page to add/remove note rows. These are pure functions or small, self-contained DOM
  operations — testing them doesn't require a running server, a real browser, or page
  navigation.
- **What is explicitly NOT unit-tested, and why**: The full page flows — "load `index.html`,
  it fetches `GET /notes` over the network, renders the page, user clicks a link, browser
  navigates to `edit.html?id=...`, page fetches `GET /notes/:id`, user submits, browser
  redirects back to `index.html`" — involve real network calls and real page navigation.
  Reproducing that in jsdom would mean mocking `fetch` end-to-end and simulating
  `window.location` navigation across "page loads" that don't really happen in a single jsdom
  document — at that point the test is mostly exercising the mocks, not the real integration
  between pages, the static file server, and the API. That full-flow verification is exactly
  what `quickstart.md` (extended for this feature) already does well: a running server, real
  HTTP requests, real page loads via curl/browser, matched against contracts/pages.md and the
  existing contracts/notes-api.md.
- **Rationale for the split**: this keeps test infrastructure proportionate to the project's
  learning/practice scope (constitution Principle IV) while still giving the riskiest, easiest
  to silently break logic — "does the form actually reject an empty title?", "does deleting a
  row actually remove it from the DOM?" — real, fast, repeatable coverage.
- **Alternatives considered**: A headless-browser end-to-end suite (e.g. Playwright) — gives
  real multi-page coverage but is a materially larger dependency/tooling footprint than this
  project's scope calls for (constitution Principle IV: no dependency not strictly needed);
  rejected. Testing nothing on the frontend at all — rejected because the constitution's
  test-first spirit (Principle II) and the user's explicit ask both call for *some* automated
  coverage where it's cheap to get.

## Decision: One shared `styles.css`, flexbox/grid + a single media query breakpoint

- **Rationale**: Explicit user requirement; matches constitution's responsive requirement
  (~375px and ~1280px+) without a CSS framework (constitution Principle IV frontend note).
- **Alternatives considered**: Per-page stylesheets — rejected as unnecessary duplication for
  three pages sharing the same look; a CSS framework (Bootstrap/Tailwind) — explicitly
  prohibited by the constitution.

## Decision: Delete confirmation via native `confirm()`, optimistic-on-success DOM removal

- **Rationale**: Explicit user requirement; `confirm()` needs no dependency and matches the
  spec's Assumptions (destructive actions get a confirmation step). Removing the row from the
  DOM directly (rather than reloading the page) satisfies FR-010/SC-004's "no full page reload"
  requirement directly.
- **Alternatives considered**: A custom modal/dialog — more code and more CSS for a
  learning-scope project with no other modal use case (Principle IV: no premature
  abstraction); rejected in favor of the built-in `confirm()`.

## Output

All technical decisions are resolved; no `NEEDS CLARIFICATION` markers remain. Ready for Phase 1
design.
