import fs from "node:fs/promises";
import path from "node:path";
import {
  escapeHtml,
  experimentDir,
  readJson,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const webManifest = await latestManifest("web-sources");
const openAlexManifest = await latestManifest("openalex-authors");
const webRows = webManifest.requests.map((request) => classifyWebProbe(request));
const openAlexRows = openAlexManifest.requests.map((request) => classifyOpenAlexProbe(request));
const rows = [...webRows, ...openAlexRows];
const signalSummary = summarizeSignals(rows);
const result = {
  generatedAt: new Date().toISOString(),
  probes: rows.length,
  accessibleProbes: rows.filter((row) => row.access_status === "accessible").length,
  blockedProbes: rows.filter((row) => row.access_status !== "accessible").length,
  signals: signalSummary,
  sourceTypes: summarizeBy(rows, "source_type"),
  rows,
  strongestFinding: "Canon drift is not one dataset. Teaching, anthologization, citation, and holdings are separate signals that need separate source layers.",
  nextMoves: [
    "Choose one author cohort and source signal for a narrow first public essay.",
    "Negotiate or manually export Open Syllabus data before making assignment-level claims.",
    "Use OpenAlex for cited-discussion context, not as a proxy for teaching or canon assignment.",
    "Add edition-aware normalization before anthology or catalog claims.",
  ],
  caveats: [
    "Public courseware is not a representative sample of university teaching.",
    "Publisher pages may not expose complete anthology tables of contents.",
    "Library holdings and catalog metadata measure preservation and acquisition, not reading.",
    "OpenAlex search results measure scholarly discussion around a name, not canonical status by themselves.",
  ],
};

await writeJson(path.join(processedDir, "source-probes.json"), rows);
await writeText(path.join(processedDir, "feasibility-matrix.csv"), toCsv(rows, [
  "id",
  "label",
  "source_type",
  "signal",
  "access_status",
  "http_status",
  "records_or_results",
  "time_depth",
  "normalization_burden",
  "publication_use",
  "coverage_risk",
  "url",
]));
await writeText(path.join(reportsDir, "source-inventory.csv"), toCsv(rows, [
  "id",
  "label",
  "source_type",
  "signal",
  "access_status",
  "http_status",
  "records_or_results",
  "url",
]));
await writeText(path.join(reportsDir, "source-inventory.md"), buildSourceInventory(rows));
await writeJson(path.join(reportsDir, "result.json"), result);
await writeText(path.join(reportsDir, "report.html"), buildHtml(result));
await writeText(path.join(reportsDir, "public-draft.md"), buildPublicDraft(result));
await writeText(path.join(reportsDir, "work.md"), buildWorkLog(result));

console.log(`Built canon drift feasibility report for ${rows.length} probes`);

async function latestManifest(source) {
  const root = path.join(experimentDir, "data", "raw", source);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const latest = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().at(-1);
  if (!latest) throw new Error(`No ${source} manifest found`);
  return readJson(path.join(root, latest, "manifest.json"));
}

function classifyWebProbe(request) {
  const accessible = Number(request.status) >= 200 && Number(request.status) < 300;
  return {
    id: request.id,
    label: request.label,
    source_type: request.sourceType,
    signal: request.signal,
    access_status: accessible ? "accessible" : request.status,
    http_status: request.httpStatus ?? request.status,
    records_or_results: request.parsedRecordCount ?? 0,
    time_depth: inferTimeDepth(request.sourceType),
    normalization_burden: inferBurden(request.sourceType),
    publication_use: inferPublicationUse(request.sourceType, request.signal, accessible),
    coverage_risk: request.coverageRisk,
    url: request.url,
  };
}

function classifyOpenAlexProbe(request) {
  const accessible = Number(request.status) >= 200 && Number(request.status) < 300;
  return {
    id: `openalex-${request.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    label: `OpenAlex search: ${request.name}`,
    source_type: "citation-metadata",
    signal: "citation-or-scholarly-discussion",
    access_status: accessible ? "accessible" : request.status,
    http_status: request.httpStatus ?? request.status,
    records_or_results: request.totalCount ?? request.resultCount ?? 0,
    time_depth: "strong publication-year depth, but search relevance needs audit",
    normalization_burden: "medium: name disambiguation and relevance filtering",
    publication_use: accessible ? "good for scholarly-discussion context; not a standalone canon metric" : "not usable until accessible",
    coverage_risk: "Search results may include works about the author, by namesakes, or loosely related mentions.",
    url: request.url,
  };
}

function inferTimeDepth(sourceType) {
  if (sourceType.includes("course")) return "depends on public archive depth";
  if (sourceType.includes("anthology")) return "edition-level if TOCs are available";
  if (sourceType.includes("library")) return "strong bibliographic depth but weak usage signal";
  if (sourceType.includes("syllabus")) return "potentially strong if export access is available";
  return "unknown";
}

function inferBurden(sourceType) {
  if (sourceType.includes("anthology")) return "high: edition, work-title, author normalization";
  if (sourceType.includes("library")) return "high: editions, holdings, translations, duplicate records";
  if (sourceType.includes("course")) return "medium-high: page parsing and reading-list extraction";
  if (sourceType.includes("syllabus")) return "medium: assignment extraction and institution/date metadata";
  return "medium";
}

function inferPublicationUse(sourceType, signal, accessible) {
  if (!accessible) return "not usable until access terms or fetchability are resolved";
  if (sourceType === "syllabus-index") return "promising teaching signal if export access and terms are resolved";
  if (sourceType === "public-courseware") return "useful examples and source probe, not representative teaching evidence";
  if (sourceType === "anthology-toc") return "useful for edition-specific canon claims after TOC completeness audit";
  if (sourceType.includes("library")) return "useful holdings/edition signal, not readership";
  return `useful ${signal} signal with caveats`;
}

function summarizeSignals(rows) {
  const out = {};
  for (const row of rows) {
    const target = out[row.signal] ?? { probes: 0, accessible: 0 };
    target.probes += 1;
    if (row.access_status === "accessible") target.accessible += 1;
    out[row.signal] = target;
  }
  return out;
}

function summarizeBy(rows, key) {
  const out = {};
  for (const row of rows) out[row[key]] = (out[row[key]] ?? 0) + 1;
  return out;
}

function buildSourceInventory(rows) {
  return [
    "# Canon Drift Source Inventory",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "| Source | Type | Signal | Access | Records/Results | URL |",
    "| --- | --- | --- | --- | ---: | --- |",
    ...rows.map((row) => `| ${row.label} | ${row.source_type} | ${row.signal} | ${row.access_status} | ${row.records_or_results} | ${row.url} |`),
    "",
  ].join("\n");
}

function buildHtml(result) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Canon Drift Feasibility</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; margin: 40px auto; max-width: 1120px; color: #1f2933; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0 28px; }
    th, td { border-bottom: 1px solid #d9e2ec; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f0f4f8; }
    .stat { display: inline-block; border: 1px solid #d9e2ec; padding: 10px 12px; margin: 0 8px 8px 0; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Canon Drift Feasibility</h1>
  <p>${escapeHtml(result.strongestFinding)}</p>
  <p>
    <span class="stat"><strong>${result.probes}</strong> probes</span>
    <span class="stat"><strong>${result.accessibleProbes}</strong> accessible</span>
    <span class="stat"><strong>${Object.keys(result.signals).length}</strong> signal types</span>
  </p>
  <h2>Feasibility Matrix</h2>
  ${table(result.rows, ["label", "source_type", "signal", "access_status", "records_or_results", "publication_use", "coverage_risk"])}
  <h2>Caveats</h2>
  <ul>${result.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join("")}</ul>
</body>
</html>
`;
}

function table(rows, columns) {
  const header = `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column] ?? "")}</td>`).join("")}</tr>`).join("\n");
  return `<table>${header}${body}</table>`;
}

function buildPublicDraft(result) {
  return [
    "# Canon Drift: A Feasibility Report",
    "",
    "This is a research draft stub, not a public claim that the canon has changed.",
    "",
    "## Thesis To Test",
    "",
    "Canon drift can be measured only by separating different institutional signals: what is assigned, anthologized, cited, translated, held, or cataloged.",
    "",
    "## Corpus Note",
    "",
    `The current artifact probes ${result.probes} sources across ${Object.keys(result.signals).length} signal types. ${result.accessibleProbes} probes were accessible in the latest run.`,
    "",
    "## Central Finding",
    "",
    result.strongestFinding,
    "",
    "## What The Evidence Can Support Next",
    "",
    "- A methods essay explaining why canon drift is multiple measurements, not one ranking.",
    "- A narrow pilot around one author cohort and one source layer.",
    "- A source-access plan for Open Syllabus, anthology TOCs, and library metadata.",
    "",
    "## Caveats",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
  ].join("\n");
}

function buildWorkLog(result) {
  return [
    "# Work Log",
    "",
    `Generated at: ${result.generatedAt}`,
    `Probes: ${result.probes}`,
    `Accessible probes: ${result.accessibleProbes}`,
    "",
    "## Commands",
    "",
    "```bash",
    "node docs/experiments/canon-drift-feasibility/scripts/probe-web-sources.mjs",
    "node docs/experiments/canon-drift-feasibility/scripts/probe-openalex-authors.mjs",
    "node docs/experiments/canon-drift-feasibility/scripts/build-report.mjs",
    "node docs/experiments/canon-drift-feasibility/scripts/check-readiness.mjs",
    "```",
    "",
  ].join("\n");
}
