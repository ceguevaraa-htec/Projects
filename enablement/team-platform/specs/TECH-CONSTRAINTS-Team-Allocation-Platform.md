# Initial Technical Constraints: Team Allocation Platform

**Created:** 2026-09-18
**Stakeholder:** Cesar (solo practice build)

---

## Purpose

This document captures initial technical constraints from the client/stakeholder. These constraints will inform Architectural Decision Records (ADRs) during the system design phase.

**Note:** Answers are not required for any section. Responses can be incomplete, vague, or marked as "N/A" or "Unknown" at this stage.

---

## Infrastructure & Cloud

- No cloud provider — purely local, runs on the stakeholder's local machine only.
- No cloud service or region restrictions (not applicable — no cloud).
- No current hosting/infrastructure setup — net-new build with nothing existing to align with.

## Technology Stack

- Language/runtime: TypeScript on Node.js.
- No existing frameworks/technologies to align with — net-new build, no prior codebase.
- Mandated technologies: TypeScript, Express, Vitest, SQLite. No ORM mandated — open to architect's recommendation given the relational complexity of the domain.
- Prohibited technologies: anything requiring a paid license or cloud account; anything that assumes a production deployment target (e.g., Docker/Kubernetes tooling not needed).

## Integration & Data

- No existing systems requiring integration.
- Database: SQLite — firm constraint (not a soft preference), consistent with the stakeholder's other practice projects.
- No existing APIs or external services to connect with.

## Security & Compliance

- No security standards or compliance requirements apply (GDPR, HIPAA, SOC2, PCI-DSS, etc. — N/A). Synthetic data only, not intended for production use with real HR/employee data.
- No authentication/authorization infrastructure in place or required. The PRD's manager/employee role-switcher is a UI-level concept only — not backed by real auth/authz at the technical layer.
- No data residency or sovereignty requirements (synthetic, local-only data).

## Operations & Tooling

- No CI/CD tooling — run and tested locally.
- Monitoring/logging: structured JSON logging preferred over plain-text/stdout logs, specifically to satisfy the PRD's per-request execution-time tracking requirement (timestamp, endpoint, duration, status code). No specific library mandated — open to architect's recommendation (e.g., pino).
- Code repository platform: unknown/not applicable — may remain local-only or be pushed to GitHub later; not architecturally binding either way.
- Budget: none — everything runs locally with open-source/free tooling.
- License preference: permissive open-source licenses (MIT, Apache 2.0) for dependencies; avoid GPL or other copyleft-obligated licenses. General habit rather than a hard business requirement for this practice project.

## Additional Constraints

- None beyond what is captured above.
