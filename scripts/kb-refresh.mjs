import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const commands = [
  { name: "validate registry and schemas", cmd: "node", args: ["scripts/kb-validate.mjs"] },
  { name: "inventory existing experiment seeds", cmd: "node", args: ["scripts/kb-inventory-existing.mjs"] },
  { name: "refresh DOAJ humanities metadata smoke", cmd: "node", args: ["scripts/kb-ingest-doaj.mjs", "--page-size=25", "--max-pages=1"] },
  { name: "refresh Wikidata cultural entity smoke", cmd: "node", args: ["scripts/kb-ingest-wikidata.mjs", "--per-query=25"] },
  { name: "refresh cultural collections smoke", cmd: "node", args: ["scripts/kb-ingest-cultural-collections.mjs", "--per-source=50", "--page-size=25"] },
  { name: "refresh web metadata smoke", cmd: "node", args: ["scripts/kb-ingest-web-metadata.mjs", "--limit=10"] },
  { name: "refresh department sitemap metadata summaries", cmd: "node", args: ["scripts/kb-ingest-department-sitemaps.mjs", "--refresh-departments-only"] },
  { name: "refresh Wayback snapshot metadata smoke", cmd: "node", args: ["scripts/kb-ingest-wayback-snapshots.mjs", "--per-target=2", "--limit=8", "--timeout-ms=10000"] },
  { name: "import experiment seeds", cmd: "node", args: ["scripts/kb-import-experiment-seeds.mjs"] },
  { name: "import local Gutenberg texts", cmd: "node", args: ["scripts/kb-import-gutenberg-local.mjs", "--limit=200", "--max-bytes=250000"] },
  { name: "rebuild analytical tables and SQLite", cmd: "node", args: ["scripts/kb-build-analytical-tables.mjs"] },
  { name: "refresh coverage and rights audits", cmd: "node", args: ["scripts/kb-audit-coverage.mjs"] },
  { name: "refresh blocked-source and replacement audits", cmd: "node", args: ["scripts/kb-audit-blocked-sources.mjs"] },
  { name: "rebuild keyword index", cmd: "node", args: ["scripts/kb-build-search-index.mjs"] },
  { name: "rebuild semantic hash index", cmd: "node", args: ["scripts/kb-build-semantic-index.mjs"] },
  { name: "write KB status", cmd: "node", args: ["scripts/kb-status.mjs"] },
];

for (const { name, cmd, args } of commands) {
  console.log(`\n[KB refresh] ${name}`);
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const smokeQuestion = "What local evidence exists for public humanities language in departments?";
console.log(`\n[KB refresh] local question smoke: ${smokeQuestion}`);
const questionResult = spawnSync("node", ["scripts/kb-question.mjs", smokeQuestion], { stdio: "inherit" });
if (questionResult.status !== 0) process.exit(questionResult.status ?? 1);

const smokeSlug = "what-local-evidence-exists-for-public-humanities-language-in-departments";
for (const artifact of ["brief.md", "source-map.json", "evidence.json", "identity-summary.json", "queries.sql", "missing-data.md", "study-template.md"]) {
  const file = path.join("docs", "research-briefs", smokeSlug, artifact);
  if (!existsSync(file)) {
    console.error(`Missing KB question smoke artifact: ${file}`);
    process.exit(1);
  }
}

console.log("Local humanities KB refresh passed.");
