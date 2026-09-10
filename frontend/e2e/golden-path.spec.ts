import { test, expect } from "@playwright/test";

// One pass through the core stack: first-run bootstrap -> dashboard -> create an
// AI system -> see it in the list -> open its detail -> export a CycloneDX BOM
// and assert it validates structurally. Runs against a fresh, admin-less DB
// (see e2e/run-stack.sh), so it must run first / alone.

const ADMIN = {
  name: "E2E Admin",
  email: "e2e-admin@example.com",
  password: "a-strong-e2e-passphrase",
};

const SYSTEM = {
  name: `Fraud Scoring Model ${Date.now()}`,
  version: "1.0.0",
  supplier: "Internal ML Platform",
};

test("golden path: bootstrap, create an AI system, export its BOM", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "Primary" });
  const goto = (label: string) => nav.getByRole("link", { name: label, exact: true }).click();

  // --- first-run bootstrap --------------------------------------------------
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /create your administrator account/i }),
  ).toBeVisible();

  await page.getByLabel("Name").fill(ADMIN.name);
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByLabel("Confirm password").fill(ADMIN.password);
  await page.getByRole("button", { name: /create account and sign in/i }).click();

  // Signed in — the index route redirects to the AI Systems list.
  await expect(page.getByRole("heading", { name: "AI Systems", level: 1 })).toBeVisible();

  // Dashboard renders too.
  await goto("Dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();

  // --- create an AI system -----------------------------------------------
  await goto("AI Systems");
  await expect(page.getByRole("heading", { name: "AI Systems", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "New AI system" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("New AI system")).toBeVisible();

  await dialog.getByLabel("Name").fill(SYSTEM.name);
  await dialog.getByLabel("Version").fill(SYSTEM.version);
  await dialog.getByLabel("Supplier").fill(SYSTEM.supplier);
  await dialog.getByLabel("Type").selectOption({ label: "Model" });
  // Hosting Model / Network Dependency default to the first enum option.
  await dialog.getByRole("button", { name: /create ai system/i }).click();

  await expect(dialog).toBeHidden();
  const row = page.getByRole("row", { name: new RegExp(SYSTEM.name) });
  await expect(row).toBeVisible();

  // --- detail route loads by id ---------------------------------------
  await row.getByRole("button", { name: SYSTEM.name }).click();
  await expect(page.getByRole("heading", { name: SYSTEM.name, level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/ai-systems\/[^/]+$/);

  // --- export a CycloneDX BOM ----------------------------------------
  await goto("AI Systems");
  await page
    .getByRole("row", { name: new RegExp(SYSTEM.name) })
    .getByRole("button", { name: "Row actions" })
    .click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: /export cyclonedx/i }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const bom = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  expect(bom.bomFormat).toBe("CycloneDX");
  expect(bom.specVersion).toMatch(/^1\./);
  const entries = [...(bom.components ?? []), ...(bom.services ?? [])];
  expect(entries.some((c: { name?: string }) => c.name === SYSTEM.name)).toBe(true);
});
