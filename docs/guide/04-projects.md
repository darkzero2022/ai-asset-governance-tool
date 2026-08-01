# 04 - Projects

Projects represent business AI use cases or applications that consume AI assets. They answer who uses an AI component, where risk exposure rolls up, and which assets belong in a project-level SBOM.

## Project Records

Each project has a name, description, business owner, and status. Status values are ACTIVE, INACTIVE, and RETIRED. Projects are created and maintained from the Projects page.

## Reuse Tracking

Link assets to projects to track reuse. Asset lists and detail pages show project usage count and linked projects. This helps identify highly reused components that deserve extra governance attention.

## Project Risks

Projects can have direct risks and inherited asset risks. The project detail view merges both sources and marks exposure so reviewers can see project-level risk without manually checking every asset.

## Project SBOM Export

Project CycloneDX export emits a BOM containing every asset linked to the project as components or services. Use this for business-system evidence packages, release reviews, and downstream consumers who need a project-level AI inventory.

## Operating Pattern

Create projects for applications, workflows, or use cases, not for technical components. Technical components belong in Assets. Link the same asset to multiple projects when it is reused; do not duplicate the asset record.
