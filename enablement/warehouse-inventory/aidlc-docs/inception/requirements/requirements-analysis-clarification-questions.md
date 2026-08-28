# Requirements Analysis — Clarification Questions

Your answer to Question 2 selected **"REST API plus a simple web UI"**, which introduces scope the original question set didn't cover: the UI's technology and how much of the functionality it needs to expose. Please resolve the following before I finalize the requirements document.

## Clarification 1: UI Implementation Approach
How should the web UI be implemented?

A) Server-rendered HTML templates (Flask + Jinja2), no separate frontend build step — simplest to keep in a single Python app

B) Static HTML/CSS + vanilla JS calling the REST API via fetch, served as static files by Flask

C) A separate single-page app framework (e.g. React) built and served independently from the API

D) Other (please describe after [Answer]: tag below)

[Answer]: B

## Clarification 2: UI Scope
What should the web UI expose?

A) Full functionality: category/product CRUD, stock adjustment forms, sortable/filterable product listing with per-category totals, and adjustment history view

B) Read-only views only (product listing with sort/filter, category totals, adjustment history) — all create/update/delete/stock-adjustment operations done via the API directly (e.g. Postman), not through the UI

C) Other (please describe after [Answer]: tag below)

[Answer]: B

---

**Note on Question 4 (Product CRUD)**: You answered "Yes" instead of a letter. I'm interpreting this as **Option A — full product CRUD plus separate stock-adjustment endpoints**, since that's the only option starting with "Yes." No action needed unless that's wrong — if so, note it after [Answer]: below.

[Answer]:
