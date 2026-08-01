# 07 - RBAC And Users

AI-BOM uses single-role RBAC with ownership scoping for risk-owner edits. Admins manage users from the Users page.

## Roles

ADMIN can manage users, create/edit assets and risks, approve transitions, delete/archive records, and export evidence.

RISK_OWNER can create and edit owned assets and risks, link controls/projects/assets where allowed, and move owned assets into review. Ownership is based on the creating user, not a free-text owner field.

APPROVER can perform approval/deployment/retirement transitions and accept risks where segregation-of-duties permits.

VIEWER can read inventory, risks, dashboards, and exports but cannot mutate governance records.

## User Management

Admins can create users, change role, deactivate users, and reset passwords. Deactivated users are rejected during authentication even if they still have a previously issued token.

## Ownership Scoping

Risk owners are limited to assets and risks they created for edit operations. Admins bypass ownership checks. This preserves delegated ownership without letting every risk owner rewrite every governance record.

## Practical Guidance

Use ADMIN sparingly. Assign RISK_OWNER to operational AI owners who prepare assets and risks. Assign APPROVER to compliance, model risk, or governance reviewers. Assign VIEWER to audit, architecture, and read-only stakeholders.
