# Backend for Frontend Contract: Team Allocation Platform

**Document Version:** 1.0
**Created:** 2026-09-22
**Project Name:** Team Allocation Platform
**Source Documents:**
- UX/UI Design: specs/UX-Team-Allocation-Platform.md
- SDP: specs/SDP-Team-Allocation-Platform.md
**API Contract Specification:** specs/contracts/openapi-spec.yaml

---

## 1. UX Flow Mapping

| UX Flow/Screen | Required Endpoints | Purpose |
|---|---|---|
| Employee Management (list, create, edit, delete) | `GET /employees`, `POST /employees`, `GET /employees/{employeeId}`, `PATCH /employees/{employeeId}`, `DELETE /employees/{employeeId}` | List/search/filter employees; view a single employee (with embedded skills and current assignments); create/edit employee core fields; delete (blocked server-side if assignments exist). |
| Employee Management — skill association sub-form | `POST /employees/{employeeId}/skills`, `PATCH /employees/{employeeId}/skills/{skillId}`, `DELETE /employees/{employeeId}/skills/{skillId}` | Add, update proficiency on, or remove a skill association for an employee. |
| Skills Catalog (list, create, edit, delete with confirmation) | `GET /skills`, `POST /skills`, `PATCH /skills/{skillId}`, `GET /skills/{skillId}/deletion-impact`, `DELETE /skills/{skillId}` | Manage the shared skill catalog; preview affected-record counts before a destructive delete (ADR-0013). |
| Project Management (list, create, edit, delete) | `GET /projects`, `POST /projects`, `GET /projects/{projectId}`, `PATCH /projects/{projectId}`, `DELETE /projects/{projectId}` | List/search/filter/sort projects; view a project (with embedded required roles); create/edit, including status changes validated server-side against the UX Spec's transition graph (Draft→Active→{Completed,Cancelled}, Draft→Cancelled; no path back from Completed or Cancelled); delete (blocked server-side if assignments exist). |
| Project Management — required-role sub-form | `POST /projects/{projectId}/roles`, `PATCH /projects/{projectId}/roles/{roleId}`, `DELETE /projects/{projectId}/roles/{roleId}` | Add/edit/remove a required role on a project (removal blocked server-side if assignments reference it). |
| Assignments — create/edit form with skill-match indicator | `GET /projects/{projectId}/roles/{roleId}/candidates`, `POST /assignments`, `GET /assignments/{assignmentId}`, `PATCH /assignments/{assignmentId}`, `DELETE /assignments/{assignmentId}` | List candidate employees with server-computed skill-match tier; create/edit (future-dated only) an assignment with capacity validation; cancel (future-dated only). |
| Bench View (Now/30/60/90 days) | `GET /bench?window=now\|30d\|60d\|90d` | Return underutilized employees for the selected fixed window. |
| PDF Reports (org-wide/per-employee/per-project) | `GET /reports/org`, `GET /reports/employees/{employeeId}`, `GET /reports/projects/{projectId}` | Generate and stream the corresponding PDF report scope. |
| Employee Self-Service — "select yourself" step | `GET /employees?sort=name` | Populate the employee picker shown when switching to the Employee role (UX gap identified during this contract's design — see Design Rationale). |
| Employee Self-Service — My Assignments | `GET /employees/{employeeId}/my-assignments` | Return the selected employee's own current, future, and past assignments plus current utilization %, scoped strictly to that employee. |

---

## 2. Design Rationale

This contract translates the UX Specification's eight features into a single, flat REST resource model — Employees, Skills, Projects (with nested Roles), and Assignments — plus three read-only aggregate endpoints (Bench, Reports, Candidates) that expose the SDP's centralized Domain Logic rather than requiring the frontend to compute anything itself.

### Key Design Decisions

- **No pagination, no API versioning:** Given demo-scale data (tens of employees, per the PRD) and a single frontend consumer with no external API clients, both would add ceremony with no corresponding benefit. Lists are returned in full; a version prefix can be introduced later if a second consumer ever appears.
- **Skill-match tier computed server-side (`matchTier` field):** The candidates endpoint (`GET /projects/{projectId}/roles/{roleId}/candidates`) returns each employee alongside a computed `matchTier` (`strong` | `partial` | `no_match` | `no_requirement`), directly reusing the SDP's centralized Domain Logic (NFR-0009/ADR-0005) rather than shipping the tiering rules to the frontend, where they could drift from the same logic used elsewhere.
- **Dedicated preview endpoint for skill deletion (ADR-0013):** `GET /skills/{skillId}/deletion-impact` is a side-effect-free, cacheable GET that returns affected employee/role counts; the actual `DELETE /skills/{skillId}` remains a plain, unambiguous action. This avoids overloading DELETE with confirmation-state query parameters.
- **Embedded payloads over chatty calls:** `GET /employees/{employeeId}` includes the employee's skills and current assignments inline, and `GET /projects/{projectId}` includes its required roles inline. This matches the project's "boring/simple" philosophy (SDP §3.3) and avoids unnecessary round trips for a local, low-latency system where there's no caching benefit to splitting requests.
- **Direct PDF binary response:** Report endpoints return `Content-Type: application/pdf` directly in the HTTP response body — no intermediate storage, download token, or polling step — consistent with the SDP's in-process, single-deployable PDF generation (ADR-0006).
- **Consistent error envelope:** Every non-2xx response returns `{ "error_code": "SCREAMING_SNAKE_CASE", "message": "..." }` per SDP NFR-0005/ADR-0009, defined once as a shared schema (`ErrorResponse`) in the OpenAPI spec and reused across all endpoints.
- **Explicit "select yourself" step for Employee self-service:** The UX Specification's Access & Session Management flow and Employee Journey describe switching to the Employee role and landing directly on "My Assignments," but neither describes how the system determines *which* employee that is, given there is no authentication. This contract requires an explicit employee-selection step (`GET /employees?sort=name` populates a picker) before `GET /employees/{employeeId}/my-assignments` can be called. **This is a gap in the UX Specification, not just an API-design detail** — it will be backfilled into the UX Spec as a follow-up after this document is finalized, adding an intermediate "select yourself" step to the Access Flow diagram and the Employee Journey.
- **Hard-block validations surfaced as structured errors, not generic 400s:** Capacity-exceeded, inactive-project, and past-assignment-edit/delete rejections each get a distinct `error_code` (e.g., `CAPACITY_EXCEEDED`, `PROJECT_NOT_ACTIVE`, `ASSIGNMENT_NOT_EDITABLE`) so the frontend can show the specific messages already defined in the UX Spec's Notifications sections, rather than a single generic validation-failure message.
- **Project status transitions enforced server-side (`INVALID_STATUS_TRANSITION`):** The UX Spec's Appendix flags the status transition graph (Draft→Active→{Completed,Cancelled}, Draft→Cancelled; no path back from Completed or Cancelled) as a UX-layer assumption requiring confirmation during backend/API design. This contract resolves it: `PATCH /projects/{projectId}` validates any status change against that graph and rejects an invalid transition (e.g., Completed→Active) with a structured `INVALID_STATUS_TRANSITION` error, rather than leaving enforcement as a UI-only constraint. This follows the same server-side, centralized-Domain-Logic pattern already used for every other hard-block rule in the system (capacity, active-project-only assignment, future/past edit restrictions) — a UI-only constraint here would be the one exception to that pattern, bypassable by any direct API call or future second client.

### UX Flow Support

Every feature section in the UX Specification maps to a contiguous set of endpoints above with no leftover UX capability unaddressed: CRUD screens map to standard resource CRUD endpoints; the Bench view's four fixed windows map to a single parameterized endpoint rather than four separate ones; the three PDF report scopes map to three endpoints under one `/reports` namespace; and the Assignments feature's advisory skill-match indicator is delivered pre-computed so the assignment form never needs its own copy of the tiering logic.

### Trade-offs and Alternatives

- **Nested roles as sub-resources of Projects** (`/projects/{projectId}/roles`) was chosen over a flat top-level `/project-roles` collection, since roles have no independent existence outside their project (per the SDP's entity relations) and nesting keeps the URL structure self-documenting. The trade-off is a slightly longer path for role-specific operations like candidates lookup (`/projects/{projectId}/roles/{roleId}/candidates`), accepted for the clarity gain.
- **A dedicated `/bench` and `/reports` namespace** was chosen over folding these into `/employees` or `/projects` query parameters, since both are read-only aggregate views spanning multiple entities rather than filtered views of a single resource — conflating them would have made the Employees/Projects endpoints' query parameter surface harder to reason about.
- **GET-based preview for skill deletion** (ADR-0013) was chosen over a two-phase DELETE (e.g., `DELETE ?confirm=false` then `?confirm=true`) specifically because a GET is safe, idempotent, and cacheable by nature, whereas overloading DELETE's semantics with a confirmation flag blurs the line between a preview and an actual mutating action — a distinction worth preserving even at solo-project scale, since it costs nothing extra here and avoids a REST anti-pattern.

---

**End of Document**
