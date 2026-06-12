import fs from "node:fs/promises";
import path from "node:path";
import {
  cleanHtml,
  countTerms,
  escapeHtml,
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
const termRows = [];

for (const page of pages) {
  const html = await fs.readFile(page.htmlPath, "utf8");
  const text = cleanHtml(html);
  const counts = countTerms(text, families);
  const highSignalTerms = counts.flatMap((row) => row.matchedTerms);
  const processed = {
    museum: page.museum,
    page_type: page.pageType,
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
    termRows.push({
      museum: page.museum,
      page_type: page.pageType,
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

const familyTotals = sumCounts(termRows);
const familyByPageType = aggregateByPageType(termRows, processedPages);
const familyByYear = aggregateByYear(termRows, processedPages);
const sourceInventory = buildSourceInventory(pages);
const currentPages = processedPages.filter((page) => page.source_layer === "current");
const historicalPages = processedPages.filter((page) => page.source_layer === "wayback");
const result = {
  generatedAt: new Date().toISOString(),
  pages: processedPages.length,
  currentPages: currentPages.length,
  historicalPages: historicalPages.length,
  museums: [...new Set(processedPages.map((page) => page.museum))].length,
  pageTypes: [...new Set(processedPages.map((page) => page.page_type))].sort(),
  yearRange: { earliest: Math.min(...processedPages.map((page) => page.year)), latest: Math.max(...processedPages.map((page) => page.year)) },
  termFamilyTotals: familyTotals,
  termFamilyByPageType: familyByPageType,
  termFamilyByYear: familyByYear,
  sourceInventory,
  pagesDetail: processedPages,
  articleReadiness: {
    status: historicalPages.length ? "longitudinal-source-probe" : "current-source-probe",
    strongestNextMove: "Add annual-report/exhibition/provenance pages as separate source layers before trend claims.",
  },
  caveats: [
    "Wayback snapshots show public page availability, not necessarily stable museum policy or practice.",
    "About pages, collection pages, and provenance pages are different genres and must not be compared as if they were the same source type.",
    "Counts identify terms for audit; interpretation requires reading snippets and checking page context.",
  ],
};

await writeJson(path.join(processedDir, "pages.json"), processedPages);
await writeText(path.join(processedDir, "page-term-counts.csv"), toCsv(termRows, ["museum", "page_type", "source_layer", "year", "family", "count", "count_per_1000_words", "matched_terms", "url", "archive_url"]));
await writeText(path.join(processedDir, "term-family-by-page-type.csv"), toCsv(familyByPageType, ["page_type", "family", "pages", "count", "words", "count_per_1000_words"]));
await writeText(path.join(processedDir, "term-family-by-year.csv"), toCsv(familyByYear, ["year", "family", "pages", "count", "words", "count_per_1000_words"]));
await writeText(path.join(reportsDir, "source-inventory.csv"), toCsv(sourceInventory, ["museum", "page_type", "source_layer", "year", "status", "word_count", "url", "archive_url", "response_path"]));
await writeText(path.join(reportsDir, "source-inventory.md"), buildSourceInventoryMd(sourceInventory));
await writeJson(path.join(reportsDir, "result.json"), result);
await writeText(path.join(reportsDir, "report.html"), buildHtml(result));
await writeText(path.join(reportsDir, "public-draft.md"), buildPublicDraft(result));
await writeText(path.join(reportsDir, "work.md"), buildWorkLog(result));

console.log(`Built museum language report for ${processedPages.length} pages (${historicalPages.length} historical)`);

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
      museum: request.museum,
      pageType: request.pageType,
      url: request.url,
      status: request.status,
      wordCount: request.wordCount,
      responsePath: request.responsePath,
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
      museum: request.museum,
      pageType: request.pageType,
      url: request.url,
      archiveUrl: request.archiveUrl,
      timestamp: request.timestamp,
      status: request.status,
      wordCount: request.wordCount,
      responsePath: request.responsePath,
      sourceLayer: "wayback",
      year: request.year,
      htmlPath: path.join(experimentDir, request.responsePath),
    }));
}

async function existingDirs(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

function sumCounts(rows) {
  const out = {};
  for (const row of rows) out[row.family] = (out[row.family] ?? 0) + row.count;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

function aggregateByPageType(rows, processedPages) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.page_type}|${row.family}`;
    const target = map.get(key) ?? { page_type: row.page_type, family: row.family, pageSet: new Set(), count: 0, words: 0 };
    target.pageSet.add(`${row.museum}|${row.page_type}`);
    target.count += row.count;
    const page = processedPages.find((candidate) => candidate.museum === row.museum && candidate.page_type === row.page_type);
    target.words += page?.words ?? 0;
    map.set(key, target);
  }
  return [...map.values()]
    .map((row) => ({
      page_type: row.page_type,
      family: row.family,
      pages: row.pageSet.size,
      count: row.count,
      words: row.words,
      count_per_1000_words: row.words ? Number(((row.count / row.words) * 1000).toFixed(3)) : 0,
    }))
    .sort((a, b) => a.page_type.localeCompare(b.page_type) || b.count - a.count);
}

function aggregateByYear(rows, processedPages) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.year}|${row.family}`;
    const pageKey = `${row.museum}|${row.page_type}|${row.source_layer}|${row.year}`;
    const target = map.get(key) ?? { year: row.year, family: row.family, pageSet: new Set(), count: 0, words: 0 };
    target.pageSet.add(pageKey);
    target.count += row.count;
    const page = processedPages.find((candidate) => (
      candidate.museum === row.museum &&
      candidate.page_type === row.page_type &&
      candidate.source_layer === row.source_layer &&
      candidate.year === row.year
    ));
    target.words += page?.words ?? 0;
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

function buildSourceInventory(pages) {
  return pages.map((page) => ({
    museum: page.museum,
    page_type: page.pageType,
    source_layer: page.sourceLayer,
    year: page.year,
    status: page.status,
    word_count: page.wordCount,
    url: page.url,
    archive_url: page.archiveUrl ?? "",
    response_path: page.responsePath,
  }));
}

function buildSourceInventoryMd(rows) {
  return [
    "# Museum Language Drift Source Inventory",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "| Museum | Page Type | Layer | Year | Status | Words | URL |",
    "| --- | --- | --- | ---: | --- | ---: | --- |",
    ...rows.map((row) => `| ${row.museum} | ${row.page_type} | ${row.source_layer} | ${row.year} | ${row.status} | ${row.word_count} | ${row.archive_url || row.url} |`),
    "",
  ].join("\n");
}

function buildHtml(result) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Museum Language Drift</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; margin: 40px auto; max-width: 1080px; color: #1f2933; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0 28px; }
    th, td { border-bottom: 1px solid #d9e2ec; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f0f4f8; }
    .stat { display: inline-block; border: 1px solid #d9e2ec; padding: 10px 12px; margin: 0 8px 8px 0; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Museum Language Drift</h1>
  <p>Generated ${escapeHtml(result.generatedAt)} from current public museum pages and Wayback snapshots.</p>
  <p>
    <span class="stat"><strong>${result.currentPages}</strong> current pages</span>
    <span class="stat"><strong>${result.historicalPages}</strong> historical snapshots</span>
    <span class="stat"><strong>${result.museums}</strong> museums</span>
    <span class="stat"><strong>${result.pageTypes.join(", ")}</strong> page types</span>
  </p>
  <h2>Term Family Totals</h2>
  ${table(Object.entries(result.termFamilyTotals).map(([family, count]) => ({ family, count })), ["family", "count"])}
  <h2>Term Families By Page Type</h2>
  ${table(result.termFamilyByPageType, ["page_type", "family", "pages", "count", "words", "count_per_1000_words"])}
  <h2>Term Families By Year</h2>
  ${table(result.termFamilyByYear, ["year", "family", "pages", "count", "words", "count_per_1000_words"])}
  <h2>Page Snapshots</h2>
  ${table(result.pagesDetail.map((page) => ({ museum: page.museum, page_type: page.page_type, source_layer: page.source_layer, year: page.year, words: page.words, snippets: page.snippets.join(" / "), url: page.archive_url || page.url })), ["museum", "page_type", "source_layer", "year", "words", "snippets", "url"])}
  <h2>Interpretation</h2>
  <p>This is a longitudinal source-probe artifact. It can identify source coverage and terms for audit, but it should not support publication-level trend claims until archived pages and source genres are manually audited.</p>
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
    "# The Language Of Museums After Decolonization",
    "",
    "This is a research draft stub from a museum-language source probe. It is not publication copy yet.",
    "",
    "## Thesis To Test",
    "",
    "Museum language may have shifted from universal civilization and stewardship language toward provenance, restitution, community, access, and historical reckoning language.",
    "",
    "## Corpus Note",
    "",
    `The current artifact contains ${result.currentPages} current pages and ${result.historicalPages} historical snapshots across ${result.museums} museums and page types: ${result.pageTypes.join(", ")}.`,
    "",
    "## Current Baseline",
    "",
    `The largest term families in the current-page probe are ${Object.keys(result.termFamilyTotals).slice(0, 4).join(", ")}.`,
    "",
    "## What The Evidence Cannot Support Yet",
    "",
    "- It cannot make strong change-over-time claims until archived snippets and page genres are audited.",
    "- It cannot compare page genres as if they were equivalent.",
    "- It cannot make claims about museum practice, only public language in collected pages.",
    "",
    "## Next Moves",
    "",
    "- Add Wayback snapshots for 2000, 2010, 2015, 2020, and current-page equivalents.",
    "- Add annual reports, exhibition descriptions, collection pages, and provenance pages as separate source layers.",
    "- Audit snippets around high-signal terms before publication claims.",
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
    `Current pages: ${result.currentPages}`,
    `Historical snapshots: ${result.historicalPages}`,
    `Museums: ${result.museums}`,
    `Page types: ${result.pageTypes.join(", ")}`,
    "",
    "## Commands",
    "",
    "```bash",
    "node docs/experiments/museum-language-drift/scripts/fetch-current-pages.mjs",
    "node docs/experiments/museum-language-drift/scripts/fetch-wayback-snapshots.mjs",
    "node docs/experiments/museum-language-drift/scripts/build-report.mjs",
    "node docs/experiments/museum-language-drift/scripts/build-audit-packet.mjs",
    "node docs/experiments/museum-language-drift/scripts/check-readiness.mjs",
    "```",
    "",
    "## Outputs",
    "",
    "- `data/processed/pages.json`",
    "- `data/processed/page-term-counts.csv`",
    "- `data/processed/term-family-by-page-type.csv`",
    "- `data/processed/term-family-by-year.csv`",
    "- `reports/source-inventory.md`",
    "- `reports/report.html`",
    "- `reports/result.json`",
    "- `reports/public-draft.md`",
    "",
  ].join("\n");
}
