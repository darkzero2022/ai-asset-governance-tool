import { spawnSync } from "node:child_process";

// `shell: true` is required to launch `npm` on Windows (npm.cmd) since Node 20.12.
// Pass the command as one string (not args) to avoid the shell-args deprecation.
for (const script of ["prisma:seed:reference", "prisma:seed:demo"]) {
  const result = spawnSync(`npm run ${script}`, { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
