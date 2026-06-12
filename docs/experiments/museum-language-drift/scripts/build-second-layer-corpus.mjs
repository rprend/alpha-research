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

const rawRoot = path.join(experimentDir, "data", "raw", "second-layer-sources");
const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const families = await readJson(path.join(experimentDir, "config", "term-families.json"));
const runDate = process.argv.find((arg) => arg.startsWith("--run-date="))?.split("=")[1] ?? (await latestRunDate());

if (!runDate) throw new Error("No museum second-layer source probe found. Run probe-second-layer-sources.mjs first.");

const runDir = path.join(rawRoot, runDate);
const manifest = await readJson(path.join(runDir, "manifest.json"));
const successful = manifest.requests.filter((request) => request.ok === true);
if (!successful.length) throw new Error(`No successful museum second-layer sources in ${runDir}`);

const pages = [];
const termRows = [];

for (const request of successful) {
  const htmlPath = path.join(experimentDir, request.responsePath);
  const html = await fs.readFile(htmlPath, "utf8");
  const text = cleanHtml(html);
  const words = text.split(/\s+/).filter(Boolean).length;
  const counts = countTerms(text, families);
  const highSignalTerms = counts.flatMap((row) => row.matchedTerms);
  const page = {
    museum: request.museum,
    page_type: request.page_type,
    source_layer: request.source_layer,
    year: Number(runDate.slice(0, 4)),
    url: request.url,
    archive_url: "",
    status: request.status,
    title: request.title ?? "",
    words,
    text_preview: text.slice(0, 800),
    snippets: snippets(text, highSignalTerms),
    raw_path: request.responsePath,
    term_counts: Object.fromEntries(counts.map((row) => [row.family, row.count])),
  };
  pages.push(page);

  for (const row of counts) {
    termRows.push({
      museum: page.museum,
      page_type: page.page_type,
      source_layer: page.source_layer,
      year: page.year,
      family: row.family,
      count: row.count,
      count_per_1000_words: page.words ? Number(((row.count / page.words) * 1000).toFixed(3)) : 0,
      matched_terms: row.matchedTerms.join("; "),
      url: page.url,
      raw_path: page.raw_path,
    });
  }
}

const pageTypeRows = aggregateByPageType(termRows, pages);
const readiness = buildReadiness({ manifest, pages, pageTypeRows });

await writeJson(path.join(processedDir, "second-layer-pages.json"), pages);
await writeText(
  path.join(processedDir, "second-layer-page-term-counts.csv"),
  toCsv(termRows, ["museum", "page_type", "source_layer", "year", "family", "count", "count_per_1000_words", "matched_terms", "url", "raw_path"]),
);
await writeText(
  path.join(processedDir, "second-layer-term-family-by-page-type.csv"),
  toCsv(pageTypeRows, ["page_type", "family", "pages", "museums", "count", "words", "count_per_1000_words"]),
);
await writeJson(path.join(reportsDir, "second-layer-corpus-readiness.json"), readiness);
await writeText(path.join(reportsDir, "second-layer-corpus-readiness.md"), buildMarkdown(readiness));

console.log(`Built museum second-layer corpus for ${pages.length} pages from ${runDate}`);

async function latestRunDate() {
  try {
    const entries = await fs.readdir(rawRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().at(-1);
  } catch {
    return "";
  }
}

function aggregateByPageType(rows, pages) {
  const pageMap = new Map(pages.map((page) => [`${page.museum}|${page.page_type}|${page.year}`, page]));
  const map = new Map();
  for (const row of rows) {
    const pageKey = `${row.museum}|${row.page_type}|${row.year}`;
    const key = `${row.page_type}|${row.family}`;
    const target = map.get(key) ?? {
      page_type: row.page_type,
      family: row.family,
      pageSet: new Set(),
      museumSet: new Set(),
      count: 0,
      words: 0,
    };
    target.pageSet.add(pageKey);
    target.museumSet.add(row.museum);
    target.count += row.count;
    target.words += pageMap.get(pageKey)?.words ?? 0;
    map.set(key, target);
  }
  return [...map.values()]
    .map((row) => ({
      page_type: row.page_type,
      family: row.family,
      pages: row.pageSet.size,
      museums: row.museumSet.size,
      count: row.count,
      words: row.words,
      count_per_1000_words: row.words ? Number(((row.count / row.words) * 1000).toFixed(3)) : 0,
    }))
    .sort((a, b) => a.page_type.localeCompare(b.page_type) || a.family.localeCompare(b.family));
}

function buildReadiness({ manifest, pages, pageTypeRows }) {
  const failed = manifest.requests.filter((request) => request.ok !== true);
  const pageTypeCounts = countBy(pages, "page_type");
  const museumCounts = countBy(pages, "museum");
  const requiredPageTypes = ["annual-report", "provenance", "repatriation"];
  const missingPageTypes = requiredPageTypes.filter((pageType) => !pageTypeCounts[pageType]);
  const status = failed.length || missingPageTypes.length ? "source-probed-needs-replacements" : "source-probed";
  return {
    generatedAt: new Date().toISOString(),
    runDate: manifest.runDate,
    status,
    corpusTier: "schema-probe",
    pages: pages.length,
    configuredSources: manifest.requests.length,
    failedOrExcludedSources: failed.length,
    pageTypeCounts,
    museumCounts,
    missingPageTypes,
    processedFiles: [
      "data/processed/second-layer-pages.json",
      "data/processed/second-layer-page-term-counts.csv",
      "data/processed/second-layer-term-family-by-page-type.csv",
    ],
    reportFiles: [
      "reports/second-layer-source-inventory.md",
      "reports/second-layer-corpus-readiness.md",
    ],
    pageTypeTermRows: pageTypeRows,
    blockers: [
      ...(failed.length ? ["Replace failed or low-word-count source routes before publication-scale claims."] : []),
      ...(missingPageTypes.length ? [`Add at least one accessible source for missing page types: ${missingPageTypes.join(", ")}.`] : []),
      "Add annual-report PDFs or report landing pages across more museums before annual-report claims.",
      "Add historical snapshots or recurring current snapshots before claiming second-layer change over time.",
      "Keep annual reports, provenance/repatriation pages, exhibitions, and collection notes separate in public claims.",
    ],
    nextActions: [
      "Replace inaccessible annual-report routes with report index pages, PDFs with extractable text, or archived copies.",
      "Add provenance and repatriation targets for museums that currently only have annual-report routes.",
      "Backfill historical snapshots for retained second-layer routes.",
      "Join second-layer page-type outputs into the main readiness gate after manual quote review.",
    ],
  };
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function buildMarkdown(readiness) {
  const pageTypeRows = Object.entries(readiness.pageTypeCounts).map(([pageType, count]) => `- ${pageType}: ${count}`);
  return [
    "# Museum Second-Layer Corpus Readiness",
    "",
    `Generated at: ${readiness.generatedAt}`,
    `Run date: ${readiness.runDate}`,
    `Status: ${readiness.status}`,
    `Corpus tier: ${readiness.corpusTier}`,
    "",
    "## Coverage",
    "",
    `- Processed pages: ${readiness.pages}`,
    `- Configured sources: ${readiness.configuredSources}`,
    `- Failed or excluded sources: ${readiness.failedOrExcludedSources}`,
    "",
    "## Page Type Counts",
    "",
    ...pageTypeRows,
    "",
    "## Processed Files",
    "",
    ...readiness.processedFiles.map((file) => `- \`${file}\``),
    "",
    "## Blockers Before Publication-Scale Claims",
    "",
    ...readiness.blockers.map((blocker) => `- ${blocker}`),
    "",
    "## Next Actions",
    "",
    ...readiness.nextActions.map((action) => `- ${action}`),
    "",
  ].join("\n");
}
