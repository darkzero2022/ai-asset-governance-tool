# Screenshots

Referenced by the root `README.md`. Captured against the **demo** dataset
(`scripts/setup.sh --data=demo`) at 1440×900, 2× scale.

> ⚠️ These images are **stale** — taken before the UI redesign and the
> "Assets → AI Systems" rename. See "Regenerating" below.

| File | Page | Notes |
|---|---|---|
| `dashboard.png` / `dashboard-full.png` | `/dashboard` | Governance overview, severity donut, coverage, reuse, recertification |
| `risk-register.png` / `risk-register-full.png` | `/risks` | Heatmap + sortable risk table |
| `projects.png` / `projects-full.png` | `/projects` | Project reuse view |
| `asset-detail.png` / `asset-detail-full.png` | `/ai-systems/:id` (Claims Fraud Model) | Approval banner, linked risks, complete Model Card |
| `model-card.png` / `model-card-full.png` | `/ai-systems/:id` (Underwriting Copilot) | Incomplete Model Card blocking approval |

`*-full.png` is the full scrolling page; the plain name is the above-the-fold hero used in the README.

## Regenerating

> **Status:** the images in this folder pre-date the Wazuh-style UI redesign and
> the "Assets → AI Systems" rename. They need re-capturing. Tracked in
> [ROADMAP.md](../../ROADMAP.md).

Bring the stack up with demo data (`scripts/setup.sh --mode=local --data=demo`,
`scripts/start.sh`). The app no longer keeps a token in `localStorage` — the
access token lives in memory and auth rides an httpOnly refresh cookie — so a
capture script has to **log in through the form** and reuse the browser context:

```js
// Playwright, run from frontend/ after `npm i -D @playwright/test`
import { chromium } from "playwright";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:4000/login");
await page.getByLabel("Email").fill(process.env.ADMIN_EMAIL);
await page.getByLabel("Password").fill(process.env.ADMIN_PASSWORD);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/dashboard");
for (const [path, name] of [
  ["/dashboard", "dashboard"], ["/risks", "risk-register"], ["/projects", "projects"],
]) {
  await page.goto(`http://localhost:4000${path}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  await page.screenshot({ path: `docs/screenshots/${name}-full.png`, fullPage: true });
}
// plus two /ai-systems/:id detail pages (Claims Fraud Model, Underwriting Copilot)
await b.close();
```
