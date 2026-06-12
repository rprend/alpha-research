import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const processedDir = path.join(experimentDir, "data", "processed");
const pilot = await readJson(path.join(reportsDir, "canon-narrow-pilot.json"));
const yearRows = await readJson(path.join(processedDir, "canon-openalex-year-counts.json"));
const sampleRows = await readJson(path.join(processedDir, "canon-openalex-sample-works.json"));

const checks = [
  check("single-signal", pilot.signal === "citation-or-scholarly-discussion", pilot.signal),
  check("author-cohort", pilot.authors.length === 6, `${pilot.authors.length} authors`),
  check("year-depth", yearRows.length >= 90, `${yearRows.length} author-year rows`),
  check("sample-audit-packet", sampleRows.length >= 100, `${sampleRows.length} sample works`),
  check("raw-manifest", Boolean(pilot.rawManifest), pilot.rawManifest),
  check("claim-blockers", pilot.blockersBeforeCanonClaims.length >= 3, `${pilot.blockersBeforeCanonClaims.length} blockers`),
];

const readiness = {
  generatedAt: new Date().toISOString(),
  status: checks.every((item) => item.status === "pass") ? "pilot-ready" : "needs-work",
  checks,
  publicationUse: "Can support a narrow methods/pilot note about OpenAlex scholarly-discussion signal only; cannot support teaching, anthology, or general canon-rank claims.",
  nextActions: [
    "Manually label sample works for false positives before public examples.",
    "Add author aliases and exclusion terms before expanding the signal.",
    "Add a second source layer before broader canon drift claims.",
  ],
};

await writeJson(path.join(reportsDir, "canon-narrow-pilot-readiness.json"), readiness);
await writeText(path.join(reportsDir, "canon-narrow-pilot-readiness.md"), buildMarkdown(readiness));

console.log(`Canon OpenAlex citation pilot readiness: ${readiness.status}`);
if (process.argv.includes("--strict") && readiness.status !== "pilot-ready") process.exit(1);

function check(id, passed, evidence) {
  return { id, status: passed ? "pass" : "needs-work", evidence };
}

function buildMarkdown(readiness) {
  return [
    "# Canon Narrow Pilot Readiness",
    "",
    `Generated at: ${readiness.generatedAt}`,
    `Status: ${readiness.status}`,
    "",
    "| Check | Status | Evidence |",
    "| --- | --- | --- |",
    ...readiness.checks.map((item) => `| ${item.id} | ${item.status} | ${String(item.evidence).replaceAll("|", "\\|")} |`),
    "",
    "## Publication Use",
    "",
    readiness.publicationUse,
    "",
    "## Next Actions",
    "",
    ...readiness.nextActions.map((item) => `- ${item}`),
    "",
  ].join("\n");
}
