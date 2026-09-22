# Project Brief: Team Allocation Platform

## Executive Summary

The Team Allocation Platform is an internal resource-planning tool that helps a single organization's Resource/Delivery Managers see who is working on what, in which role, and for how long — and lets employees see their own assignments and utilization in a simple, read-only view. It addresses the kind of problems that ad-hoc spreadsheet-based tracking typically causes: double-booking, invisible bench time, and slow staffing decisions when a new project needs to be resourced. By modeling employees, skills, projects, and capacity-bounded assignments in one system, managers can instantly find available, skilled people, avoid over-allocation, and generate utilization reports on demand. This is a demo-scale, single-organization practice build (no multi-tenancy, no real authentication) intended to prove out the resourcing workflow end-to-end with synthetic data.

**Key Information:**
- **Product Concept:** A resourcing tool that tracks employee-to-project assignments, roles, and capacity over time, with bench visibility and PDF reporting.
- **Primary Problem:** Spreadsheet-based resourcing causes double-booking, invisible bench time, and slow staffing decisions.
- **Target Market:** A single internal organization's Resource/Delivery Management function (demo/practice scale, tens of employees).
- **Key Value Proposition:** One place to see who's available, who's overbooked, and who's on the bench — before it becomes a staffing crisis.

---

## Problem Statement

Managers responsible for staffing projects typically rely on spreadsheets, memory, and ad-hoc conversations to track who is assigned where. This works only as long as the team is small and stable — as soon as project count or team size grows, the tracking mechanism breaks down in predictable ways: assignments get made without checking whether an employee already has other commitments, capacity gets tracked inconsistently (or not at all) so people end up allocated to more than 100% of their time, and there's no single view of who is sitting idle and could be staffed onto a new project. When a new project needs to be resourced quickly, the manager has no fast, reliable way to answer "who is available, with the right skills, right now?" — so staffing decisions are slow, and gaps between projects go unnoticed until utilization has already been lost.

**Analysis:**
- **Current State & Pain Points:** Assignment data lives in spreadsheets or informal notes with no built-in constraint checking, so double-booking and over-capacity assignments happen silently; there is no consolidated, real-time view of bench (unassigned/underutilized) staff, current or forward-looking.
- **Impact:** Slower staffing turnaround when new projects arise, overbooked employees discovered only after the fact, and underutilized employees who go unnoticed and unstaffed longer than necessary.
- **Why Existing Solutions Fall Short:** General-purpose spreadsheets have no concept of capacity limits, skill matching, or conflict detection — every safeguard is manual and error-prone, and there is no dedicated forward-looking bench view.
- **Urgency:** N/A for this practice build — the problem framing is illustrative motivation for a net-new system, not a response to a documented, time-sensitive business event.

### Out of Scope for Entire Product
- Payroll and compensation management
- Time tracking / timesheet capture
- Performance reviews and performance management
- Hiring / recruiting workflows
- Real authentication and authorization (credentialed accounts, login, permissions enforcement)

---

## Proposed Solution

The Team Allocation Platform centers on three linked entities — employees, projects, and assignments — with capacity as a first-class constraint. Employees carry a seniority level and a set of skill tags with proficiency ratings. Projects define a timeframe and the functional roles they need, each with a target capacity %. Assignments connect an employee to a project in a specific role at a specific capacity %, and the system enforces that no employee's assignments ever sum to more than 100% at any point in time, and that assignments don't silently overlap in conflicting ways. On top of this model, the platform gives managers a real-time and forward-looking bench view (who's unassigned or underutilized, now and in upcoming periods), full search/filter/sort across employees, projects, and skills, and one-click PDF exports of allocation and utilization data. A simple employee-list UI surfaces current utilization and project assignments at a glance — the fastest path to answering "who's free and what are they good at?"

**Solution Overview:**
- **Core Concept:** A capacity-aware assignment model (employee × project × role × capacity %) that makes over-booking and scheduling conflicts structurally hard to create, paired with search/reporting tools built around the two questions managers actually ask: "who's free?" and "who's overloaded?"
- **Key Differentiators:** Built-in capacity enforcement (not a manual spreadsheet check); a dedicated forward-looking bench view, not just a current-state snapshot; skill+proficiency matching baked into the data model rather than free-text notes.
- **Success Factors:** Keeps the data model deliberately simple (tag-based skills, functional per-assignment roles, no financial/billing data) so the core allocation and conflict-prevention logic stays correct and easy to reason about, rather than being diluted by tangential features.
- **Product Vision:** Long-term, this becomes the system of record a Resource/Delivery Management function checks first before making any staffing decision — the natural home for "who can I put on this project starting Monday?"

---

## Target Users
- **Resource/Delivery Manager** — owns org-wide staffing decisions; creates and manages employees, projects, and assignments, monitors bench/utilization across the whole organization, and generates PDF allocation reports.
- **Employee** — a read-only consumer of their own data; views their current assignments, role(s), and utilization percentage, with no visibility into other employees' data or org-wide bench information.

---

## Goals & Success Metrics

### Business Objectives

- Demonstrate a working capacity-aware resourcing model that eliminates over-allocation by construction, not by manual review.
- Reduce the time it takes a manager to identify an available, skilled employee for a new project need.
- Improve visibility into unstaffed/underutilized capacity ("bench") so it can be acted on proactively rather than discovered after the fact.

### User Success Metrics

- A manager can find a qualified, available employee for a given role in a few clicks/searches rather than manually cross-checking a spreadsheet.
- A manager can produce a shareable PDF utilization report on demand, without manual compilation.
- An employee can immediately see their own current and upcoming assignments and utilization without asking their manager.

### Key Performance Indicators (KPIs)

- **Over-allocation incidents:** Number of employees assigned above 100% capacity at any point — target: zero (enforced structurally, not just measured).
- **Time-to-identify-candidate:** Time for a manager to find a suitably skilled, available employee for an open project role — target: materially faster than manual spreadsheet lookup (qualitative for this demo build, no baseline to compare against).
- **Bench visibility coverage:** Percentage of unassigned/underutilized capacity that is visible in the current + forward-looking bench view — target: 100% (all underutilized employees surfaced, none invisible).

---

## MVP Scope

### Core Features (Must Have)

- **Employee management:** Create/manage employees with name, employment dates, seniority level, and skill tags (each with a proficiency level). Foundation for every matching, capacity, and reporting feature.
- **Project management:** Create/manage projects with start/end dates and required functional roles, each with a target capacity %. Defines the demand side of the allocation model.
- **Capacity-safe assignment creation:** Assign an employee to a project in a role at a given capacity %, with enforcement that no employee ever exceeds 100% total capacity. This is the core value proposition — without it, the tool is just a data entry form.
- **Bench view (current + forward-looking):** Org-wide view of unassigned/underutilized employees, both right now and in upcoming periods. Directly answers "who's free to staff next?"
- **Search, filter, and sort:** Across employees, projects, and skills. Needed to make the data usable at any scale beyond a handful of records.
- **PDF report generation:** Downloadable reports of team allocations and utilization. Explicit hard requirement; primary artifact managers take away from the tool.
- **Employee list UI with current utilization:** A simple page listing employees alongside their current utilization % and project assignments — the at-a-glance view of the whole system's state.
- **Employee self-service view:** Read-only view of the logged-in employee's own current assignments and utilization, via a role-switcher (no real authentication).

### Out of Scope for MVP

- Multi-tenant / multi-organization support
- Real authentication, login, and permissions enforcement
- Approval workflows for assignments (single manager has full authority)
- Billing rates, cost/margin, or any financial data
- Certifications or complex skill taxonomies/categories beyond simple tags + proficiency
- Integrations with external HR/PM tools

---

## Post-MVP Vision

### Phase 2 Features

Configurable capacity-conflict rules (e.g., date-range overlap policies distinct from the raw 100% cap), richer skill taxonomies/categories, multiple concurrent report formats (e.g., CSV/Excel export alongside PDF), saved/favorite filter views, and basic what-if staffing scenarios (e.g., "if I assign X to Project Y, who's left on the bench?").

### Long-term Vision

Over 1-2 years, the platform could grow into a lightweight system of record for resourcing that a real organization actually relies on day-to-day — which would require introducing real authentication/authorization, audit history on assignment changes, and role-based permissions (e.g., project owners who can request staff vs. managers who approve). It would also likely need to formalize the scheduling-conflict semantics flagged in Open Questions below into explicit, configurable business rules.

### Expansion Opportunities

Multi-organization/multi-tenant support for a staffing or consulting firm managing several client engagements; integrations with external HR systems (for employee data) and PM tools (for project data) to reduce duplicate data entry; notifications/alerts (e.g., "this employee becomes available next week" or "this project is understaffed"); manager-facing what-if capacity planning tools for hypothetical future assignments.

---

## Risks & Open Questions

### Key Risks

- **Ambiguous conflict-prevention semantics:** If the distinction between "capacity overlap" and "date-range overlap" (see Open Questions) isn't resolved before design, the assignment engine could be built to enforce the wrong rule, undermining the core value proposition.
- **Data model rigidity:** Keeping skills, roles, and seniority deliberately simple is a strength for MVP, but if real-world scenarios during synthetic data generation reveal the model is too simple to produce realistic test cases, MVP scope may need light revisiting.
- **Report scope creep:** PDF reporting is a hard requirement with an open-ended surface area (allocations, utilization, bench, filtered views); without early bounding, this could expand well past MVP effort.

### Open Questions

- Is the "no overlapping or over-capacity assignments" rule a single constraint (sum of capacity % ≤ 100 across overlapping date ranges), or two distinct rules — one for capacity totals and a separate one for date-range overlap regardless of percentage (e.g., disallowing two roles on the same dates even if capacity allows it)? This needs to be resolved during PRD/Design, not assumed.
- What does "forward-looking" mean concretely for the bench view — a fixed horizon (e.g., next 30/60/90 days), or unbounded based on project end dates?
- Should PDF reports be scoped to a single employee/project, or support org-wide multi-employee/multi-project exports, and are there specific layout/content expectations?

### Areas Needing Further Research

- Realistic synthetic data generation patterns — what distribution of employees, skills, projects, and assignments best exercises edge cases like over-assignment and bench detection.
- PDF generation approach suited to a locally-deployable, demo-scale build.
- Concrete UI/UX approach for the role-switcher (manager vs. employee view) given there's no real authentication.

---
