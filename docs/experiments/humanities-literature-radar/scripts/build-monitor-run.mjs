import fs from "node:fs/promises";
import path from "node:path";
import {
  experimentDir,
  listFiles,
  readJson,
  stableWorkId,
  toCsv,
  today,
  writeJson,
  writeText,
} from "./lib.mjs";

const args = parseArgs();
const runDate = args["run-date"] ?? today();
const baselineDate = args["baseline-date"] ?? "bootstrap";
const currentWindowYearMin = Number(args["new-year-min"] ?? 2024);
const runDir = path.join(experimentDir, "runs", runDate);
const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");

const works = await readJson(path.join(processedDir, "works.json"));
const result = await readOptionalJson(path.join(reportsDir, "result.json"));
const pipelineRun = await readOptionalJson(path.join(reportsDir, "pipeline-run.json"));
const priorWorks = await loadPriorWorks(args["prior-works"]);
const priorIds = new Set(priorWorks.map(stableWorkId));
const currentRows = works.map((work) => ({
  stable_id: stableWorkId(work),
  title: work.title ?? "",
  year: work.year ?? "",
  publication_date: work.publication_date ?? "",
  source: work.source_name ?? "",
  venue: work.venue_name ?? "",
  doi: work.doi ?? "",
  url: work.url ?? "",
  is_quantitative_humanities_candidate: Boolean(work.is_quantitative_humanities_candidate),
  methods: (work.methods ?? []).join("; "),
  quantitative_signals: (work.quantitative_signals ?? []).join("; "),
}));

const newRows = currentRows
  .filter((row) => !priorIds.has(row.stable_id))
  .map((row) => ({
    ...row,
    newness_type: classifyNewness(row, currentWindowYearMin),
  }))
  .sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || a.title.localeCompare(b.title));

const changedSources = buildChangedSources(works, priorWorks);
const sourceManifests = await loadSourceManifests();
const manifest = {
  runDate,
  baselineDate,
  generatedAt: new Date().toISOString(),
  script: "docs/experiments/humanities-literature-radar/scripts/build-monitor-run.mjs",
  configPath: "config/monitor.yml",
  baseline: {
    source: args["prior-works"] ? args["prior-works"] : "bootstrap-empty-baseline",
    priorWorks: priorWorks.length,
    currentWorks: works.length,
  },
  policy: {
    compareKey: "stableWorkId",
    genuinelyNewPublicationYearMin: currentWindowYearMin,
  },
  counts: {
    currentWorks: works.length,
    newWorks: newRows.length,
    genuinelyNewPublications: newRows.filter((row) => row.newness_type === "genuinely-new-publication").length,
    newlyDiscoveredOldRecords: newRows.filter((row) => row.newness_type === "newly-discovered-old-record").length,
    changedSources: changedSources.length,
  },
  inputs: {
    works: "data/processed/works.json",
    result: "reports/result.json",
    pipelineRun: "reports/pipeline-run.json",
    sourceManifestCount: sourceManifests.length,
  },
  outputs: {
    newWorksJson: `runs/${runDate}/new-works.json`,
    newWorksCsv: `runs/${runDate}/new-works.csv`,
    changedSourcesCsv: `runs/${runDate}/changed-sources.csv`,
    result: `runs/${runDate}/result.json`,
    report: `runs/${runDate}/report.html`,
    work: `runs/${runDate}/work.md`,
  },
};

const monitorResult = {
  generatedAt: manifest.generatedAt,
  runDate,
  strongestFinding: summarizeFinding(manifest),
  counts: manifest.counts,
  sourceCoverage: changedSources,
  newnessBreakdown: countBy(newRows, (row) => row.newness_type),
  topNewSources: topCounts(newRows, (row) => row.source),
  topNewMethods: topSplitCounts(newRows, (row) => row.methods),
  notableNewWorks: newRows.slice(0, 25),
  caveats: [
    "This bootstrap monitor compares the current processed corpus against an empty baseline unless --prior-works is provided.",
    "Newly discovered old records are separated from genuinely new publications by publication year, not by source ingestion timestamp.",
    "Source coverage changes can reflect crawler limits, indexing lag, or API availability rather than intellectual change.",
  ],
  nextRun: [
    "Run the monitor after each literature-radar backfill using the previous run's processed works as --prior-works.",
    "Treat new topic and venue changes as leads until representative records are manually audited.",
    "Publish monitor findings only with the source coverage table attached.",
  ],
};

await fs.mkdir(runDir, { recursive: true });
await writeJson(path.join(runDir, "manifest.json"), manifest);
await writeJson(path.join(runDir, "new-works.json"), newRows);
await writeText(path.join(runDir, "new-works.csv"), toCsv(newRows, [
  "stable_id",
  "newness_type",
  "title",
  "year",
  "publication_date",
  "source",
  "venue",
  "doi",
  "url",
  "is_quantitative_humanities_candidate",
  "methods",
  "quantitative_signals",
]));
await writeText(path.join(runDir, "changed-sources.csv"), toCsv(changedSources, [
  "source",
  "currentRecords",
  "priorRecords",
  "delta",
  "currentShare",
  "priorShare",
  "coverageNote",
]));
await writeJson(path.join(runDir, "result.json"), monitorResult);
await writeText(path.join(runDir, "report.html"), buildReportHtml(monitorResult, manifest, result));
await writeText(path.join(runDir, "work.md"), buildWorkMd(manifest, pipelineRun, sourceManifests));

console.log(`Built humanities literature monitor run ${runDate}: ${newRows.length} new rows (${manifest.counts.genuinelyNewPublications} genuinely new, ${manifest.counts.newlyDiscoveredOldRecords} newly discovered old)`);

async function loadPriorWorks(priorPath) {
  if (!priorPath) return [];
  const absolute = path.resolve(priorPath);
  return readJson(absolute);
}

async function loadSourceManifests() {
  const rawDir = path.join(experimentDir, "data", "raw");
  return Promise.all((await listFiles(rawDir, (file) => file.endsWith("manifest.json"))).map(async (file) => {
    const manifest = await readJson(file);
    return {
      path: path.relative(experimentDir, file),
      source: manifest.source,
      runDate: manifest.runDate,
      recordCount: manifest.recordCount,
      requestCount: manifest.requestCount,
      errors: manifest.errors?.length ?? 0,
    };
  }));
}

function classifyNewness(row, yearMin) {
  const year = Number(row.year);
  return Number.isFinite(year) && year >= yearMin ? "genuinely-new-publication" : "newly-discovered-old-record";
}

function buildChangedSources(currentWorks, oldWorks) {
  const current = countBy(currentWorks, (work) => work.source_name || "unknown");
  const prior = countBy(oldWorks, (work) => work.source_name || "unknown");
  const totalCurrent = currentWorks.length || 1;
  const totalPrior = oldWorks.length || 1;
  return [...new Set([...Object.keys(current), ...Object.keys(prior)])].sort().map((source) => {
    const currentRecords = current[source] ?? 0;
    const priorRecords = prior[source] ?? 0;
    const delta = currentRecords - priorRecords;
    return {
      source,
      currentRecords,
      priorRecords,
      delta,
      currentShare: round(currentRecords / totalCurrent),
      priorShare: oldWorks.length ? round(priorRecords / totalPrior) : 0,
      coverageNote: oldWorks.length ? (delta === 0 ? "stable count" : "source count changed; inspect manifests before interpreting as trend") : "bootstrap baseline; no prior source count",
    };
  });
}

function summarizeFinding(manifest) {
  if (manifest.baseline.priorWorks === 0) {
    return `Bootstrap monitor classified ${manifest.counts.currentWorks} current corpus records into ${manifest.counts.genuinelyNewPublications} genuinely new publications and ${manifest.counts.newlyDiscoveredOldRecords} newly discovered old records.`;
  }
  return `Monitor found ${manifest.counts.newWorks} records absent from the prior baseline, including ${manifest.counts.genuinelyNewPublications} genuinely new publications.`;
}

function buildReportHtml(monitorResult, manifest, literatureResult) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Humanities Literature Radar Monitor</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 40px auto; max-width: 1040px; line-height: 1.5; color: #1f2933; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0 28px; }
    th, td { border-bottom: 1px solid #d9e2ec; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f0f4f8; }
    .stat { display: inline-block; border: 1px solid #d9e2ec; border-radius: 6px; padding: 10px 12px; margin: 0 8px 8px 0; }
    .muted { color: #52606d; }
  </style>
</head>
<body>
  <h1>Humanities Literature Radar Monitor</h1>
  <p class="muted">Run date ${escapeHtml(manifest.runDate)}. Compare key: stable DOI, URL, or normalized title/year.</p>
  <p>${escapeHtml(monitorResult.strongestFinding)}</p>
  <p>
    <span class="stat"><strong>${manifest.counts.currentWorks}</strong> current works</span>
    <span class="stat"><strong>${manifest.counts.newWorks}</strong> absent from baseline</span>
    <span class="stat"><strong>${manifest.counts.genuinelyNewPublications}</strong> genuinely new publications</span>
    <span class="stat"><strong>${manifest.counts.newlyDiscoveredOldRecords}</strong> newly discovered old records</span>
  </p>
  <h2>Source Coverage Changes</h2>
  ${table(monitorResult.sourceCoverage, ["source", "currentRecords", "priorRecords", "delta", "coverageNote"])}
  <h2>Notable New Records</h2>
  ${table(monitorResult.notableNewWorks.slice(0, 15), ["newness_type", "title", "year", "source", "venue", "url"])}
  <h2>Caveats</h2>
  <ul>${monitorResult.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join("\n")}</ul>
  <h2>Prior Field Map Context</h2>
  <p>${escapeHtml(literatureResult?.strongestFinding ?? "No field-map result found.")}</p>
</body>
</html>
`;
}

function buildWorkMd(manifest, pipelineRun, sourceManifests) {
  return [
    "# Monitor Work Log",
    "",
    `Generated at: ${manifest.generatedAt}`,
    `Run date: ${manifest.runDate}`,
    `Baseline: ${manifest.baseline.source}`,
    "",
    "## Commands",
    "",
    "```bash",
    `node docs/experiments/humanities-literature-radar/scripts/build-monitor-run.mjs --run-date=${manifest.runDate}`,
    "```",
    "",
    "## Inputs",
    "",
    "- `data/processed/works.json`",
    "- `reports/result.json`",
    "- `reports/pipeline-run.json`",
    ...sourceManifests.map((source) => `- \`${source.path}\`: ${source.recordCount} records, ${source.errors} errors`),
    "",
    "## Outputs",
    "",
    ...Object.values(manifest.outputs).map((file) => `- \`${file}\``),
    "",
    "## Pipeline Context",
    "",
    pipelineRun ? `Latest pipeline profile: ${pipelineRun.profile}; run date: ${pipelineRun.runDate}` : "No pipeline-run.json found.",
    "",
    "## Monitor Interpretation",
    "",
    "- `genuinely-new-publication` means the record is absent from the prior baseline and its publication year is inside the configured current window.",
    "- `newly-discovered-old-record` means the record is absent from the prior baseline but predates the current publication window.",
    "- Source count deltas are coverage signals until source manifests are inspected.",
    "",
  ].join("\n");
}

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}

function countBy(items, fn) {
  return items.reduce((acc, item) => {
    const key = String(fn(item) || "unknown");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function topCounts(items, fn) {
  return Object.entries(countBy(items, fn))
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 20);
}

function topSplitCounts(items, fn) {
  const expanded = items.flatMap((item) => String(fn(item) ?? "").split(";").map((part) => part.trim()).filter(Boolean));
  return topCounts(expanded, (item) => item);
}

function table(rows, columns) {
  if (!rows.length) return "<p>No rows.</p>";
  return `<table><thead><tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(row[col] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, value = "true"] = arg.slice(2).split("=");
    out[key] = value;
  }
  return out;
}
