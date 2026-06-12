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

if (!runDate) throw new Error("No second-layer source probe found. Run probe-second-layer-sources.mjs first.");

const runDir = path.join(rawRoot, runDate);
const manifest = await readJson(path.join(runDir, "manifest.json"));
const successful = manifest.requests.filter((request) => request.ok === true);
if (!successful.length) throw new Error(`No successful second-layer sources in ${runDir}`);

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
    institution: request.institution,
    source_layer: request.source_layer,
    source_genre: request.source_genre,
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
      institution: page.institution,
      source_layer: page.source_layer,
      source_genre: page.source_genre,
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

const genreRows = aggregateByGenre(termRows, pages);
const readiness = buildReadiness({ manifest, pages, genreRows });

await writeJson(path.join(processedDir, "second-layer-pages.json"), pages);
await writeText(
  path.join(processedDir, "second-layer-page-term-counts.csv"),
  toCsv(termRows, ["institution", "source_layer", "source_genre", "year", "family", "count", "count_per_1000_words", "matched_terms", "url", "raw_path"]),
);
await writeText(
  path.join(processedDir, "second-layer-term-family-by-genre.csv"),
  toCsv(genreRows, ["source_genre", "family", "pages", "institutions", "count", "words", "count_per_1000_words"]),
);
await writeJson(path.join(reportsDir, "second-layer-corpus-readiness.json"), readiness);
await writeText(path.join(reportsDir, "second-layer-corpus-readiness.md"), buildMarkdown(readiness));

console.log(`Built university second-layer corpus for ${pages.length} pages from ${runDate}`);

async function latestRunDate() {
  try {
    const entries = await fs.readdir(rawRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().at(-1);
  } catch {
    return "";
  }
}

function aggregateByGenre(rows, pages) {
  const pageMap = new Map(pages.map((page) => [`${page.institution}|${page.source_genre}|${page.year}`, page]));
  const map = new Map();
  for (const row of rows) {
    const pageKey = `${row.institution}|${row.source_genre}|${row.year}`;
    const key = `${row.source_genre}|${row.family}`;
    const target = map.get(key) ?? {
      source_genre: row.source_genre,
      family: row.family,
      pageSet: new Set(),
      institutionSet: new Set(),
      count: 0,
      words: 0,
    };
    target.pageSet.add(pageKey);
    target.institutionSet.add(row.institution);
    target.count += row.count;
    target.words += pageMap.get(pageKey)?.words ?? 0;
    map.set(key, target);
  }
  return [...map.values()]
    .map((row) => ({
      source_genre: row.source_genre,
      family: row.family,
      pages: row.pageSet.size,
      institutions: row.institutionSet.size,
      count: row.count,
      words: row.words,
      count_per_1000_words: row.words ? Number(((row.count / row.words) * 1000).toFixed(3)) : 0,
    }))
    .sort((a, b) => a.source_genre.localeCompare(b.source_genre) || a.family.localeCompare(b.family));
}

function buildReadiness({ manifest, pages, genreRows }) {
  const failed = manifest.requests.filter((request) => request.ok !== true);
  const genreCounts = countBy(pages, "source_genre");
  const institutionCounts = countBy(pages, "institution");
  const requiredGenres = ["catalog", "strategic-plan", "president-message"];
  const missingGenres = requiredGenres.filter((genre) => !genreCounts[genre]);
  const status = failed.length || missingGenres.length ? "source-probed-needs-replacements" : "source-probed";
  return {
    generatedAt: new Date().toISOString(),
    runDate: manifest.runDate,
    status,
    corpusTier: "schema-probe",
    pages: pages.length,
    configuredSources: manifest.requests.length,
    failedOrExcludedSources: failed.length,
    genreCounts,
    institutionCounts,
    missingGenres,
    processedFiles: [
      "data/processed/second-layer-pages.json",
      "data/processed/second-layer-page-term-counts.csv",
      "data/processed/second-layer-term-family-by-genre.csv",
    ],
    reportFiles: [
      "reports/second-layer-source-inventory.md",
      "reports/second-layer-corpus-readiness.md",
    ],
    genreTermRows: genreRows,
    blockers: [
      ...(failed.length ? ["Replace failed or low-word-count source routes before publication-scale claims."] : []),
      ...(missingGenres.length ? [`Add at least one accessible source for missing genres: ${missingGenres.join(", ")}.`] : []),
      "Add historical snapshots or recurring current snapshots before claiming second-layer change over time.",
      "Keep catalog, strategic-plan, and president-message language separate in public claims.",
    ],
    nextActions: [
      "Replace the inaccessible Stanford, Princeton, and Duke strategic-plan routes or use archive/sitemap alternatives.",
      "Add commencement speeches as a fourth source genre.",
      "Backfill historical snapshots for the retained second-layer routes.",
      "Join second-layer source genres into the main readiness gate after manual quote review.",
    ],
  };
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function buildMarkdown(readiness) {
  const genreRows = Object.entries(readiness.genreCounts).map(([genre, count]) => `- ${genre}: ${count}`);
  return [
    "# University Second-Layer Corpus Readiness",
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
    "## Genre Counts",
    "",
    ...genreRows,
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
