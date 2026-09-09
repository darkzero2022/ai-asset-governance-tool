# AI Asset Governance Tool — Product Overview

## Executive summary

Organizations are adopting AI faster than they can govern it. Models get plugged into products, datasets get reused across teams, and nobody owns a single answer to "what AI do we actually have, what's the risk, and who signed off on it." The AI Asset Governance Tool is a purpose-built system of record for exactly that problem: a governed inventory of every AI model, dataset, service, and library in use, a structured risk register aligned to recognized frameworks (NIST AI RMF, EU AI Act, OWASP LLM Top 10), an enforced approval workflow that won't let something ship with unresolved risk, and audit-ready export in industry-standard formats (CycloneDX AI-BOM/ML-BOM, SPDX). It replaces the spreadsheet-and-email version of AI governance with one system that assesses, approves, tracks, and proves compliance.

## The problem this solves

- **No single inventory.** AI usage is scattered across teams, vendors, and internal builds, with no shared record of what exists, who owns it, or what data it touches.
- **Risk assessment is ad hoc.** When it happens at all, it lives in a spreadsheet with no scoring consistency, no link back to a recognized framework, and no history of what changed.
- **Nothing stops a risky asset from shipping.** Status labels like "Approved" are just a field someone edits — there's no enforcement tying approval to an actual resolved risk posture.
- **No standard compliance evidence.** When an auditor or a customer asks "give us your AI-BOM," there's nothing to hand them in a format their tools can even validate.
- **No accountability trail.** Who approved this? Who accepted that risk? Was it the same person who created it? Most organizations can't answer that today.

## What it does, and the value it brings

### 1. AI Asset Inventory — one system of record

Every model, dataset, service, and library tracked with the fields that actually matter for risk: hosting model (SaaS API / self-hosted / embedded), network dependency (air-gapped / hybrid / fully connected — a distinct, often-missed risk dimension), data classification, training data provenance, and license. **Value:** the question "what AI do we have and where does our data go" finally has one answer instead of five conflicting spreadsheets.

### 2. Risk Register — structured, framework-aligned, not ad hoc

Risks are scored on a consistent likelihood × impact matrix, automatically banded into severity (LOW/MEDIUM/HIGH/CRITICAL), and mapped to a real framework category — not free-typed. A heatmap and sortable table make portfolio-wide risk exposure visible at a glance instead of buried in row 400 of a spreadsheet. **Value:** consistent, comparable risk data across the whole AI portfolio, ready to present to a risk committee without translation.

### 3. Projects & reuse tracking — know your blast radius

A single shared model or service (e.g. one internal LLM API) can be linked to every business use case that depends on it, with a real reuse count. **Value:** when a vulnerability or license issue is found in one component, you immediately know every downstream project it affects — instead of finding out by asking around.

### 4. Model Cards & real ML-BOM — documentation that's actually usable

Structured model documentation (task, architecture, intended use, technical limitations, ethical and fairness considerations, quantitative performance metrics) exported as native CycloneDX `modelCard` data — not custom properties nobody else's tooling can read. **Value:** documentation that satisfies both the internal reviewer and an external auditor's tooling, produced once.

### 5. Governance workflow with real policy gates

An asset cannot move to Approved or Deployed while it has an open high/critical risk, or while a MODEL/SERVICE asset's Model Card is incomplete — this is enforced by the system, not a checklist someone can skip. **Value:** "Approved" stops being a label anyone can set and starts being a status that's actually earned.

### 6. RBAC, ownership, and segregation of duties

Four roles with a real permission matrix, ownership scoping (you can only edit what you created, unless you're an admin), and enforced segregation of duties: the person who moved an asset to review cannot be the one who approves it, and a risk's creator cannot be the one who accepts it. **Value:** the same self-approval problem an external auditor would flag in a SOC 2 or ISO 27001 review is closed by design, not by policy memo.

### 7. Full audit trail

Every mutation — asset edits, risk changes, workflow transitions, control updates — is logged with actor, timestamp, and before/after state, including a field-level history view on every asset. **Value:** "who changed this and when" is always answerable, without digging through email threads.

### 8. Compliance-grade exports

CycloneDX (AI-BOM/ML-BOM) and SPDX documents, validated against the real published schemas before they're handed to anyone — plus filtered CSV export of the inventory and risk register for the people who just need a spreadsheet. **Value:** one click produces evidence in the format auditors, customers, and supply-chain tooling actually expect.

### 9. Dashboard — portfolio visibility without asking anyone

Severity distribution, framework coverage gaps (which OWASP/NIST/EU AI Act categories have zero risk coverage — a real blind-spot finder), a reuse leaderboard, Model Card completeness across the portfolio, and a recertification due-list, all in one view. **Value:** a security lead can answer "how exposed are we" without pulling five people into a meeting.

### 10. Proactive, not just reactive

A scheduled job flags overdue/due-soon recertifications and assets stuck in Draft/Under Review too long, pushed to Slack — so governance debt surfaces on its own instead of waiting to be discovered during an audit.

### 11. Import from a URL

Paste a link to existing model documentation and get an editable suggestion for the Model Card fields instead of retyping a vendor's page by hand — built with real SSRF protections since it's a security tool fetching arbitrary URLs.

### 12. Actually operable, not just a prototype

One setup script offers a real choice — install everything locally or run the full stack in Docker, start empty or with a demo dataset — plus start/stop scripts and backup/restore with destructive-action confirmation built in. **Value:** this isn't a proof of concept that only runs on one engineer's laptop; it's something IT can stand up, back up, and hand off.

## Value by stakeholder

| Stakeholder                     | What they get                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Security/GRC team**           | One system of record instead of scattered spreadsheets; consistent, framework-aligned risk scoring; a defensible audit trail for every decision              |
| **AI/engineering teams**        | A clear, predictable approval gate — know exactly what's required (resolved risk + a complete Model Card) before something can ship                          |
| **Compliance/audit/leadership** | Exportable, schema-valid evidence (CycloneDX/SPDX/CSV) on demand; built-in segregation of duties that answers an auditor's first question before they ask it |
| **IT/operations**               | Self-hostable, scriptable setup in two modes, backup/restore with safety rails, no vendor lock-in                                                            |

## How this compares to the alternative

- **vs. spreadsheets** — structured data, enforced workflow, real audit trail, consistent scoring; not a document anyone can silently edit.
- **vs. generic GRC platforms** — purpose-built for AI: Model Cards, ML-BOM export, EU AI Act tiers, and the OWASP LLM Top 10 are first-class, not force-fit into a generic risk template.
- **vs. nothing** — most organizations today have no AI governance system at all. This establishes the baseline.

## Current stage

Solid enough for a real internal pilot today — the governance mechanics above are implemented and tested, not just designed. Known next steps before a wider multi-team rollout: broader documentation depth, and expanding automated test coverage as new features land.
