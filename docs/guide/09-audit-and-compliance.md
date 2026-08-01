# 09 - Audit And Compliance

AI-BOM is designed to leave reviewable evidence behind each governance action.

## Audit Log

Mutating API routes create audit log entries with entity type, entity ID, action, actor, before JSON, after JSON, and timestamp. Risk detail and asset detail pages surface relevant audit history.

## Asset Field History

Asset detail includes a Field History panel that renders before/after diffs from audit logs. Reviewers can answer what changed, who changed it, and when without manually inspecting raw JSON.

## Archive Not Delete

Linked risks and controls are archived instead of hard-deleted so historical project, asset, and audit context remains intact. Hard delete is only used for unlinked records where no relationship evidence would be lost.

## CSV Export

CSV exports are available for assets and risks and respect the same filters as list endpoints. Values are quote-escaped and protected against formula injection: cells starting with `=`, `+`, `-`, `@`, tab, or carriage return are prefixed with a leading single quote before export.

## Evidence Packages

Use CycloneDX, SPDX, CSV, audit history, Model Cards, and workflow records together as an evidence package for AI governance reviews, supplier reviews, risk acceptance, and deployment approval.
