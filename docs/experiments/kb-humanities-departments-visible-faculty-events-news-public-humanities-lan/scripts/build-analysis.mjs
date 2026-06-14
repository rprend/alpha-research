import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  processedDir,
  readJsonl,
  rootDir,
  toCsv,
  writeJson,
  writeText,
} from "../../../../scripts/kb-lib.mjs";

const experimentDir = path.join(rootDir, "docs", "experiments", "kb-humanities-departments-visible-faculty-events-news-public-humanities-lan");
const processedOutDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const sourceMap = JSON.parse(await fs.readFile(path.join(experimentDir, "config", "source-map.json"), "utf8"));
const pages = await readJsonl(path.join(processedDir, "pages.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const rightsById = new Map(rights.map((row) => [row.local_id, row]));
const matchedSourceIds = new Set((sourceMap.matched_sources ?? [])
  .filter((source) => source.source_class === "university-department-web")
  .map((source) => source.source_id));

const pageRows = pages
  .filter((page) => matchedSourceIds.has(page.source_id))
  .map((page) => ({
    ...page,
    text_content: readTextIfAllowed(page.text_path),
    rights: rightsById.get(page.local_id) ?? null,
  }));

for (const row of pageRows) {
  row.text_content = await row.text_content;
}

const termFamilies = {
  public_humanities: ["public humanities", "public engagement", "public scholarship", "community", "communities", "civic", "outreach"],
  faculty_visibility: ["faculty", "people", "directory", "professor", "professors"],
  event_visibility: ["event", "events", "lecture", "lectures", "colloquium", "seminar", "calendar"],
  news_visibility: ["news", "story", "stories", "article", "announcements"],
  ai_digital: ["digital humanities", "digital", "data", "ai", "artificial intelligence", "computational"],
  inclusion_ethics: ["diversity", "inclusion", "equity", "ethics", "race", "gender", "justice"],
};

const coverageRows = coverageBySourceAndPageType(pageRows);
const termRows = buildTermRows(pageRows, termFamilies);
const sourceTermRows = rollupTerms(termRows, ["source_id"]);
const schoolTermRows = rollupTerms(termRows, ["school"]);
const pageTypeTermRows = rollupTerms(termRows, ["page_type"]);
const findings = buildFindings({ pageRows, coverageRows, sourceTermRows, pageTypeTermRows });
const result = {
  generated_at: new Date().toISOString(),
  question: sourceMap.question,
  source_count: matchedSourceIds.size,
  page_rows: pageRows.length,
  text_rows: pageRows.filter((row) => row.text_content).length,
  sitemap_only_rows: pageRows.filter((row) => row.status === "sitemap-only").length,
  rights_statuses: countBy(pageRows, (row) => row.rights?.redistribution_status ?? "unknown"),
  findings,
  caveats: [
    "Counts describe the local KB corpus, not the universe of humanities departments.",
    "Sitemap-only rows prove URL visibility, not page language, because no page text is stored for those rows.",
    "Page text is local-analysis-only; quote-level publication needs source-specific review.",
    "Fetch dates describe crawl coverage; longitudinal claims require historical snapshots and date normalization.",
  ],
};

await writeText(path.join(processedOutDir, "coverage-by-source-page-type.csv"), toCsv(coverageRows, ["source_id", "school", "page_type", "status", "rows", "rows_with_text", "rights_statuses"]));
await writeText(path.join(processedOutDir, "term-family-by-source.csv"), toCsv(sourceTermRows, ["source_id", "family", "mentions", "pages_with_mentions", "text_pages"]));
await writeText(path.join(processedOutDir, "term-family-by-school.csv"), toCsv(schoolTermRows, ["school", "family", "mentions", "pages_with_mentions", "text_pages"]));
await writeText(path.join(processedOutDir, "term-family-by-page-type.csv"), toCsv(pageTypeTermRows, ["page_type", "family", "mentions", "pages_with_mentions", "text_pages"]));
await writeJson(path.join(reportsDir, "result.json"), result);
await writeText(path.join(reportsDir, "work.md"), renderWorkReport({ result, coverageRows, sourceTermRows, pageTypeTermRows }));
await writeText(path.join(reportsDir, "public-draft.md"), renderPublicDraft({ result, sourceTermRows, pageTypeTermRows }));

console.log(`Built department visibility analysis: ${pageRows.length} page rows, ${result.text_rows} text rows.`);

function readTextIfAllowed(textPath) {
  if (!textPath) return "";
  const absolute = path.isAbsolute(textPath) ? textPath : path.join(rootDir, textPath);
  if (!existsSync(absolute)) return "";
  return fs.readFile(absolute, "utf8").catch(() => "");
}

function coverageBySourceAndPageType(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = [row.source_id, row.school, row.page_type, row.status].join("\t");
    const current = groups.get(key) ?? {
      source_id: row.source_id,
      school: row.school,
      page_type: row.page_type,
      status: row.status,
      rows: 0,
      rows_with_text: 0,
      rights: {},
    };
    current.rows += 1;
    if (row.text_content) current.rows_with_text += 1;
    const rightsStatus = row.rights?.redistribution_status ?? "unknown";
    current.rights[rightsStatus] = (current.rights[rightsStatus] ?? 0) + 1;
    groups.set(key, current);
  }
  return [...groups.values()]
    .map((row) => ({
      ...row,
      rights_statuses: Object.entries(row.rights).map(([key, value]) => `${key}=${value}`).join("; "),
    }))
    .sort((a, b) => b.rows - a.rows || a.source_id.localeCompare(b.source_id) || a.page_type.localeCompare(b.page_type));
}

function buildTermRows(rows, families) {
  const output = [];
  for (const row of rows.filter((entry) => entry.text_content)) {
    const text = row.text_content.toLowerCase();
    for (const [family, terms] of Object.entries(families)) {
      const mentions = terms.reduce((sum, term) => sum + countOccurrences(text, term), 0);
      output.push({
        local_id: row.local_id,
        source_id: row.source_id,
        school: row.school,
        department: row.department,
        page_type: row.page_type,
        family,
        mentions,
        has_mentions: mentions > 0 ? 1 : 0,
        text_chars: row.text_chars || row.text_content.length,
      });
    }
  }
  return output;
}

function rollupTerms(rows, keys) {
  const groups = new Map();
  for (const row of rows) {
    const key = [...keys.map((field) => row[field]), row.family].join("\t");
    const current = groups.get(key) ?? {
      ...Object.fromEntries(keys.map((field) => [field, row[field]])),
      family: row.family,
      mentions: 0,
      pages_with_mentions: 0,
      text_pages: 0,
    };
    current.mentions += row.mentions;
    current.pages_with_mentions += row.has_mentions;
    current.text_pages += 1;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.mentions - a.mentions || String(a.family).localeCompare(String(b.family)));
}

function buildFindings({ pageRows, coverageRows, sourceTermRows, pageTypeTermRows }) {
  const topSourceCoverage = coverageRows.slice(0, 5).map((row) => `${row.school} ${row.page_type}: ${row.rows} rows (${row.source_id})`);
  const topFamilies = sourceTermRows
    .filter((row) => row.mentions > 0)
    .slice(0, 8)
    .map((row) => `${row.source_id} ${row.family}: ${row.mentions} mentions across ${row.pages_with_mentions}/${row.text_pages} text pages`);
  const pageTypeSignals = pageTypeTermRows
    .filter((row) => row.mentions > 0)
    .slice(0, 8)
    .map((row) => `${row.page_type} ${row.family}: ${row.mentions} mentions`);
  return {
    coverage: topSourceCoverage,
    term_families: topFamilies,
    page_type_signals: pageTypeSignals,
    text_vs_metadata: `${pageRows.filter((row) => row.text_content).length} rows include local-analysis text; ${pageRows.filter((row) => row.status === "sitemap-only").length} rows are metadata-only sitemap URLs.`,
  };
}

function countOccurrences(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(`\\b${escaped}\\b`, "gi")) ?? []).length;
}

function countBy(rows, getKey) {
  const counts = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function renderWorkReport({ result, coverageRows, sourceTermRows, pageTypeTermRows }) {
  return [
    `# Department Visibility Analysis`,
    "",
    `Generated at: ${result.generated_at}`,
    "",
    "## Corpus",
    "",
    `- Page rows: ${result.page_rows}`,
    `- Text rows: ${result.text_rows}`,
    `- Sitemap-only rows: ${result.sitemap_only_rows}`,
    `- Rights statuses: ${Object.entries(result.rights_statuses).map(([key, value]) => `${key}=${value}`).join(", ")}`,
    "",
    "## Coverage Highlights",
    "",
    ...result.findings.coverage.map((finding) => `- ${finding}`),
    "",
    "## Term-Family Highlights",
    "",
    ...result.findings.term_families.map((finding) => `- ${finding}`),
    "",
    "## Page-Type Signals",
    "",
    ...result.findings.page_type_signals.map((finding) => `- ${finding}`),
    "",
    "## Output Tables",
    "",
    "- `data/processed/coverage-by-source-page-type.csv`",
    "- `data/processed/term-family-by-source.csv`",
    "- `data/processed/term-family-by-school.csv`",
    "- `data/processed/term-family-by-page-type.csv`",
    "",
    "## Caveats",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
    "## Top Coverage Rows",
    "",
    table(coverageRows.slice(0, 12), ["source_id", "page_type", "status", "rows", "rows_with_text"]),
    "",
    "## Top Source Term Rows",
    "",
    table(sourceTermRows.filter((row) => row.mentions > 0).slice(0, 12), ["source_id", "family", "mentions", "pages_with_mentions", "text_pages"]),
    "",
    "## Top Page-Type Term Rows",
    "",
    table(pageTypeTermRows.filter((row) => row.mentions > 0).slice(0, 12), ["page_type", "family", "mentions", "pages_with_mentions", "text_pages"]),
    "",
  ].join("\n");
}

function renderPublicDraft({ result, sourceTermRows, pageTypeTermRows }) {
  return [
    "# Public Draft Scaffold: Department Visibility In The Local Humanities KB",
    "",
    "The local humanities knowledge base can already distinguish two different kinds of institutional visibility: pages where text is locally analyzable, and sitemap-only URL metadata showing that departments expose news, events, program, or faculty routes.",
    "",
    "## What The Current Local Corpus Supports",
    "",
    `The promoted experiment covers ${result.page_rows} department/web page rows from matched university-department sources. Of those, ${result.text_rows} have local-analysis text and ${result.sitemap_only_rows} are metadata-only sitemap URLs.`,
    "",
    "The strongest text-level signals in this first pass are:",
    "",
    ...sourceTermRows.filter((row) => row.mentions > 0).slice(0, 5).map((row) => `- ${row.source_id}: ${row.family} appears ${row.mentions} times across ${row.pages_with_mentions} text pages.`),
    "",
    "By page type, the current local text and metadata suggest these starting points:",
    "",
    ...pageTypeTermRows.filter((row) => row.mentions > 0).slice(0, 5).map((row) => `- ${row.page_type}: ${row.family} appears ${row.mentions} times.`),
    "",
    "## What This Does Not Yet Prove",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
  ].join("\n");
}

function table(rows, columns) {
  if (!rows.length) return "No rows.";
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => String(row[column] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}
