/**
 * Bundled ("managed") PostgreSQL for the no-Docker install path (DB_MODE=managed).
 *
 * Uses the binaries shipped by the optional `embedded-postgres` platform package
 * via `pg_ctl`, so the server runs as its own detached process (managed by its
 * postmaster.pid) and survives this script exiting — `scripts/start.sh` starts
 * it, `scripts/stop.sh` stops it.
 *
 *   npm run db:start | db:stop | db:status
 */
import "../env.js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { logger } from "../log.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DATA_DIR = process.env.MANAGED_PG_DATA_DIR
  ? path.resolve(process.env.MANAGED_PG_DATA_DIR)
  : path.join(REPO_ROOT, "data", "pg");
const LOG_FILE = path.join(REPO_ROOT, "logs", "pg.log");

const PG_USER = process.env.POSTGRES_USER?.trim() || "aibom";
const PG_DB = process.env.POSTGRES_DB?.trim() || "aibom";

/** PG port: MANAGED_PG_PORT wins, else the port in DATABASE_URL, else 55432. */
export function resolvePort(env: NodeJS.ProcessEnv = process.env): number {
  const fromUrl = env.DATABASE_URL?.match(/@[^/]+:(\d+)\//)?.[1];
  return Number(env.MANAGED_PG_PORT || fromUrl || 55432);
}

/** npm package name of the bundled PostgreSQL binaries for this platform. */
export function binariesPackage(platform = os.platform(), arch = os.arch()): string {
  return `@embedded-postgres/${platform === "win32" ? "windows" : platform}-${arch}`;
}

const PG_PORT = resolvePort();

type Binaries = { initdb: string; pg_ctl: string; postgres: string };

async function binaries(): Promise<Binaries> {
  const pkg = binariesPackage();
  try {
    const mod = (await import(pkg)) as Partial<Binaries>;
    if (!mod.initdb || !mod.pg_ctl || !mod.postgres || !fs.existsSync(mod.pg_ctl)) {
      throw new Error("binary paths missing");
    }
    return mod as Binaries;
  } catch (err) {
    throw new Error(
      `Managed database needs the '${pkg}' binaries. Install optional dependencies ` +
        `(npm install) or switch DB_MODE to 'docker' or 'url'. (${(err as Error).message})`,
    );
  }
}

function run(bin: string, args: string[], opts: { input?: string } = {}): string {
  return execFileSync(bin, args, {
    encoding: "utf8",
    input: opts.input,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

// `pg_ctl start` spawns a detached postmaster; capturing its stdio makes
// execFileSync wait on inherited pipe handles the grandchild keeps open, which
// hangs on Windows. Discard stdio and let pg_ctl write to its -l logfile.
function runDetached(bin: string, args: string[]): void {
  execFileSync(bin, args, { stdio: "ignore" });
}

function isInitialized(): boolean {
  return fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));
}

function isRunning(bins: Binaries): boolean {
  try {
    run(bins.pg_ctl, ["-D", DATA_DIR, "status"]);
    return true;
  } catch {
    return false;
  }
}

async function initialize(bins: Binaries): Promise<void> {
  fs.mkdirSync(path.dirname(DATA_DIR), { recursive: true });
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  logger.info({ dataDir: DATA_DIR }, "initializing managed database");
  run(bins.initdb, ["-D", DATA_DIR, "-U", PG_USER, "-A", "trust", "-E", "UTF8"]);
  // Create the application database in single-user mode (no server, no psql).
  if (PG_DB !== "postgres") {
    run(bins.postgres, ["--single", "-D", DATA_DIR, "postgres"], {
      input: `CREATE DATABASE "${PG_DB}";\n`,
    });
  }
}

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForReady(port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canConnect(port)) return;
    await sleep(500);
  }
  throw new Error(
    `managed database did not accept connections on port ${port} within ${timeoutMs / 1000}s (see ${LOG_FILE})`,
  );
}

async function start(): Promise<void> {
  const bins = await binaries();
  if (!isInitialized()) await initialize(bins);
  if (isRunning(bins)) {
    logger.info({ port: PG_PORT }, "managed database already running");
    return;
  }
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  // No `-w`: pg_ctl's built-in wait hangs under some shells. Start detached and
  // poll the port ourselves.
  runDetached(bins.pg_ctl, [
    "-D",
    DATA_DIR,
    "-l",
    LOG_FILE,
    "-o",
    `-p ${PG_PORT} -c listen_addresses=127.0.0.1`,
    "start",
  ]);
  await waitForReady(PG_PORT);
  logger.info({ port: PG_PORT, dataDir: DATA_DIR }, "managed database started");
}

async function stop(): Promise<void> {
  const bins = await binaries();
  if (!isInitialized() || !isRunning(bins)) {
    logger.info("managed database is not running");
    return;
  }
  run(bins.pg_ctl, ["-D", DATA_DIR, "-m", "fast", "stop"]);
  logger.info("managed database stopped");
}

async function status(): Promise<void> {
  const bins = await binaries();
  const running = isInitialized() && isRunning(bins);
  logger.info(
    { running, port: PG_PORT, dataDir: DATA_DIR },
    running ? "managed database running" : "managed database stopped",
  );
  if (!running) process.exitCode = 1;
}

const runningAsScript =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (runningAsScript) {
  const command = process.argv[2];
  const actions: Record<string, () => Promise<void>> = { start, stop, status };
  const action = actions[command ?? ""];
  if (!action) {
    process.stderr.write("usage: managed.ts <start|stop|status>\n");
    process.exit(2);
  }
  action()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((err) => {
      logger.error({ err }, "managed database command failed");
      process.exit(1);
    });
}
