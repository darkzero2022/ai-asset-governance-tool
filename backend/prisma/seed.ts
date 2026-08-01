import { spawnSync } from "node:child_process";

for (const script of ["prisma:seed:reference", "prisma:seed:demo"]) {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
