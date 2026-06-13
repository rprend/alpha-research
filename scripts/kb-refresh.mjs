import { spawnSync } from "node:child_process";

const commands = [
  ["node", ["scripts/kb-validate.mjs"]],
  ["node", ["scripts/kb-inventory-existing.mjs"]],
  ["node", ["scripts/kb-build-analytical-tables.mjs"]],
  ["node", ["scripts/kb-audit-coverage.mjs"]],
  ["node", ["scripts/kb-build-search-index.mjs"]],
  ["node", ["scripts/kb-status.mjs"]],
];

for (const [cmd, args] of commands) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Local humanities KB refresh passed.");
