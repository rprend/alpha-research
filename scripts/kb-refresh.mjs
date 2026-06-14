import { spawnSync } from "node:child_process";

const commands = [
  ["node", ["scripts/kb-validate.mjs"]],
  ["node", ["scripts/kb-inventory-existing.mjs"]],
  ["node", ["scripts/kb-ingest-doaj.mjs", "--page-size=25", "--max-pages=1"]],
  ["node", ["scripts/kb-ingest-wikidata.mjs", "--per-query=25"]],
  ["node", ["scripts/kb-ingest-web-metadata.mjs", "--limit=10"]],
  ["node", ["scripts/kb-ingest-wayback-snapshots.mjs", "--per-target=3"]],
  ["node", ["scripts/kb-import-experiment-seeds.mjs"]],
  ["node", ["scripts/kb-import-gutenberg-local.mjs", "--limit=200", "--max-bytes=250000"]],
  ["node", ["scripts/kb-build-analytical-tables.mjs"]],
  ["node", ["scripts/kb-audit-coverage.mjs"]],
  ["node", ["scripts/kb-audit-blocked-sources.mjs"]],
  ["node", ["scripts/kb-build-search-index.mjs"]],
  ["node", ["scripts/kb-build-semantic-index.mjs"]],
  ["node", ["scripts/kb-status.mjs"]],
];

for (const [cmd, args] of commands) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Local humanities KB refresh passed.");
