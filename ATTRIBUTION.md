# Attribution — incorporated standards and reference data

The application **code** in this repository is MIT-licensed (see `LICENSE`).

To classify AI risks, the tool ships **reference data** derived from public
security and governance frameworks. That text is included as attributed data —
it is **not** part of the MIT-licensed code and each source keeps its own
licence. If you redistribute this project (especially commercially), review the
licence of each framework whose text you carry.

The canonical, in-app copy of these details lives in the `FrameworkMeta` table
(`GET /api/v1/reference/frameworks`) and is cited in every CycloneDX/SPDX export.

| Framework                                                     | Revision used             | Where it appears                                             | Source                                                                      | Licence                                                                                                                                            |
| ------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NIST AI Risk Management Framework**                         | NIST AI 100-1 (Jan 2023)  | `FrameworkCategory` (GOVERN / MAP / MEASURE / MANAGE)        | <https://www.nist.gov/itl/ai-risk-management-framework>                     | U.S. Government work — not subject to copyright in the United States                                                                               |
| **EU Artificial Intelligence Act**                            | Regulation (EU) 2024/1689 | `FrameworkCategory` (risk tiers), `EuAiActRiskTierReference` | <https://eur-lex.europa.eu/eli/reg/2024/1689/oj>                            | © European Union, <https://eur-lex.europa.eu> — reuse authorised with acknowledgement of the source                                                |
| **OWASP Top 10 for LLM Applications**                         | 2025                      | `FrameworkCategory` (LLM01–LLM10)                            | <https://genai.owasp.org/llm-top-10/>                                       | CC BY-SA 4.0                                                                                                                                       |
| **OWASP Top 10 for MCP (Model Context Protocol)**             | Draft v0.1 (2025)         | `FrameworkCategory` (MCP01–MCP10)                            | <https://github.com/OWASP/www-project-mcp-top-10>                           | **CC BY-NC-SA 4.0 — non-commercial.** Draft; wording and categories may change.                                                                    |
| **MITRE ATLAS** (Adversarial Threat Landscape for AI Systems) | 2025 matrix               | `AtlasTechniqueReference`, `AtlasMitigationReference`        | <https://atlas.mitre.org/>                                                  | © 2025 The MITRE Corporation. ATLAS content is available for use under the terms at <https://atlas.mitre.org/> (Apache 2.0 for the framework data) |
| **STRIDE-AI**                                                 | as adapted here           | `StrideAiCategory` enum                                      | Threat-modelling taxonomy adapted for AI; category names are this project's | This repository (MIT)                                                                                                                              |
| **CycloneDX** specification & schemas                         | 1.7                       | `backend/vendor/`, export format                             | <https://cyclonedx.org/>                                                    | Apache 2.0                                                                                                                                         |
| **SPDX** specification & schemas                              | 2.3                       | `backend/vendor/`, export format                             | <https://spdx.dev/>                                                         | CC-BY-3.0 / Apache 2.0                                                                                                                             |

## Notes

- **OWASP MCP Top 10 is CC BY-NC-SA 4.0 (non-commercial).** The category titles
  and one-line descriptions in `backend/prisma/seed-reference.ts` are adapted from
  it. A commercial redistribution of this project should either replace that text
  with its own summaries or obtain permission from OWASP.
- **Cross-framework mappings** (`FrameworkCrosswalk`) and the
  category → STRIDE-AI / ATLAS mappings (`FrameworkThreatMapping`) are **this
  project's own analysis**, not official crosswalks. Each row records a
  `rationale`. Corrections are welcome — see `.github/ISSUE_TEMPLATE/framework_mapping.yml`.
- Framework revisions are pinned in `FrameworkMeta`; bumping a revision is an
  additive change (old rows are kept) so historical assessments stay reproducible.
