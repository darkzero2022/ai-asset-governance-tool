import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Load configuration from, in precedence order:
//   1. process.env (already set — e.g. by docker compose or the shell)
//   2. backend/.env      — backend-only local overrides
//   3. <repo root>/.env  — the shared source of truth
// dotenv never overwrites a variable that is already set, so this order holds.
// In a container none of these files exist and this is a no-op.
const here = path.dirname(fileURLToPath(import.meta.url)); // backend/dist
config({
  path: [
    path.resolve(here, "../.env"),
    path.resolve(here, "../../.env"),
  ],
});
