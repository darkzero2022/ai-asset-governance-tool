# Screenshots

Referenced by the root `README.md`. Captured against the **demo** dataset
(`scripts/setup.sh --data=demo`) at 1440×900, 2× scale.

| File | Page | Notes |
|---|---|---|
| `dashboard.png` / `dashboard-full.png` | `/dashboard` | Governance overview, severity donut, coverage, reuse, recertification |
| `risk-register.png` / `risk-register-full.png` | `/risks` | Heatmap + sortable risk table |
| `projects.png` / `projects-full.png` | `/projects` | Project reuse view |
| `asset-detail.png` / `asset-detail-full.png` | `/assets/:id` (Claims Fraud Model) | Approval banner, linked risks, complete Model Card |
| `model-card.png` / `model-card-full.png` | `/assets/:id` (Underwriting Copilot) | Incomplete Model Card blocking approval |

`*-full.png` is the full scrolling page; the plain name is the above-the-fold hero used in the README.

## Regenerating

Bring the stack up with demo data, then drive a headless browser against it with a
localStorage-injected token (the app keeps its JWT in `localStorage["aibomToken"]`).
Any Playwright/Puppeteer script that sets that key before navigation works; capture
`/dashboard`, `/risks`, `/projects`, and two asset detail pages.
