<!-- Thanks for contributing. Keep PRs focused; open an issue first for anything large. -->

## What & why

<!-- What does this change and why? Link the issue: Closes #123 -->

## Checklist

- [ ] `cd backend && npm run test && npm run build && npm run validate:cyclonedx` passes
- [ ] `cd frontend && npm run test && npm run build` passes
- [ ] `npx tsc --noEmit` is clean in `backend/` and `frontend/`
- [ ] New logic ships with a test
- [ ] Every new mutating route has an explicit `requireRole(...)` check **and** writes an `AuditLog` row
- [ ] Request bodies are validated with `zod` (schemas in `packages/shared` where the frontend reuses them)
- [ ] Schema changes are additive or expand → backfill → contract, with the backfill script checked in
- [ ] No new heavy runtime dependency (charts stay hand-rolled SVG); `package-lock.json` changes are intentional
- [ ] Docs updated if behaviour or setup changed (`docs/guide/`, `README.md`, `SECURITY.md`)
- [ ] For framework/mapping data changes: the `rationale` is recorded and `ATTRIBUTION.md` is still accurate

## Screenshots / API samples

<!-- UI change → before/after screenshots. API change → an example request + response envelope. -->
