# Requirements Clarification Questions — Warehouse Inventory System

Please answer each question by filling in the letter choice after the `[Answer]:` tag. If none of the options match, choose the last option (Other) and describe your preference. Let me know when you're done.

## Question 1
What technology stack should be used to implement the system?

A) Node.js / TypeScript (Express + better-sqlite3 or similar)

B) Python (FastAPI/Flask + SQLite via sqlite3/SQLAlchemy)

C) Java (Spring Boot + SQLite via JDBC)

D) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 2
How should users interact with the system?

A) REST API only (consumed by Postman/curl/another frontend, no UI built here)

B) REST API plus a simple web UI

C) Command-line interface (CLI) only

D) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 3
Should the system support full CRUD for **categories** (create, rename, delete), or are categories a fixed/seed list?

A) Full CRUD for categories via the API

B) Categories are seeded/fixed (e.g. Beverages, Snacks, Household) and not user-manageable

C) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
Should the system support full CRUD for **products** (create, update details, delete), in addition to stock adjustments?

A) Yes — full product CRUD (name, price, code, category) plus separate stock-adjustment endpoints

B) No — only stock quantity changes; products are seeded/fixed

C) Other (please describe after [Answer]: tag below)

[Answer]: Yes

## Question 5
What information should be captured for each stock adjustment history record?

A) Timestamp, product, quantity delta, and resulting balance only

B) Timestamp, product, quantity delta, resulting balance, plus a reason/note field (e.g. "restock", "sale", "damaged")

C) All of B, plus a user/actor identifier who made the change

D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
Does this system need user authentication / authorization (login, roles), or is it single-user / trusted-environment for now?

A) No auth needed — single-user or trusted internal tool (recommended for this scope)

B) Basic authentication (username/password) required

C) Role-based access control (e.g. admin vs. staff) required

D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 7
What sorting and filtering capabilities are needed for product listings?

A) Sort by name/price/stock, filter by category and stock-level threshold (e.g. low stock)

B) Sort by name/price/stock only, filter by category only

C) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 8
Is this intended as a single-instance local/demo application, or does it need to support concurrent multi-client access with strict transactional guarantees?

A) Single local instance / demo / low-concurrency internal tool (recommended for SQLite scope)

B) Must support meaningful concurrent write load from multiple clients

C) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question: Resiliency Extensions
Should the resiliency baseline be applied to this project?

**What this extension is.** Enabling it applies a set of **directional, design-time best practices** for building resilient systems, derived from the **AWS Well-Architected Framework (Reliability Pillar)** and resilience-review guidance. It steers requirements, design, and code toward fault tolerance, high availability, observability, and recoverability — covering 15 practice areas across business goals, change management, observability, high availability, disaster recovery, and continuous improvement.

**What this extension is NOT.** Enabling it does **not** make your workload production-ready, nor does it certify or guarantee any availability, RTO, or RPO target. It is a **starting point** that scaffolds good resiliency decisions early — it is not a substitute for a formal **AWS Well-Architected Review** of the built system.

Treat the output as a well-grounded **first draft of your resiliency posture** to build on and validate — not a finished, production-certified result.

A) Yes — apply the resiliency baseline as directional best practices and design-time guidance (recommended for business-critical workloads, as an informed starting point that you can validate and harden before go-live)

B) No — skip the resiliency baseline (suitable for PoCs, prototypes, and experimental projects where rapid iteration matters more than reliability)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)

B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)

B) Partial — enforce PBT rules only for pure functions and serialization round-trips (suitable for projects with limited algorithmic complexity)

C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers with no significant business logic)

X) Other (please describe after [Answer]: tag below)

[Answer]: B
