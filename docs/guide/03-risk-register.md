# 03 - Risk Register

The Risk Register tracks AI risks across frameworks, assets, and projects. Each risk can be linked to multiple assets and projects, avoiding duplicate records for the same recurring issue.

## Risk Fields

Source Framework and Category tie each risk to NIST AI RMF, EU AI Act, or OWASP LLM Top 10 reference categories. Description explains the risk in plain language. Likelihood and impact are 1-5 values multiplied into the inherent risk score.

Residual risk score, treatment plan, owner, due date, and status document how the organization is responding. Status values are OPEN, IN_PROGRESS, MITIGATED, and ACCEPTED.

## Severity Bands

Severity is computed by the backend from inherent score so all UI and reports use one source of truth. The bands are LOW, MEDIUM, HIGH, and CRITICAL. High and critical open risks can block asset approval/deployment.

## Heatmap And Bulk Actions

The Risk Register heatmap groups risks by likelihood and impact. Clicking a cell filters the table to that combination. The table supports selecting multiple risks and applying bulk status updates where permissions allow.

## Linking

Risks can be linked to assets and projects. Asset links show where the risk applies technically. Project links show business use cases affected directly. Project risk views merge direct project risks with risks inherited from linked assets.

## EU AI Act Tier Suggestion

When creating or editing a risk, the UI can suggest an EU AI Act tier based on the selected framework category or selected asset data-classification keywords. The suggestion is non-binding; users must confirm or override it before saving.

## STRIDE-AI and MITRE ATLAS Mapping

Each risk also carries a **STRIDE-AI category** (`MODEL_IMPERSONATION`,
`DATA_MODEL_POISONING`, `PROVENANCE_LOSS`, `MODEL_INVERSION`, `RESOURCE_EXHAUSTION`,
`ALIGNMENT_BYPASS`) and a **MITRE ATLAS technique**. These enrich an existing
OWASP/NIST/EU risk row — they do not replace its framework anchor.

When a risk is OWASP LLM Top 10-linked, both fields auto-fill from a seeded lookup
table (`GET /reference/stride-atlas-map`) when left blank; an explicit value always
overrides, and either field can be cleared or changed afterwards. For NIST- or
EU-framework risks the fields are set manually.

The Risk Register list adds a `STRIDE-AI` filter and a sortable `STRIDE-AI / ATLAS`
column. On the asset detail and risk detail pages every linked risk shows all four
references (OWASP/NIST + EU tier + STRIDE-AI + ATLAS) together. Both values are also
emitted in the CycloneDX export as `aibom:risk:strideAiCategory` and
`aibom:risk:atlasTechnique`.

A worked example is in [`docs/examples/poisongpt.md`](../examples/poisongpt.md).
