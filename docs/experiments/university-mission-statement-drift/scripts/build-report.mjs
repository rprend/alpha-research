import fs from "node:fs/promises";
import path from "node:path";
import {
  cleanHtml,
  countTerms,
  experimentDir,
  readJson,
  snippets,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const families = await readJson(path.join(experimentDir, "config", "term-families.json"));
const pages = [
  ...(await loadCurrentPages()),
  ...(await loadWaybackPages()),
];

if (!pages.length) throw new Error("No raw pages found. Run fetch-current-pages.mjs first.");

const processedPages = [];
const pageTermRows = [];

for (const page of pages) {
  const html = await fs.readFile(page.htmlPath, "utf8");
  const text = cleanHtml(html);
  const counts = countTerms(text, families);
  const highSignalTerms = counts.flatMap((row) => row.matchedTerms);
  const processed = {
    institution: page.institution,
    source_layer: page.sourceLayer,
    year: page.year,
    url: page.url,
    archive_url: page.archiveUrl ?? "",
    timestamp: page.timestamp ?? "",
    status: page.status,
    words: text.split(/\s+/).filter(Boolean).length,
    text_preview: text.slice(0, 600),
    snippets: snippets(text, highSignalTerms),
    term_counts: Object.fromEntries(counts.map((row) => [row.family, row.count])),
  };
  processedPages.push(processed);
  for (const row of counts) {
    pageTermRows.push({
      institution: page.institution,
      source_layer: page.sourceLayer,
      year: page.year,
      family: row.family,
      count: row.count,
      count_per_1000_words: processed.words ? Number(((row.count / processed.words) * 1000).toFixed(3)) : 0,
      matched_terms: row.matchedTerms.join("; "),
      url: page.url,
      archive_url: page.archiveUrl ?? "",
    });
  }
}

const yearRows = aggregateByYear(pageTermRows);
const currentRows = pageTermRows.filter((row) => row.source_layer === "current");
const currentTotals = sumCounts(currentRows);
const historicalTotals = sumCounts(pageTermRows.filter((row) => row.source_layer === "wayback"));
const latestYear = Math.max(...processedPages.map((page) => Number(page.year)).filter(Boolean));
const earliestYear = Math.min(...processedPages.map((page) => Number(page.year)).filter(Boolean));

await writeJson(path.join(processedDir, "pages.json"), processedPages);
await writeText(path.join(processedDir, "page-term-counts.csv"), toCsv(pageTermRows, ["institution", "source_layer", "year", "family", "count", "count_per_1000_words", "matched_terms", "url", "archive_url"]));
await writeText(path.join(processedDir, "term-counts.csv"), toCsv(currentRows, ["institution", "source_layer", "year", "family", "count", "count_per_1000_words", "matched_terms", "url", "archive_url"]));
await writeText(path.join(processedDir, "term-family-by-year.csv"), toCsv(yearRows, ["year", "family", "pages", "count", "words", "count_per_1000_words"]));

const result = {
  generatedAt: new Date().toISOString(),
  pages: processedPages.length,
  currentPages: processedPages.filter((page) => page.source_layer === "current").length,
  historicalPages: processedPages.filter((page) => page.source_layer === "wayback").length,
  yearRange: { earliest: earliestYear, latest: latestYear },
  currentTermFamilyTotals: currentTotals,
  historicalTermFamilyTotals: historicalTotals,
  termFamilyByYear: yearRows,
  institutions: processedPages.map((page) => ({
    institution: page.institution,
    source_layer: page.source_layer,
    year: page.year,
    words: page.words,
    term_counts: page.term_counts,
    snippets: page.snippets,
    url: page.url,
    archive_url: page.archive_url,
  })),
  articleReadiness: {
    status: processedPages.some((page) => page.source_layer === "wayback") ? "longitudinal-baseline" : "current-baseline",
    strongestNextMove: "Audit the archived snippets by hand and add catalogs, strategic plans, and speeches as separate source layers.",
  },
  caveats: [
    "Wayback snapshots preserve page availability, not necessarily stable mission-statement URLs.",
    "Archived HTML may include navigation, scripts, and template language that should be manually reviewed before publication.",
    "Counts are directional evidence; public claims need source-stratified excerpts and historical page-type checks.",
  ],
};
await writeJson(path.join(reportsDir, "result.json"), result);

const sortedCurrent = Object.entries(currentTotals).sort((a, b) => b[1] - a[1]);
const yearSummary = yearRows
  .filter((row) => ["truth_knowledge", "civic_public", "innovation_impact", "global_leadership", "inclusion_belonging"].includes(row.family))
  .sort((a, b) => Number(a.year) - Number(b.year) || a.family.localeCompare(b.family));

await writeText(path.join(reportsDir, "report.html"), buildHtml({ result, sortedCurrent, yearSummary, processedPages }));
await writeText(path.join(reportsDir, "public-draft.md"), buildPublicDraft({ result, sortedCurrent, yearSummary }));
await writeText(path.join(reportsDir, "work.md"), buildWorkLog({ result }));

console.log(`Built mission-statement report for ${processedPages.length} pages (${result.historicalPages} historical)`);

async function loadCurrentPages() {
  const rawRoot = path.join(experimentDir, "data", "raw", "current-pages");
  const runDates = await existingDirs(rawRoot);
  const latestRun = runDates.at(-1);
  if (!latestRun) return [];
  const runDir = path.join(rawRoot, latestRun);
  const manifest = await readJson(path.join(runDir, "manifest.json"));
  const year = Number(latestRun.slice(0, 4));
  return manifest.requests
    .filter((request) => Number(request.status) >= 200 && Number(request.status) < 300)
    .map((request) => ({
      institution: request.institution,
      url: request.url,
      status: request.status,
      sourceLayer: "current",
      year,
      htmlPath: path.join(experimentDir, request.responsePath),
    }));
}

async function loadWaybackPages() {
  const rawRoot = path.join(experimentDir, "data", "raw", "wayback-snapshots");
  const runDates = await existingDirs(rawRoot);
  const latestRun = runDates.at(-1);
  if (!latestRun) return [];
  const runDir = path.join(rawRoot, latestRun);
  const manifest = await readJson(path.join(runDir, "manifest.json"));
  return manifest.requests
    .filter((request) => Number(request.status) >= 200 && Number(request.status) < 300)
    .map((request) => ({
      institution: request.institution,
      url: request.url,
      archiveUrl: request.archiveUrl,
      timestamp: request.timestamp,
      status: request.status,
      sourceLayer: "wayback",
      year: request.year,
      htmlPath: path.join(experimentDir, request.responsePath),
    }));
}

function aggregateByYear(rows) {
  const map = new Map();
  for (const row of rows) {
    const page = `${row.institution}|${row.source_layer}|${row.year}`;
    const key = `${row.year}|${row.family}`;
    const target = map.get(key) ?? { year: row.year, family: row.family, pageSet: new Set(), count: 0, words: 0 };
    target.pageSet.add(page);
    target.count += row.count;
    const sourcePage = processedPages.find((candidate) => candidate.institution === row.institution && candidate.source_layer === row.source_layer && candidate.year === row.year);
    target.words += sourcePage?.words ?? 0;
    map.set(key, target);
  }
  return [...map.values()]
    .map((row) => ({
      year: row.year,
      family: row.family,
      pages: row.pageSet.size,
      count: row.count,
      words: row.words,
      count_per_1000_words: row.words ? Number(((row.count / row.words) * 1000).toFixed(3)) : 0,
    }))
    .sort((a, b) => Number(a.year) - Number(b.year) || a.family.localeCompare(b.family));
}

function sumCounts(rows) {
  const out = {};
  for (const row of rows) out[row.family] = (out[row.family] ?? 0) + row.count;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

async function existingDirs(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

function buildHtml({ result, sortedCurrent, yearSummary, processedPages }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>University Mission Statement Drift</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; margin: 40px auto; max-width: 1080px; color: #1f2933; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0 28px; }
    th, td { border-bottom: 1px solid #d9e2ec; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f0f4f8; }
    .stat { display: inline-block; border: 1px solid #d9e2ec; padding: 10px 12px; margin: 0 8px 8px 0; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>University Mission Statement Drift</h1>
  <p>Generated ${escapeHtml(result.generatedAt)} from current pages and Wayback snapshots.</p>
  <p>
    <span class="stat"><strong>${result.currentPages}</strong> current pages</span>
    <span class="stat"><strong>${result.historicalPages}</strong> historical snapshots</span>
    <span class="stat"><strong>${result.yearRange.earliest}-${result.yearRange.latest}</strong> year range</span>
  </p>
  <h2>Current Term Family Totals</h2>
  ${table(sortedCurrent.map(([family, count]) => ({ family, count })), ["family", "count"])}
  <h2>Longitudinal Term Rates</h2>
  ${table(yearSummary, ["year", "family", "pages", "count", "words", "count_per_1000_words"])}
  <h2>Institution Snapshots</h2>
  ${table(processedPages.map((page) => ({ institution: page.institution, source: page.source_layer, year: page.year, words: page.words, snippets: page.snippets.join(" / "), url: page.archive_url || page.url })), ["institution", "source", "year", "words", "snippets", "url"])}
  <h2>Interpretation</h2>
  <p>This artifact now has a longitudinal baseline. It is ready for hand audit and source expansion before publication-level claims.</p>
</body>
</html>
`;
}

function buildPublicDraft({ result, sortedCurrent }) {
  return [
    "# What Changed In University Mission Statements?",
    "",
    "This draft is now based on a current-page corpus plus archived Wayback snapshots. It is still a research draft, not publication copy.",
    "",
    "## Thesis To Test",
    "",
    "University self-description may have shifted from truth, civic, and liberal-education language toward innovation, impact, global leadership, inclusion, and economic language.",
    "",
    "## Corpus Note",
    "",
    `The current artifact contains ${result.currentPages} current pages and ${result.historicalPages} historical snapshots covering ${result.yearRange.earliest}-${result.yearRange.latest}.`,
    "",
    "## Current Baseline",
    "",
    `The largest current term families are ${sortedCurrent.slice(0, 4).map(([family]) => family).join(", ")}.`,
    "",
    "## What The Longitudinal Evidence Can Support Next",
    "",
    "- Compare term-family rates per 1,000 words by year.",
    "- Audit snippets around high-signal terms before making interpretive claims.",
    "- Add catalogs, strategic plans, and speeches as separate source layers.",
    "",
    "## Caveats",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
  ].join("\n");
}

function buildWorkLog({ result }) {
  return [
    "# Work Log",
    "",
    `Generated at: ${result.generatedAt}`,
    `Current pages: ${result.currentPages}`,
    `Historical snapshots: ${result.historicalPages}`,
    `Year range: ${result.yearRange.earliest}-${result.yearRange.latest}`,
    "",
    "## Outputs",
    "",
    "- `data/processed/pages.json`",
    "- `data/processed/page-term-counts.csv`",
    "- `data/processed/term-counts.csv`",
    "- `data/processed/term-family-by-year.csv`",
    "- `reports/report.html`",
    "- `reports/result.json`",
    "- `reports/public-draft.md`",
    "",
  ].join("\n");
}

function table(rows, columns) {
  if (!rows.length) return "<p>No rows.</p>";
  return `<table><thead><tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(row[col] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
