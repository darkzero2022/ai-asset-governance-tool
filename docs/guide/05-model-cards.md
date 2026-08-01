# 05 - Model Cards

Model Cards document model and AI service behavior, intended use, limitations, fairness considerations, and performance metrics. They are required for approval/deployment of MODEL and SERVICE assets.

## Required Content

The form captures task, approach, architecture family, model architecture, datasets, inputs, outputs, intended users, use cases, technical limitations, performance tradeoffs, ethical considerations, fairness assessments, environmental considerations, and optional performance metrics JSON.

Completeness scoring identifies missing governance fields and displays the percentage complete. Approval/deployment policy gates use this score for MODEL and SERVICE assets.

## Structured Metrics

Structured metric rows capture metric name, numeric value, slice, and timestamp. These rows power cross-model comparison in the Dashboard and are exported into CycloneDX Model Card quantitative analysis.

Use structured metrics for values such as accuracy, F1, AUC, false positive rate, toxicity score, latency, or slice-specific fairness measurements. Keep the JSON field for narrative or legacy metric payloads that do not fit normalized rows.

## URL Import

Model Card editing includes Import from URL. Fetching a vendor model card or internal documentation page shows title, description, and excerpt suggestions. Users copy useful details into the real fields and edit them before saving.

## Governance Gate

An incomplete Model Card blocks APPROVED and DEPLOYED transitions for MODEL and SERVICE assets. The approval banner shows missing fields so owners know what to fill before resubmission.
