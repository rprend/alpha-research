import fs from "node:fs/promises";
import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const result = await readJson(path.join(reportsDir, "result.json"));
const studySpecsText = await fs.readFile(path.join(reportsDir, "study-specs.md"), "utf8");
const rowById = new Map(result.rows.map((row) => [row.id, row]));

const readyNow = [
  ["cleveland-art-open-access", 103],
  ["wikidata", 96],
  ["library-of-congress-digital-collections", 93],
  ["met-collection-api", 93],
  ["open-syllabus", 86],
  ["project-gutenberg", 86],
];

const blocked = [
  ["smithsonian-open-access", "http-error"],
  ["chronicling-america", "http-error"],
  ["rijksmuseum-api", "http-error"],
  ["dpla", "http-error"],
];

const studySpecs = [
  "What A Museum Collection Looks Like When It Becomes Data",
  "The Public Knowledge Graph Of Culture",
  "What The Library Of Congress Has Digitized",
  "The Shape Of The Met Collection",
  "What Teaching Data Can And Cannot Tell Us About The Canon",
];

const checks = [
  check("candidate-count", result.candidates === 15, `${result.candidates} candidates`),
  check("accessible-count", result.accessibleCandidates === 11, `${result.accessibleCandidates} accessible candidates`),
  check("ready-count", result.readyCandidates === 6, `${result.readyCandidates} ready-now candidates`),
  check("needs-work-count", result.needsWorkCandidates === 5, `${result.needsWorkCandidates} needs-work candidates`),
  check("blocked-count", result.blockedCandidates === 4, `${result.blockedCandidates} blocked candidates`),
  ...readyNow.map(([id, score]) => checkReadyNow(id, score)),
  ...blocked.map(([id, accessStatus]) => checkBlocked(id, accessStatus)),
  ...studySpecs.map((title) => check(`study-spec-${slug(title)}`, studySpecsText.includes(`## ${title}`), title)),
  check("cleveland-launched-experiment", studySpecsText.includes("docs/experiments/cleveland-museum-collection-shape/"), "Cleveland study spec links launched experiment"),
];

const audit = {
  generatedAt: new Date().toISOString(),
  postPath: "docs/experiments/humanities-dataset-registry/reports/post.md",
  resultPath: "docs/experiments/humanities-dataset-registry/reports/result.json",
  sourceInventoryPath: "docs/experiments/humanities-dataset-registry/reports/source-inventory.md",
  studySpecsPath: "docs/experiments/humanities-dataset-registry/reports/study-specs.md",
  status: checks.every((item) => item.status === "pass") ? "pass" : "needs-review",
  checkCount: checks.length,
  passedCount: checks.filter((item) => item.status === "pass").length,
  checks,
  nextMoves: [
    "Keep scores framed as operational readiness, not cultural importance.",
    "Review licensing and redistribution before publishing derived datasets.",
    "Use ready-now candidates as study starts, not as representative samples of culture.",
  ],
};

await writeJson(path.join(reportsDir, "post-evidence-audit.json"), audit);
await writeText(path.join(reportsDir, "post-evidence-audit.md"), buildMarkdown(audit));

console.log(`Humanities dataset registry post evidence audit: ${audit.status} (${audit.passedCount}/${audit.checkCount} checks)`);
if (process.argv.includes("--strict") && audit.status !== "pass") {
  process.exit(1);
}

function checkReadyNow(id, expectedScore) {
  const row = rowById.get(id);
  return check(
    `ready-now-${id}`,
    row?.readiness_bucket === "ready-now" && row?.readiness_score === expectedScore,
    row ? `${row.name}; bucket=${row.readiness_bucket}; score=${row.readiness_score}` : "missing row",
  );
}

function checkBlocked(id, expectedStatus) {
  const row = rowById.get(id);
  return check(
    `blocked-${id}`,
    row?.readiness_bucket === "blocked-or-constrained" && row?.access_status === expectedStatus,
    row ? `${row.name}; bucket=${row.readiness_bucket}; access=${row.access_status}; http=${row.http_status}` : "missing row",
  );
}

function check(id, passed, evidence) {
  return {
    id,
    status: passed ? "pass" : "needs-review",
    evidence,
  };
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildMarkdown(audit) {
  return [
    "# Humanities Dataset Registry Post Evidence Audit",
    "",
    `Generated at: ${audit.generatedAt}`,
    `Status: ${audit.status}`,
    `Checks passed: ${audit.passedCount}/${audit.checkCount}`,
    "",
    "| Check | Status | Evidence |",
    "| --- | --- | --- |",
    ...audit.checks.map((item) => `| ${item.id} | ${item.status} | ${String(item.evidence).replaceAll("|", "\\|")} |`),
    "",
    "## Next Moves",
    "",
    ...audit.nextMoves.map((move) => `- ${move}`),
    "",
  ].join("\n");
}
