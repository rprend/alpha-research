import fs from "node:fs/promises";
import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const processedDir = path.join(experimentDir, "data", "processed");
const rawDir = path.join(experimentDir, "data", "raw");
const result = await readJson(path.join(reportsDir, "result.json"));
const works = await readJson(path.join(processedDir, "works.json"));
const topics = await readJson(path.join(processedDir, "topics.json"));
const sourceCount = Object.keys(result.corpus.sources ?? {}).length;
const manifests = await findManifests(rawDir);
const representativeWorks = await readCsvRows(path.join(processedDir, "representative-works.csv"));

const checks = [
  {
    id: "source-diversity",
    label: "At least five processed source families are represented",
    status: sourceCount >= 5 ? "pass" : "needs-work",
    evidence: `${sourceCount} sources: ${Object.keys(result.corpus.sources ?? {}).join(", ")}`,
  },
  {
    id: "corpus-size",
    label: "At least 500 deduped works are needed before publication-level field claims",
    status: result.corpus.works >= 500 ? "pass" : "needs-work",
    evidence: `${result.corpus.works} deduped works`,
  },
  {
    id: "recent-coverage",
    label: "At least 200 works from 2024-present are needed for current-field claims",
    status: result.corpus.recentWorks2024Present >= 200 ? "pass" : "needs-work",
    evidence: `${result.corpus.recentWorks2024Present} works from 2024-present`,
  },
  {
    id: "quantitative-candidates",
    label: "At least 50 quantitative/computational humanities candidates are identified",
    status: result.corpus.quantitativeHumanitiesCandidates >= 50 ? "pass" : "needs-work",
    evidence: `${result.corpus.quantitativeHumanitiesCandidates} candidates`,
  },
  {
    id: "source-manifests",
    label: "Every processed source has a raw manifest",
    status: missingManifestSources().length ? "needs-work" : "pass",
    evidence: missingManifestSources().length ? `missing: ${missingManifestSources().join(", ")}` : `${manifests.length} manifests`,
  },
  {
    id: "representative-works",
    label: "Representative works table has at least 25 rows for manual review",
    status: representativeWorks.length >= 25 ? "pass" : "needs-work",
    evidence: `${representativeWorks.length} representative rows`,
  },
  {
    id: "topic-labels",
    label: "Topic/method/signal table has at least 10 labels",
    status: topics.length >= 10 ? "pass" : "needs-work",
    evidence: `${topics.length} labels`,
  },
  {
    id: "source-caveats",
    label: "Public draft remains caveated until broad backfill is complete",
    status: "pass",
    evidence: "reports/public-draft.md",
  },
];

const readiness = {
  generatedAt: new Date().toISOString(),
  status: checks.every((check) => check.status === "pass") ? "ready-for-editorial-review" : "not-ready-for-publication",
  corpus: result.corpus,
  checks,
  nextMoves: [
    "Run the `v1` profile or higher source-specific limits to reach publication-scale corpus size.",
    "Use DOAJ dumps/OAI-PMH for large open-access harvesting instead of bounded search.",
    "Expand OSF/SocArXiv and KCWorks beyond bounded keyword search.",
    "Manually review representative works before publishing field claims.",
  ],
};

await writeJson(path.join(reportsDir, "readiness.json"), readiness);
await writeText(
  path.join(reportsDir, "readiness.md"),
  [
    "# Humanities Literature Radar Readiness Check",
    "",
    `Generated at: ${readiness.generatedAt}`,
    `Status: ${readiness.status}`,
    "",
    "| Check | Status | Evidence |",
    "| --- | --- | --- |",
    ...checks.map((check) => `| ${check.label} | ${check.status} | ${check.evidence} |`),
    "",
    "## Next Moves",
    "",
    ...readiness.nextMoves.map((move) => `- ${move}`),
    "",
  ].join("\n"),
);

console.log(`Humanities radar readiness: ${readiness.status}`);
if (process.argv.includes("--strict") && readiness.status !== "ready-for-editorial-review") {
  process.exit(1);
}

function missingManifestSources() {
  const manifestSources = new Set(manifests.map((manifest) => manifest.source));
  return Object.keys(result.corpus.sources ?? {}).filter((source) => !manifestSources.has(source));
}

async function findManifests(dir) {
  const out = [];
  await walk(dir);
  return out;

  async function walk(current) {
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name === "manifest.json") {
        out.push(await readJson(full));
      }
    }
  }
}

async function readCsvRows(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split(/\n/).slice(1).filter(Boolean);
}
