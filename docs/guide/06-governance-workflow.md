# 06 - Governance Workflow

The governance workflow moves assets from draft intake to approved or deployed operation while preserving review history and enforcing policy gates.

## Status Lifecycle

Assets begin as DRAFT. A risk owner or admin can move an asset to UNDER_REVIEW. An approver or admin can move eligible assets to APPROVED, then DEPLOYED. Deployed assets can be RETIRED when no longer in use.

Invalid transitions are rejected. Each transition records actor, from status, to status, timestamp, and optional comments.

## Policy Gates

Approval and deployment are blocked when linked open or in-progress HIGH/CRITICAL risks exist. This prevents unresolved high exposure from being hidden by a lifecycle status.

MODEL and SERVICE assets also require a sufficiently complete Model Card. Missing Model Card fields are returned to the UI and displayed in the approval banner.

## Segregation Of Duties

The user who moved an asset to UNDER_REVIEW cannot approve that same asset. The risk creator cannot transition their own risk to ACCEPTED. These controls prevent single-person self-approval of material governance decisions.

## Recertification

Recertification schedules define review cadence and next due date. Dashboard and notification tooling highlight overdue and due-soon items so deployed AI assets are periodically reviewed after approval.
