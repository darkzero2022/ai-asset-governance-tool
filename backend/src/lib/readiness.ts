import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../prisma.js";

export type CheckResult = { ok: boolean; detail?: string };
export type Readiness = {
  status: "ready" | "not-ready";
  checks: { database: CheckResult; migrations: CheckResult };
};

// backend/dist/lib -> backend/prisma/migrations
const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../prisma/migrations",
);

/** Migration folder names checked into the repo (each is one migration). */
function migrationsOnDisk(): string[] {
  try {
    return fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(MIGRATIONS_DIR, e.name, "migration.sql")))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

/** Pure diff: which on-disk migrations have not been applied. */
export function pendingMigrations(onDisk: string[], applied: Iterable<string>): string[] {
  const done = new Set(applied);
  return onDisk.filter((name) => !done.has(name));
}

async function checkMigrations(): Promise<CheckResult> {
  const onDisk = migrationsOnDisk();
  if (onDisk.length === 0) {
    return { ok: false, detail: "no migration files found on disk" };
  }
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
    `;
    const pending = pendingMigrations(
      onDisk,
      rows.map((r) => r.migration_name),
    );
    if (pending.length > 0) {
      return { ok: false, detail: `pending migrations: ${pending.join(", ")}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

export async function readiness(): Promise<Readiness> {
  const [database, migrations] = await Promise.all([checkDatabase(), checkMigrations()]);
  return {
    status: database.ok && migrations.ok ? "ready" : "not-ready",
    checks: { database, migrations },
  };
}
