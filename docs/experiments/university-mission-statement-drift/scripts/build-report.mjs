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

const rawRoot = path.join(experimentDir, "data", "raw", "current-pages");
const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const families = await readJson(path.join(experimentDir, "config", "term-families.json"));
const runDates = await existingDirs(rawRoot);
const latestRun = runDates.at(-1);
if (!latestRun) throw new Error("No current-page raw run found. Run fetch-current-pages.mjs first.");

const runDir = path.join(rawRoot, latestRun);
const manifest = await readJson(path.join(runDir, "manifest.json"));
const pages = [];
const termRows = [];

for (const request of manifest.requests) {
  if (!(Number(request.status) >= 200 && Number(request.status) < 300)) continue;
  const htmlPath = path.join(experimentDir, request.responsePath);
  const html = await fs.readFile(htmlPath, "utf8");
  const text = cleanHtml(html);
  const counts = countTerms(text, families);
  const highSignalTerms = counts.flatMap((row) => row.matchedTerms);
  const page = {
    institution: request.institution,
    url: request.url,
    status: request.status,
    words: text.split(/\s+/).filter(Boolean).length,
    text_preview: text.slice(0, 600),
    snippets: snippets(text, highSignalTerms),
    term_counts: Object.fromEntries(counts.map((row) => [row.family, row.count])),
  };
  pages.push(page);
  for (const row of counts) {
    termRows.push({
      institution: request.institution,
      family: row.family,
      count: row.count,
      matched_terms: row.matchedTerms.join("; "),
      url: request.url,
    });
  }
}

await writeJson(path.join(processedDir, "pages.json"), pages);
await writeText(path.join(processedDir, "term-counts.csv"), toCsv(termRows, ["institution", "family", "count", "matched_terms", "url"]));

const totals = {};
for (const row of termRows) totals[row.family] = (totals[row.family] ?? 0) + row.count;
const sortedTotals = Object.entries(totals).sort((a, b) => b[1] - a[1]);

const result = {
  generatedAt: new Date().toISOString(),
  runDate: latestRun,
  pages: pages.length,
  errors: manifest.errors.length,
  termFamilyTotals: Object.fromEntries(sortedTotals),
  institutions: pages.map((page) => ({
    institution: page.institution,
    words: page.words,
    term_counts: page.term_counts,
    snippets: page.snippets,
    url: page.url,
  })),
  nextSteps: [
    "Add archived snapshots for the same URLs through Wayback or institutional archives.",
    "Add catalogs, strategic plans, and president inauguration speeches as separate source layers.",
    "Compare current-page language against historical snapshots by decade.",
  ],
};
await writeJson(path.join(reportsDir, "result.json"), result);

const reportHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>University Mission Statement Drift</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; margin: 40px auto; max-width: 980px; color: #1f2933; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0 28px; }
    th, td { border-bottom: 1px solid #d9e2ec; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f0f4f8; }
  </style>
</head>
<body>
  <h1>University Mission Statement Drift</h1>
  <p>Current-page corpus generated ${escapeHtml(result.generatedAt)} from ${pages.length} public university about/mission pages.</p>
  <h2>Term Family Totals</h2>
  ${table(sortedTotals.map(([family, count]) => ({ family, count })), ["family", "count"])}
  <h2>Institution Snapshots</h2>
  ${table(pages.map((page) => ({ institution: page.institution, words: page.words, snippets: page.snippets.join(" / "), url: page.url })), ["institution", "words", "snippets", "url"])}
  <h2>Interpretation</h2>
  <p>This is the current-page baseline for a longitudinal essay. It should not yet be treated as evidence of drift until historical snapshots are added.</p>
</body>
</html>
`;
await writeText(path.join(reportsDir, "report.html"), reportHtml);

await writeText(
  path.join(reportsDir, "public-draft.md"),
  [
    "# What Changed In University Mission Statements?",
    "",
    "This is the draft scaffold for a longitudinal essay. The current run establishes a baseline from present-day public about/mission pages.",
    "",
    "## Thesis To Test",
    "",
    "University self-description may have shifted from truth, civic, and liberal-education language toward innovation, impact, global leadership, inclusion, and economic language.",
    "",
    "## Current Baseline",
    "",
    `Collected ${pages.length} public pages. The largest current term families are ${sortedTotals.slice(0, 4).map(([family]) => family).join(", ")}.`,
    "",
    "## What Is Missing",
    "",
    "- Historical snapshots by decade.",
    "- Source stratification by page type.",
    "- Manual review of extracted snippets.",
    "- A comparison set of catalogs, strategic plans, and speeches.",
    "",
  ].join("\n"),
);

await writeText(
  path.join(reportsDir, "work.md"),
  [
    "# Work Log",
    "",
    `Generated at: ${result.generatedAt}`,
    `Raw run: ${latestRun}`,
    `Fetched pages: ${pages.length}`,
    `Fetch errors: ${manifest.errors.length}`,
    "",
    "## Outputs",
    "",
    "- `data/processed/pages.json`",
    "- `data/processed/term-counts.csv`",
    "- `reports/report.html`",
    "- `reports/result.json`",
    "- `reports/public-draft.md`",
    "",
  ].join("\n"),
);

console.log(`Built mission-statement report for ${pages.length} pages`);

async function existingDirs(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
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
