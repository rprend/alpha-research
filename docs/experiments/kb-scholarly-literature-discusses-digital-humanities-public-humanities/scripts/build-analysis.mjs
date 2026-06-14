import fs from "node:fs/promises";
import path from "node:path";
import {
  processedDir,
  readJsonl,
  rootDir,
  toCsv,
  writeJson,
  writeText,
} from "../../../../scripts/kb-lib.mjs";

const experimentDir = path.join(rootDir, "docs", "experiments", "kb-scholarly-literature-discusses-digital-humanities-public-humanities");
const processedOutDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const sourceMap = JSON.parse(await fs.readFile(path.join(experimentDir, "config", "source-map.json"), "utf8"));
const works = await readJsonl(path.join(processedDir, "works.jsonl"));
const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const rightsById = new Map(rights.map((row) => [row.local_id, row]));
const sourceDocumentById = new Map(sourceDocuments.map((row) => [row.local_id, row]));
const matchedSourceIds = new Set((sourceMap.matched_sources ?? [])
  .filter((source) => ["scholarly-metadata", "journals-and-reviews", "conference-programs"].includes(source.source_class))
  .map((source) => source.source_id));

const records = works
  .filter((work) => matchedSourceIds.has(work.source_id))
  .map((work) => normalizeWork(work, sourceDocumentById.get(work.local_id), rightsById.get(work.local_id)));

const termFamilies = {
  digital_humanities: ["digital humanities", "humanities computing", "computational humanities", "cultural analytics"],
  public_humanities: ["public humanities", "public scholarship", "public history", "public engagement"],
  ai_data_methods: ["artificial intelligence", " ai ", "machine learning", "data", "algorithm", "computational"],
  archives_memory: ["archive", "archives", "archival", "memory", "museum", "collection"],
  inclusion_field_boundary: ["inclusion", "diversity", "decolonial", "race", "gender", "field"],
};

const sourceRows = coverageBySource(records);
const yearRows = coverageByYear(records);
const venueRows = coverageByVenue(records);
const termRows = buildTermRows(records, termFamilies);
const sourceTermRows = rollupTerms(termRows, ["source_id"]);
const yearTermRows = rollupTerms(termRows, ["publication_year"]);
const representativeRows = representativeRecords(records, termRows);
const findings = buildFindings({ records, sourceRows, yearRows, venueRows, sourceTermRows, yearTermRows, representativeRows });
const result = {
  generated_at: new Date().toISOString(),
  question: sourceMap.question,
  source_count: matchedSourceIds.size,
  work_rows: records.length,
  rows_with_year: records.filter((row) => row.publication_year).length,
  rows_with_venue: records.filter((row) => row.venue).length,
  rows_with_doi: records.filter((row) => row.doi).length,
  year_min: min(records.map((row) => row.publication_year).filter(Boolean)),
  year_max: max(records.map((row) => row.publication_year).filter(Boolean)),
  rights_statuses: countBy(records, (row) => row.rights_status),
  findings,
  caveats: [
    "This analysis uses local KB metadata fields, mostly titles, venues, source labels, years, and rights rows; it does not analyze paywalled article full text.",
    "Term-family counts are title/venue metadata signals, not full-topic model classifications.",
    "DOAJ volume is broad humanities metadata and needs source-specific venue/topic filtering before strong claims about digital humanities prevalence.",
    "Person-level, institution-level, and citation-network claims require stronger authority matching than the current deterministic candidate clusters.",
    "Quotation-heavy publication requires source-specific quote review even when metadata redistribution is allowed.",
  ],
};

await writeText(path.join(processedOutDir, "coverage-by-source.csv"), toCsv(sourceRows, ["source_id", "rows", "rows_with_year", "rows_with_venue", "rows_with_doi", "min_year", "max_year", "rights_statuses"]));
await writeText(path.join(processedOutDir, "coverage-by-year.csv"), toCsv(yearRows, ["publication_year", "rows", "rows_with_doi", "source_count", "top_sources"]));
await writeText(path.join(processedOutDir, "coverage-by-venue.csv"), toCsv(venueRows, ["venue", "rows", "rows_with_year", "min_year", "max_year", "source_ids"]));
await writeText(path.join(processedOutDir, "term-family-by-source.csv"), toCsv(sourceTermRows, ["source_id", "family", "mentions", "records_with_mentions", "records"]));
await writeText(path.join(processedOutDir, "term-family-by-year.csv"), toCsv(yearTermRows, ["publication_year", "family", "mentions", "records_with_mentions", "records"]));
await writeText(path.join(processedOutDir, "representative-records.csv"), toCsv(representativeRows, ["local_id", "source_id", "publication_year", "title", "venue", "doi", "source_url", "rights_status", "term_families"]));
await writeJson(path.join(reportsDir, "result.json"), result);
await writeText(path.join(reportsDir, "work.md"), renderWorkReport({ result, sourceRows, yearRows, venueRows, sourceTermRows, yearTermRows, representativeRows }));
await writeText(path.join(reportsDir, "public-draft.md"), renderPublicDraft({ result, sourceRows, sourceTermRows, representativeRows }));

console.log(`Built scholarly literature analysis: ${records.length} work rows across ${matchedSourceIds.size} matched sources.`);

function normalizeWork(work, document, rights) {
  const publicationYear = Number.parseInt(String(work.publication_year || document?.publication_year || ""), 10);
  return {
    local_id: work.local_id,
    source_id: work.source_id,
    source_native_id: work.source_native_id || document?.source_native_id || "",
    source_url: work.source_url || document?.source_url || "",
    title: cleanField(work.title || document?.title || ""),
    publication_year: Number.isFinite(publicationYear) ? publicationYear : "",
    venue: cleanField(work.venue || document?.venue || ""),
    doi: cleanField(work.doi || document?.doi || ""),
    open_access: work.open_access ?? document?.open_access ?? "",
    type: work.type || document?.type || "",
    fetched_at: work.fetched_at || document?.fetched_at || "",
    rights_status: rights?.redistribution_status ?? "unknown",
    quote_status: rights?.quote_status ?? "",
  };
}

function coverageBySource(rows) {
  const groups = new Map();
  for (const row of rows) {
    const current = groups.get(row.source_id) ?? {
      source_id: row.source_id,
      rows: 0,
      rows_with_year: 0,
      rows_with_venue: 0,
      rows_with_doi: 0,
      years: [],
      rights: {},
    };
    current.rows += 1;
    if (row.publication_year) {
      current.rows_with_year += 1;
      current.years.push(row.publication_year);
    }
    if (row.venue) current.rows_with_venue += 1;
    if (row.doi) current.rows_with_doi += 1;
    current.rights[row.rights_status] = (current.rights[row.rights_status] ?? 0) + 1;
    groups.set(row.source_id, current);
  }
  return [...groups.values()].map((row) => ({
    ...row,
    min_year: min(row.years),
    max_year: max(row.years),
    rights_statuses: Object.entries(row.rights).map(([key, value]) => `${key}=${value}`).join("; "),
  })).sort((a, b) => b.rows - a.rows || a.source_id.localeCompare(b.source_id));
}

function coverageByYear(rows) {
  const groups = new Map();
  for (const row of rows.filter((entry) => entry.publication_year)) {
    const current = groups.get(row.publication_year) ?? {
      publication_year: row.publication_year,
      rows: 0,
      rows_with_doi: 0,
      sources: {},
    };
    current.rows += 1;
    if (row.doi) current.rows_with_doi += 1;
    current.sources[row.source_id] = (current.sources[row.source_id] ?? 0) + 1;
    groups.set(row.publication_year, current);
  }
  return [...groups.values()].map((row) => ({
    ...row,
    source_count: Object.keys(row.sources).length,
    top_sources: Object.entries(row.sources).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key, value]) => `${key}=${value}`).join("; "),
  })).sort((a, b) => a.publication_year - b.publication_year);
}

function coverageByVenue(rows) {
  const groups = new Map();
  for (const row of rows.filter((entry) => entry.venue)) {
    const key = row.venue.toLowerCase();
    const current = groups.get(key) ?? {
      venue: row.venue,
      rows: 0,
      rows_with_year: 0,
      years: [],
      sources: {},
    };
    current.rows += 1;
    if (row.publication_year) {
      current.rows_with_year += 1;
      current.years.push(row.publication_year);
    }
    current.sources[row.source_id] = (current.sources[row.source_id] ?? 0) + 1;
    groups.set(key, current);
  }
  return [...groups.values()].map((row) => ({
    ...row,
    min_year: min(row.years),
    max_year: max(row.years),
    source_ids: Object.entries(row.sources).sort((a, b) => b[1] - a[1]).map(([key, value]) => `${key}=${value}`).join("; "),
  })).sort((a, b) => b.rows - a.rows || a.venue.localeCompare(b.venue)).slice(0, 200);
}

function buildTermRows(rows, families) {
  const output = [];
  for (const row of rows) {
    const haystack = ` ${row.title} ${row.venue} ${row.type} `.toLowerCase();
    for (const [family, terms] of Object.entries(families)) {
      const mentions = terms.reduce((sum, term) => sum + countOccurrences(haystack, term), 0);
      output.push({
        local_id: row.local_id,
        source_id: row.source_id,
        publication_year: row.publication_year || "undated",
        venue: row.venue,
        family,
        mentions,
        has_mentions: mentions > 0 ? 1 : 0,
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
      records_with_mentions: 0,
      records: 0,
    };
    current.mentions += row.mentions;
    current.records_with_mentions += row.has_mentions;
    current.records += 1;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.mentions - a.mentions || String(a.family).localeCompare(String(b.family)));
}

function representativeRecords(records, termRows) {
  const familiesById = new Map();
  for (const row of termRows.filter((entry) => entry.mentions > 0)) {
    const families = familiesById.get(row.local_id) ?? new Set();
    families.add(row.family);
    familiesById.set(row.local_id, families);
  }
  const seen = new Set();
  const output = [];
  const candidates = records
    .filter((row) => familiesById.has(row.local_id))
    .map((row) => ({
      ...row,
      term_families: [...familiesById.get(row.local_id)].sort().join("; "),
      score: familiesById.get(row.local_id).size + (row.doi ? 0.25 : 0) + (row.publication_year ? 0.25 : 0),
    }))
    .sort((a, b) => b.score - a.score || String(b.publication_year).localeCompare(String(a.publication_year)) || a.title.localeCompare(b.title));
  for (const row of candidates) {
    const key = row.doi
      ? `doi:${row.doi.toLowerCase()}`
      : `title:${row.title.toLowerCase()}|${row.publication_year}|${row.source_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(row);
    if (output.length >= 100) break;
  }
  return output;
}

function buildFindings({ records, sourceRows, yearRows, venueRows, sourceTermRows, yearTermRows, representativeRows }) {
  const recentYears = yearRows.filter((row) => Number(row.publication_year) >= 2015).reduce((sum, row) => sum + row.rows, 0);
  return {
    corpus: [
      `${records.length} matched local work/article metadata records across ${sourceRows.length} sources.`,
      `${records.filter((row) => row.publication_year).length} records have publication years spanning ${min(records.map((row) => row.publication_year).filter(Boolean))}-${max(records.map((row) => row.publication_year).filter(Boolean))}.`,
      `${recentYears} dated records are from 2015 or later in the local matched corpus.`,
    ],
    top_sources: sourceRows.slice(0, 6).map((row) => `${row.source_id}: ${row.rows} records, ${row.rows_with_year} with years`),
    top_venues: venueRows.slice(0, 8).map((row) => `${row.venue}: ${row.rows} records (${row.min_year || "undated"}-${row.max_year || "undated"})`),
    term_families: sourceTermRows.filter((row) => row.mentions > 0).slice(0, 8).map((row) => `${row.source_id} ${row.family}: ${row.mentions} metadata mentions across ${row.records_with_mentions} records`),
    year_signals: yearTermRows.filter((row) => row.mentions > 0 && row.publication_year !== "undated").slice(0, 8).map((row) => `${row.publication_year} ${row.family}: ${row.mentions} mentions`),
    representative_titles: representativeRows.slice(0, 8).map((row) => `${row.publication_year || "undated"}: ${row.title} (${row.source_id})`),
  };
}

function renderWorkReport({ result, sourceRows, yearRows, venueRows, sourceTermRows, yearTermRows, representativeRows }) {
  return [
    "# Scholarly Literature Metadata Analysis",
    "",
    `Generated at: ${result.generated_at}`,
    "",
    "## Corpus",
    "",
    ...result.findings.corpus.map((line) => `- ${line}`),
    `- Rows with venues: ${result.rows_with_venue}`,
    `- Rows with DOIs: ${result.rows_with_doi}`,
    `- Rights statuses: ${Object.entries(result.rights_statuses).map(([key, value]) => `${key}=${value}`).join(", ")}`,
    "",
    "## Source Coverage",
    "",
    table(sourceRows, ["source_id", "rows", "rows_with_year", "rows_with_venue", "rows_with_doi", "min_year", "max_year"]),
    "",
    "## Top Venue Coverage",
    "",
    table(venueRows.slice(0, 20), ["venue", "rows", "rows_with_year", "min_year", "max_year"]),
    "",
    "## Term-Family Signals",
    "",
    table(sourceTermRows.filter((row) => row.mentions > 0).slice(0, 20), ["source_id", "family", "mentions", "records_with_mentions", "records"]),
    "",
    "## Year Signals",
    "",
    table(yearTermRows.filter((row) => row.mentions > 0 && row.publication_year !== "undated").slice(0, 20), ["publication_year", "family", "mentions", "records_with_mentions", "records"]),
    "",
    "## Representative Records",
    "",
    table(representativeRows.slice(0, 20), ["publication_year", "source_id", "title", "venue", "doi", "term_families"]),
    "",
    "## Output Tables",
    "",
    "- `data/processed/coverage-by-source.csv`",
    "- `data/processed/coverage-by-year.csv`",
    "- `data/processed/coverage-by-venue.csv`",
    "- `data/processed/term-family-by-source.csv`",
    "- `data/processed/term-family-by-year.csv`",
    "- `data/processed/representative-records.csv`",
    "",
    "## Caveats",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
  ].join("\n");
}

function renderPublicDraft({ result, sourceRows, sourceTermRows, representativeRows }) {
  return [
    "# Public Draft Scaffold: A Local Map Of Digital/Public Humanities Literature",
    "",
    "The local humanities knowledge base can already support a metadata-level field map of digital humanities and public humanities literature. This is not yet a full literature review from article text; it is a source-stratified map of records, years, venues, and title/venue signals available locally.",
    "",
    "## What The Local Corpus Contains",
    "",
    ...result.findings.corpus.map((line) => `- ${line}`),
    "",
    "The largest matched sources are:",
    "",
    ...sourceRows.slice(0, 5).map((row) => `- ${row.source_id}: ${row.rows} records, ${row.rows_with_year} with years.`),
    "",
    "The clearest metadata signals are:",
    "",
    ...sourceTermRows.filter((row) => row.mentions > 0).slice(0, 6).map((row) => `- ${row.source_id}: ${row.family} appears ${row.mentions} times across ${row.records_with_mentions} records.`),
    "",
    "Representative records to inspect first:",
    "",
    ...representativeRows.slice(0, 8).map((row) => `- ${row.publication_year || "undated"}: ${row.title} (${row.source_id}).`),
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
    `| ${columns.join(" |")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => escapeMd(row[column])).join(" | ")} |`),
  ].join("\n");
}

function countOccurrences(text, term) {
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
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

function min(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? Math.min(...nums) : "";
}

function max(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? Math.max(...nums) : "";
}

function cleanField(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeMd(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}
