# AI-BOM Governance Guide

This guide is the operator and user manual for the AI-BOM Governance application. It covers setup, day-to-day governance workflows, evidence exports, auditability, and operations.

Start here:

- [01 - Getting Started](01-getting-started.md): prerequisites, install modes, `setup.sh` and a scriptless manual path, start/stop, verification, first login, troubleshooting.
- [02 - Asset Management](02-asset-management.md): AI asset fields, lifecycle, dependencies, exports, URL imports.
- [03 - Risk Register](03-risk-register.md): risk creation, scoring, heatmap, bulk updates, linking, EU AI Act suggestions.
- [04 - Projects](04-projects.md): projects, reuse tracking, project risks, project SBOM exports.
- [05 - Model Cards](05-model-cards.md): Model Card fields, completeness, metrics, policy gates.
- [06 - Governance Workflow](06-governance-workflow.md): status transitions, approvals, recertification, segregation of duties.
- [07 - RBAC And Users](07-rbac-and-users.md): roles, permissions, ownership scoping, user management.
- [08 - Dashboard](08-dashboard.md): dashboard panels, search, exposure, coverage, metrics.
- [09 - Audit And Compliance](09-audit-and-compliance.md): audit log, field history, archive-not-delete, CSV export safety.
- [10 - Operations](10-operations.md): scripts, backups, restore, deployment, recurring jobs.

The local install mode runs Node backend/frontend processes on the host while Postgres remains in Docker. The Docker install mode runs the full stack in containers.
