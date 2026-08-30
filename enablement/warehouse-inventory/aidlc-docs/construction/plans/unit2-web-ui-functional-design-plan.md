# Functional Design Plan — Unit 2: Web UI

## Execution Checklist
- [x] Step A: Resolve hard-delete-vs-soft-delete API signal gap — **modify Unit 1**: DELETE endpoints return `200 OK` `{"outcome": ...}` (Q1: A)
- [x] Step B: Finalize destructive-action confirmation mechanism — **`window.confirm()`** (Q2: A)
- [x] Step C: Finalize error-message display mechanism — **inline message area per action** (Q3: A)
- [x] Step D: Finalize error-code-to-message mapping ownership — **`ERROR_MESSAGES` lookup in `api-client.js`, fallback to raw message** (Q4: A)
- [x] Step E: Finalize page/navigation structure — **one `index.html`, JS show/hide sections** (Q5: A)
- [x] Step A.1: Apply the Unit 1 change from Step A (modify `categories.py`/`products.py`/`schemas.py`, update Unit 1's integration tests, re-run full Unit 1 suite — 64 passed, 94% coverage, unchanged)
- [x] Step F: Generate `business-logic-model.md` (UI interaction flows, not backend logic)
- [x] Step G: Generate `business-rules.md` (client-side validation rules only — see note below)
- [x] Step H: Generate `domain-entities.md` (UI-side view-model shapes, not DB entities)
- [x] Step I: Generate `frontend-components.md` (component hierarchy, state, API integration points)

## Context Analyzed
Unit 2 implements 4 stories (UI-1..4), each a thin consumer of a Unit 1 endpoint group, per `unit-of-work-story-map.md`. Application Design already fixed the technology (single-page static app: `index.html` + `api-client.js`/`categories.js`/`products.js`/`stock.js`, centralized `fetch` + error-message translation). This Functional Design stage was specifically un-skipped (Workflow Planning) to design: (1) how delete vs. soft-delete is presented, (2) confirmation-before-destructive-action, (3) how the 3 API-level rejection cases surface as user-facing messages. Unit 2 has no server-side business rules of its own — "business-rules.md" here documents client-side-only concerns (e.g. disabling a submit button while a request is in flight), not data invariants (those live in Unit 1).

## ⚠️ Real Gap Found: the DELETE response doesn't say which branch happened
Unit 1's `DELETE /categories/{id}` and `DELETE /products/{id}` both return **204 No Content** on success, regardless of whether a hard delete or a soft delete occurred (see `unit1-inventory-api/functional-design/business-logic-model.md`). But this stage's entire reason for existing is to design *distinct* UX for those two outcomes — which requires knowing which one happened. This needs a decision before UI flows can be designed (Question 1).

## Clarifying Questions

### Question 1: Hard-Delete-vs-Soft-Delete Signal
How should the UI know which outcome occurred, so it can show the right message ("Category permanently deleted" vs. "Category archived — it still has products")?

A) **Modify Unit 1**: change both DELETE endpoints from `204 No Content` to `200 OK` with a small JSON body `{"outcome": "hard_deleted" | "soft_deleted"}` — the most accurate signal, at the cost of a small, already-tested Unit 1 change (its own test suite would need the two delete-outcome assertions updated to check the new body instead of just the 204 status) (recommended — the UI can't reliably message the user otherwise, and Unit 1 is still ours to adjust)

B) **UI-side prediction, no Unit 1 change**: since the category/product listing the UI already has loaded shows a category's referencing-product count (or, for a product, whether it has any visible history), the UI predicts the outcome *before* calling delete and messages accordingly — no API change, but a rare race condition (data changed between page load and delete) could make the predicted message wrong

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2: Destructive-Action Confirmation Mechanism
A) A native browser `window.confirm("...")` dialog before any delete call — zero extra UI code, sufficient for a small internal tool (recommended — matches the project's overall "no framework, keep it simple" direction)

B) A custom in-page modal dialog (styled HTML/CSS, no framework) — more consistent look, more code to build and test

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3: Error-Message Display Mechanism
When an API call returns an error (any of the documented error codes), how should the message reach the user?

A) An inline message area directly above/below the form or action that triggered the request (e.g. a `<div class="error-message">` shown next to the "Create Product" form when creation fails) — contextual, no extra UI chrome needed (recommended)

B) A global toast/notification area fixed at the top of the page, shared across all actions

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4: Error-Code-to-Message Mapping Ownership
`business-rules.md` (Unit 1) already defines a stable `error_code` catalog (e.g. `STOCK_WOULD_GO_NEGATIVE`, `CATEGORY_INACTIVE`). Should the UI:

A) Maintain its own explicit `ERROR_MESSAGES` lookup object in `api-client.js` mapping each known `error_code` to a friendly sentence, falling back to the API's own `message` field for any code not in the map (recommended — keeps translation centralized per Application Design's decision, and never silently drops an error the backend added later)

B) Always display the backend's raw `message` field directly, with no UI-side translation layer

C) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5: Page / Navigation Structure
A) One `index.html` with three sections toggled via simple JS show/hide (no router library): **Categories** (list + create/rename/delete), **Products** (list + sort/filter + create/update/delete + stock adjustment + history), and a shared header with section-switching buttons/tabs (recommended — matches the single-page static app decision, minimal JS needed for navigation)

B) Two or more separate static HTML files (e.g. `categories.html`, `products.html`) navigated via normal `<a href>` links (full page reloads)

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

**Note**: After you answer, I will analyze responses for ambiguity (especially Question 1, since it may require touching Unit 1), ask follow-ups if needed, and then generate `business-logic-model.md`, `business-rules.md`, `domain-entities.md`, and `frontend-components.md`.
