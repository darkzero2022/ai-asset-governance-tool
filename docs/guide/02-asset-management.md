# 02 - Asset Management

Assets are the governed AI components in the inventory: models, datasets, services, and libraries. The Assets page is the main entry point for creating, editing, filtering, and exporting asset records.

## Core Fields

Name and version identify the component being governed. Type distinguishes model, dataset, service, and library records. Supplier and provider capture who produced and who operates the component.

Hosting Model describes packaging or hosting: SaaS API, self-hosted, or embedded in an application. Network Dependency separately captures connectivity: air-gapped, hybrid, or fully connected. This distinction lets a self-hosted model still be marked as dependent on external telemetry or update services.

License, data classification, training data provenance, downstream consumers, and source URL provide compliance and supply-chain context. Source URL is a citation trail for imported vendor pages, model cards, or internal documentation.

## Lifecycle

Assets move through DRAFT, UNDER_REVIEW, APPROVED, DEPLOYED, and RETIRED. The Governance Workflow panel shows transition history, reviewer identity, comments, and timing.

APPROVED and DEPLOYED transitions are blocked when required policy gates fail. See [Governance Workflow](06-governance-workflow.md) for details.

## URL Import

The asset form includes Import from URL. Fetching a URL returns suggested title, description, and body excerpt. The app does not silently copy suggestions into governance fields; users decide what to copy and edit. The source URL itself is stored as a citation.

The backend import path blocks private, loopback, and link-local addresses, rejects unsupported protocols, limits response size, and revalidates redirects before fetching.

## Dependencies

The asset detail page shows dependency relationships so a service can declare which model, dataset, or library assets compose it. This supports AI-SBOM depth and impact analysis when a dependency changes.

## Exports

Asset exports include CycloneDX and SPDX evidence. CycloneDX includes AI-BOM properties, linked risks, controls, Model Card data, structured metrics, and source URL external references when present.
