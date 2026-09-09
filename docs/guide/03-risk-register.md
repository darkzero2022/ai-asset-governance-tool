# 03 - Risk Register

The Risk Register tracks AI risks across frameworks, assets, and projects. Each risk can be linked to multiple assets and projects, avoiding duplicate records for the same recurring issue.

## Risk Fields

Source Framework and Category tie each risk to a reference category in **NIST AI
RMF**, the **EU AI Act**, the **OWASP LLM Top 10**, or the **OWASP MCP Top 10**
(Model Context Protocol — draft v0.1; the framework picker labels it "(draft)").
Description explains the risk in plain language. Likelihood and impact are 1-5
values multiplied into the inherent risk score.

The exact revision of each framework is pinned (`GET /api/v1/reference/frameworks`)
and cited in every CycloneDX/SPDX export, so a past assessment stays reproducible
when a framework is updated.

Residual risk score, treatment plan, owner, due date, and status document how the organization is responding. Status values are OPEN, IN_PROGRESS, MITIGATED, and ACCEPTED.

## Severity Bands

Severity is computed by the backend from inherent score so all UI and reports use one source of truth. The bands are LOW, MEDIUM, HIGH, and CRITICAL. High and critical open risks can block asset approval/deployment.

## Heatmap And Bulk Actions

The Risk Register heatmap groups risks by likelihood and impact. Clicking a cell filters the table to that combination. The table supports selecting multiple risks and applying bulk status updates where permissions allow.

## Linking

Risks can be linked to assets and projects. Asset links show where the risk applies technically. Project links show business use cases affected directly. Project risk views merge direct project risks with risks inherited from linked assets.

## EU AI Act Tier Suggestion

When creating or editing a risk, the UI can suggest an EU AI Act tier based on the selected framework category or selected asset data-classification keywords. The suggestion is non-binding; users must confirm or override it before saving.

## STRIDE-AI, MITRE ATLAS, and the remediation plan

Each risk also carries a **STRIDE-AI category** (`MODEL_IMPERSONATION`,
`DATA_MODEL_POISONING`, `PROVENANCE_LOSS`, `MODEL_INVERSION`, `RESOURCE_EXHAUSTION`,
`ALIGNMENT_BYPASS`), a **MITRE ATLAS technique**, and a set of **MITRE ATLAS
mitigations** on its remediation plan. These enrich the framework anchor — they
do not replace it.

When a risk is linked to a framework category that has a **threat mapping**
(`GET /api/v1/reference/threat-mappings` — currently the OWASP LLM and OWASP MCP
Top 10s), the STRIDE-AI category, ATLAS technique, and suggested ATLAS mitigations
auto-fill from that mapping when left blank. An explicit value always overrides,
and every field can be cleared or changed afterwards. For NIST- or EU-anchored
risks the fields are set manually.

STRIDE-AI is a model-centric taxonomy, so several OWASP MCP entries
(infrastructure/agent threats such as *Shadow MCP Servers* or *Lack of Audit and
Telemetry*) map to the closest-fit STRIDE-AI category rather than an exact match.

## Cross-framework crosswalk

A risk classified under one framework shows its **related classifications** in
the others on the risk detail page — for example an `OWASP MCP Top 10 / MCP06`
risk shows `OWASP LLM Top 10: LLM01 (equivalent)` and `NIST AI RMF: MAP (related)`.
These relations are seeded reference data (`GET
/api/v1/reference/framework-crosswalk`) and are **this project's analysis, not an
official OWASP/NIST/MITRE crosswalk** — each carries a rationale (hover the pill).
Propose corrections with the *Framework mapping* issue template.

The Risk Register list adds a `STRIDE-AI` filter and a sortable `STRIDE-AI / ATLAS`
column. The CycloneDX export emits `aibom:risk:strideAiCategory`,
`aibom:risk:atlasTechnique`, `aibom:risk:atlasMitigation` (one per mitigation),
`aibom:risk:frameworkRevision`, and `aibom:risk:relatedClassification` (one per
crosswalk row).

A worked example is in [`docs/examples/poisongpt.md`](../examples/poisongpt.md).
