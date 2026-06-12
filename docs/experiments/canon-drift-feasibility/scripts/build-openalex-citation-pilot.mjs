import path from "node:path";
import {
  ensureDir,
  experimentDir,
  readJson,
  slug,
  today,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const args = parseArgs();
const runDate = args["run-date"] ?? process.env.CANON_DRIFT_RUN_DATE ?? today();
const fromYear = Number(args["from-year"] ?? 2010);
const toYear = Number(args["to-year"] ?? 2026);
const sampleSize = Number(args["sample-size"] ?? 20);
const timeoutMs = Number(args.timeout ?? 20000);
const cohort = await readJson(path.join(experimentDir, "config", "author-cohort.json"));
const rawDir = path.join(experimentDir, "data", "raw", "openalex-citation-pilot", runDate);
const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const manifest = {
  runDate,
  source: "OpenAlex works search grouped by publication_year",
  signal: "citation-or-scholarly-discussion",
  cohort: "existing six-author canon feasibility cohort",
  fromYear,
  toYear,
  sampleSize,
  startedAt: new Date().toISOString(),
  requests: [],
  errors: [],
};

await ensureDir(rawDir);

const yearlyRows = [];
const sampleRows = [];

for (const author of cohort) {
  const authorSlug = slug(author.name);
  const grouped = await fetchGroupedCounts(author);
  if (grouped) {
    await writeJson(path.join(rawDir, `${authorSlug}-year-counts.json`), grouped.json);
    for (const row of grouped.rows) yearlyRows.push(row);
  }

  const sample = await fetchSampleWorks(author);
  if (sample) {
    await writeJson(path.join(rawDir, `${authorSlug}-sample-works.json`), sample.json);
    sampleRows.push(...sample.rows);
  }
}

manifest.finishedAt = new Date().toISOString();
manifest.recordCount = yearlyRows.length;
manifest.sampleRecordCount = sampleRows.length;
await writeJson(path.join(rawDir, "manifest.json"), manifest);

const authorSummaries = summarizeAuthors(yearlyRows, sampleRows);
const trendRows = yearlyRows.sort((a, b) => a.author.localeCompare(b.author) || Number(a.year) - Number(b.year));
const report = {
  generatedAt: new Date().toISOString(),
  status: "signal-specific-pilot",
  corpusTier: "pilot-corpus",
  signal: "citation-or-scholarly-discussion",
  source: "OpenAlex",
  dateRange: { fromYear, toYear },
  authors: cohort.map((author) => author.name),
  rawManifest: path.relative(experimentDir, path.join(rawDir, "manifest.json")),
  yearlyRows: trendRows.length,
  sampleWorks: sampleRows.length,
  authorSummaries,
  strongestFinding: "This pilot can compare scholarly-discussion volume for one author cohort over time, but it is not a teaching, anthology, or general canon-rank measure.",
  blockersBeforeCanonClaims: [
    "OpenAlex search counts can include loose mentions, namesakes, author-byline matches, and broad full-text hits.",
    "Citation/scholarly-discussion volume is one signal layer, not canon status by itself.",
    "Manual relevance review is required before using individual records as examples.",
    "Assignment-level claims still require Open Syllabus/export access or a separate public-syllabus corpus.",
  ],
  nextActions: [
    "Manually audit the sample works for each author and label false positives.",
    "Add normalized author aliases and exclusion terms before larger OpenAlex claims.",
    "Choose a narrower cohort if the pilot becomes a public essay.",
    "Keep trend language limited to scholarly discussion unless teaching or anthology layers are added.",
  ],
};

await writeJson(path.join(processedDir, "canon-openalex-year-counts.json"), trendRows);
await writeText(
  path.join(processedDir, "canon-openalex-year-counts.csv"),
  toCsv(trendRows, ["author", "cohort", "year", "count", "share_of_author_total", "source", "query", "raw_path"]),
);
await writeJson(path.join(processedDir, "canon-openalex-sample-works.json"), sampleRows);
await writeText(
  path.join(processedDir, "canon-openalex-sample-works.csv"),
  toCsv(sampleRows, ["author", "cohort", "title", "year", "cited_by_count", "doi", "url", "venue", "is_likely_relevant", "relevance_note", "raw_path"]),
);
await writeJson(path.join(reportsDir, "canon-narrow-pilot.json"), report);
await writeText(path.join(reportsDir, "canon-narrow-pilot.md"), buildMarkdown(report));

console.log(`Built canon OpenAlex citation pilot for ${cohort.length} authors and ${trendRows.length} author-year rows`);

async function fetchGroupedCounts(author) {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", author.openalexSearch);
  url.searchParams.set("filter", `from_publication_date:${fromYear}-01-01,to_publication_date:${toYear}-12-31`);
  url.searchParams.set("group_by", "publication_year");
  url.searchParams.set("per-page", "200");
  const responsePath = path.join(rawDir, `${slug(author.name)}-year-counts.json`);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "alpha-research-canon-openalex-pilot/0.1" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = await response.json();
    manifest.requests.push({
      author: author.name,
      requestType: "year-counts",
      url: String(url),
      status: response.status,
      totalCount: json.meta?.count ?? 0,
      groupsCount: json.meta?.groups_count ?? 0,
      responsePath: path.relative(experimentDir, responsePath),
    });
    if (!response.ok) {
      manifest.errors.push({ author: author.name, requestType: "year-counts", status: response.status, body: JSON.stringify(json).slice(0, 1000) });
      return null;
    }
    const total = Number(json.meta?.count ?? 0);
    return {
      json,
      rows: (json.group_by ?? []).map((group) => ({
        author: author.name,
        cohort: author.cohort,
        year: group.key,
        count: group.count,
        share_of_author_total: total ? Number((group.count / total).toFixed(4)) : 0,
        source: "OpenAlex",
        query: author.openalexSearch,
        raw_path: path.relative(experimentDir, responsePath),
      })),
    };
  } catch (error) {
    manifest.requests.push({ author: author.name, requestType: "year-counts", url: String(url), status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
    manifest.errors.push({ author: author.name, requestType: "year-counts", error: error.message });
    return null;
  }
}

async function fetchSampleWorks(author) {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", author.openalexSearch);
  url.searchParams.set("filter", `from_publication_date:${fromYear}-01-01,to_publication_date:${toYear}-12-31`);
  url.searchParams.set("sort", "cited_by_count:desc");
  url.searchParams.set("per-page", String(sampleSize));
  const responsePath = path.join(rawDir, `${slug(author.name)}-sample-works.json`);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "alpha-research-canon-openalex-pilot/0.1" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = await response.json();
    manifest.requests.push({
      author: author.name,
      requestType: "sample-works",
      url: String(url),
      status: response.status,
      resultCount: json.results?.length ?? 0,
      responsePath: path.relative(experimentDir, responsePath),
    });
    if (!response.ok) {
      manifest.errors.push({ author: author.name, requestType: "sample-works", status: response.status, body: JSON.stringify(json).slice(0, 1000) });
      return null;
    }
    return {
      json,
      rows: (json.results ?? []).map((work) => {
        const relevance = likelyRelevant(work, author);
        return {
          author: author.name,
          cohort: author.cohort,
          title: work.display_name ?? "",
          year: work.publication_year ?? "",
          cited_by_count: work.cited_by_count ?? 0,
          doi: String(work.doi ?? "").replace(/^https:\/\/doi.org\//, ""),
          url: work.primary_location?.landing_page_url ?? work.id ?? "",
          venue: work.primary_location?.source?.display_name ?? "",
          is_likely_relevant: relevance.ok,
          relevance_note: relevance.note,
          raw_path: path.relative(experimentDir, responsePath),
        };
      }),
    };
  } catch (error) {
    manifest.requests.push({ author: author.name, requestType: "sample-works", url: String(url), status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
    manifest.errors.push({ author: author.name, requestType: "sample-works", error: error.message });
    return null;
  }
}

function summarizeAuthors(rows, samples) {
  return cohort.map((author) => {
    const authorRows = rows.filter((row) => row.author === author.name);
    const total = authorRows.reduce((sum, row) => sum + Number(row.count), 0);
    const peak = [...authorRows].sort((a, b) => Number(b.count) - Number(a.count))[0] ?? null;
    const sample = samples.filter((row) => row.author === author.name);
    return {
      author: author.name,
      cohort: author.cohort,
      totalCount: total,
      yearsRepresented: authorRows.length,
      peakYear: peak?.year ?? "",
      peakYearCount: peak?.count ?? 0,
      likelyRelevantSampleWorks: sample.filter((row) => row.is_likely_relevant).length,
      sampleWorks: sample.length,
    };
  });
}

function likelyRelevant(work, author) {
  const title = String(work.display_name ?? "").toLowerCase();
  const authorTokens = author.openalexSearch.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1);
  const matched = authorTokens.filter((token) => title.includes(token));
  if (matched.length >= Math.min(2, authorTokens.length)) return { ok: true, note: "title contains author-name tokens" };
  if (matched.length === 1 && authorTokens.length === 1) return { ok: true, note: "title contains author token" };
  return { ok: false, note: "needs manual review; title does not clearly contain author-name tokens" };
}

function buildMarkdown(report) {
  return [
    "# Canon Narrow Pilot: OpenAlex Scholarly Discussion",
    "",
    `Generated at: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Corpus tier: ${report.corpusTier}`,
    `Signal: ${report.signal}`,
    `Source: ${report.source}`,
    `Date range: ${report.dateRange.fromYear}-${report.dateRange.toYear}`,
    "",
    "## Coverage",
    "",
    `- Authors: ${report.authors.length}`,
    `- Author-year rows: ${report.yearlyRows}`,
    `- Sample works for audit: ${report.sampleWorks}`,
    `- Raw manifest: \`${report.rawManifest}\``,
    "",
    "## Author Summary",
    "",
    "| Author | Total Count | Years | Peak Year | Peak Count | Likely Relevant Sample Works |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...report.authorSummaries.map((row) => `| ${row.author} | ${row.totalCount} | ${row.yearsRepresented} | ${row.peakYear} | ${row.peakYearCount} | ${row.likelyRelevantSampleWorks}/${row.sampleWorks} |`),
    "",
    "## Interpretation",
    "",
    report.strongestFinding,
    "",
    "## Blockers Before Canon Claims",
    "",
    ...report.blockersBeforeCanonClaims.map((item) => `- ${item}`),
    "",
    "## Next Actions",
    "",
    ...report.nextActions.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}
