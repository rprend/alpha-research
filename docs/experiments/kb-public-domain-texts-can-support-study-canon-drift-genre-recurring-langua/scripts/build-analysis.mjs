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

const experimentDir = path.join(rootDir, "docs", "experiments", "kb-public-domain-texts-can-support-study-canon-drift-genre-recurring-langua");
const processedOutDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const sourceMap = JSON.parse(await fs.readFile(path.join(experimentDir, "config", "source-map.json"), "utf8"));
const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const works = await readJsonl(path.join(processedDir, "works.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const rightsById = new Map(rights.map((row) => [row.local_id, row]));
const workById = new Map(works.map((row) => [row.local_id, row]));

const matchedSourceIds = new Set((sourceMap.matched_sources ?? [])
  .filter((source) => ["public-domain-texts", "open-text-metadata"].includes(source.source_class))
  .map((source) => source.source_id));

const records = await Promise.all(sourceDocuments
  .filter((document) => matchedSourceIds.has(document.source_id))
  .map((document) => normalizeRecord(document, workById.get(document.local_id), rightsById.get(document.local_id))));

const termFamilies = {
  canon_language: ["classic", "masterpiece", "great book", "literature", "poetry", "novel"],
  genre_form: ["fiction", "essay", "poem", "poetry", "drama", "story", "tale", "letters"],
  social_world: ["society", "class", "labor", "work", "poverty", "city", "family"],
  empire_race_nation: ["empire", "race", "nation", "colonial", "slavery", "american", "english"],
  religion_morality: ["god", "religion", "faith", "sin", "virtue", "soul", "truth"],
  emotion_interiority: ["love", "death", "heart", "fear", "desire", "memory", "dream"],
  science_modernity: ["science", "machine", "electric", "modern", "progress", "experiment"],
};

const textRows = records.filter((row) => row.has_local_text);
const sourceRows = coverageBySource(records);
const rightsRows = coverageByRights(records);
const bookshelfRows = coverageByListField(textRows, "bookshelves", "bookshelf");
const subjectRows = coverageByListField(textRows, "subjects", "subject");
const termRows = buildTermRows(textRows, termFamilies);
const termRollupRows = rollupTerms(termRows, ["family"]);
const termByBookshelfRows = rollupTerms(termRows.filter((row) => row.top_bookshelf), ["top_bookshelf", "family"]);
const representativeRows = representativeRecords(textRows, termRows);
const discoveryRows = discoveryOnlyRecords(records);
const findings = buildFindings({
  records,
  textRows,
  sourceRows,
  rightsRows,
  bookshelfRows,
  subjectRows,
  termRollupRows,
  representativeRows,
  discoveryRows,
});

const result = {
  generated_at: new Date().toISOString(),
  question: sourceMap.question,
  source_count: matchedSourceIds.size,
  total_records: records.length,
  quote_ready_texts: textRows.length,
  discovery_only_records: records.filter((row) => !row.has_local_text).length,
  total_text_chars: sum(textRows, "text_chars_actual"),
  total_words_estimate: sum(textRows, "word_count"),
  rights_statuses: countBy(records, (row) => row.rights_status),
  quote_statuses: countBy(records, (row) => row.quote_status || "unknown"),
  findings,
  caveats: [
    "This experiment analyzes local Project Gutenberg text files and Internet Archive metadata already stored in the KB; it performs no fresh web scraping.",
    "Project Gutenberg texts are quote-ready under the local KB rights rows, but source-specific Gutenberg license/trademark notes still matter for republication packaging.",
    "Internet Archive rows are discovery-only metadata in this experiment; they are not treated as locally quote-ready full text.",
    "Publication-year coverage for imported Gutenberg rows is weak, so this pass supports corpus scoping and genre/language study more strongly than chronological canon-drift claims.",
    "Term-family counts are transparent dictionary signals over stored text, not a topic model or literary interpretation.",
  ],
};

await writeText(path.join(processedOutDir, "coverage-by-source.csv"), toCsv(sourceRows, ["source_id", "rows", "rows_with_local_text", "quote_ready_rows", "discovery_only_rows", "rows_with_subjects", "rows_with_bookshelves", "total_words", "rights_statuses"]));
await writeText(path.join(processedOutDir, "coverage-by-rights.csv"), toCsv(rightsRows, ["rights_status", "quote_status", "rows", "rows_with_local_text", "total_words"]));
await writeText(path.join(processedOutDir, "coverage-by-bookshelf.csv"), toCsv(bookshelfRows, ["bookshelf", "texts", "total_words", "example_titles"]));
await writeText(path.join(processedOutDir, "coverage-by-subject.csv"), toCsv(subjectRows, ["subject", "texts", "total_words", "example_titles"]));
await writeText(path.join(processedOutDir, "term-family-rollup.csv"), toCsv(termRollupRows, ["family", "mentions", "records_with_mentions", "records", "words"]));
await writeText(path.join(processedOutDir, "term-family-by-bookshelf.csv"), toCsv(termByBookshelfRows, ["top_bookshelf", "family", "mentions", "records_with_mentions", "records", "words"]));
await writeText(path.join(processedOutDir, "representative-texts.csv"), toCsv(representativeRows, ["local_id", "title", "author", "language", "word_count", "top_bookshelf", "term_families", "subjects", "source_url", "text_path", "rights_status", "quote_status"]));
await writeText(path.join(processedOutDir, "discovery-only-records.csv"), toCsv(discoveryRows, ["local_id", "source_id", "title", "creator", "publication_year", "source_url", "rights_status"]));
await writeJson(path.join(reportsDir, "result.json"), result);
await writeText(path.join(reportsDir, "work.md"), renderWorkReport({ result, sourceRows, rightsRows, bookshelfRows, subjectRows, termRollupRows, termByBookshelfRows, representativeRows, discoveryRows }));
await writeText(path.join(reportsDir, "public-draft.md"), renderPublicDraft({ result, sourceRows, bookshelfRows, termRollupRows, representativeRows }));

console.log(`Built public-domain text analysis: ${textRows.length} quote-ready texts, ${discoveryRows.length} discovery-only records.`);

async function normalizeRecord(document, work, rights) {
  const merged = { ...document, ...work };
  const textPath = cleanField(merged.text_path);
  const fullTextPath = textPath ? path.join(rootDir, textPath) : "";
  let text = "";
  let textExists = false;
  if (fullTextPath) {
    try {
      text = await fs.readFile(fullTextPath, "utf8");
      textExists = true;
    } catch {
      textExists = false;
    }
  }
  const wordCount = textExists ? countWords(text) : 0;
  const subjects = splitList(merged.subjects);
  const bookshelves = splitList(merged.bookshelves);
  return {
    local_id: document.local_id,
    source_id: document.source_id,
    source_native_id: document.source_native_id || "",
    source_url: document.source_url || "",
    title: cleanField(merged.title),
    author: cleanField(merged.author || merged.creator),
    creator: cleanField(merged.creator || merged.author),
    language: cleanField(merged.language),
    publication_year: parseYear(merged.publication_year),
    subjects,
    bookshelves,
    subject_text: subjects.join("; "),
    bookshelf_text: bookshelves.join("; "),
    top_bookshelf: bookshelves[0] || "",
    text_path: textPath,
    has_local_text: textExists,
    text_chars_declared: Number(merged.text_chars) || 0,
    text_chars_actual: text.length,
    word_count: wordCount,
    line_count: textExists ? text.split(/\r?\n/).length : 0,
    text_body: text,
    rights_status: rights?.redistribution_status ?? "unknown",
    quote_status: rights?.quote_status ?? "",
    full_text_allowed: rights?.full_text_allowed === true,
    metadata_allowed: rights?.metadata_allowed !== false,
  };
}

function coverageBySource(rows) {
  const groups = new Map();
  for (const row of rows) {
    const current = groups.get(row.source_id) ?? {
      source_id: row.source_id,
      rows: 0,
      rows_with_local_text: 0,
      quote_ready_rows: 0,
      discovery_only_rows: 0,
      rows_with_subjects: 0,
      rows_with_bookshelves: 0,
      total_words: 0,
      rights: {},
    };
    current.rows += 1;
    if (row.has_local_text) current.rows_with_local_text += 1;
    if (row.has_local_text && row.quote_status === "quote-public-domain") current.quote_ready_rows += 1;
    if (!row.has_local_text) current.discovery_only_rows += 1;
    if (row.subjects.length) current.rows_with_subjects += 1;
    if (row.bookshelves.length) current.rows_with_bookshelves += 1;
    current.total_words += row.word_count;
    current.rights[row.rights_status] = (current.rights[row.rights_status] ?? 0) + 1;
    groups.set(row.source_id, current);
  }
  return [...groups.values()].map((row) => ({
    ...row,
    rights_statuses: Object.entries(row.rights).map(([key, value]) => `${key}=${value}`).join("; "),
  })).sort((a, b) => b.rows - a.rows || a.source_id.localeCompare(b.source_id));
}

function coverageByRights(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.rights_status}\t${row.quote_status || "unknown"}`;
    const current = groups.get(key) ?? {
      rights_status: row.rights_status,
      quote_status: row.quote_status || "unknown",
      rows: 0,
      rows_with_local_text: 0,
      total_words: 0,
    };
    current.rows += 1;
    if (row.has_local_text) current.rows_with_local_text += 1;
    current.total_words += row.word_count;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.rows - a.rows || a.rights_status.localeCompare(b.rights_status));
}

function coverageByListField(rows, field, outputField) {
  const groups = new Map();
  for (const row of rows) {
    for (const value of row[field]) {
      const key = value.toLowerCase();
      const current = groups.get(key) ?? {
        [outputField]: value,
        texts: 0,
        total_words: 0,
        titles: [],
      };
      current.texts += 1;
      current.total_words += row.word_count;
      if (current.titles.length < 4) current.titles.push(row.title);
      groups.set(key, current);
    }
  }
  return [...groups.values()].map((row) => ({
    ...row,
    example_titles: row.titles.join("; "),
  })).sort((a, b) => b.texts - a.texts || String(a[outputField]).localeCompare(String(b[outputField]))).slice(0, 200);
}

function buildTermRows(rows, families) {
  const output = [];
  for (const row of rows) {
    const haystack = ` ${row.title} ${row.author} ${row.subject_text} ${row.bookshelf_text} ${row.text_body} `.toLowerCase();
    for (const [family, terms] of Object.entries(families)) {
      const mentions = terms.reduce((sumValue, term) => sumValue + countOccurrences(haystack, term), 0);
      output.push({
        local_id: row.local_id,
        source_id: row.source_id,
        title: row.title,
        top_bookshelf: row.top_bookshelf,
        family,
        mentions,
        has_mentions: mentions > 0 ? 1 : 0,
        words: row.word_count,
      });
    }
  }
  return output;
}

function rollupTerms(rows, keys) {
  const groups = new Map();
  for (const row of rows) {
    const key = [...keys.map((field) => row[field] || "unknown"), row.family].join("\t");
    const current = groups.get(key) ?? {
      ...Object.fromEntries(keys.map((field) => [field, row[field] || "unknown"])),
      family: row.family,
      mentions: 0,
      records_with_mentions: 0,
      records: 0,
      words: 0,
    };
    current.mentions += row.mentions;
    current.records_with_mentions += row.has_mentions;
    current.records += 1;
    current.words += row.words;
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
  return records
    .map((row) => ({
      ...row,
      term_families: [...(familiesById.get(row.local_id) ?? new Set())].sort().join("; "),
      score: (familiesById.get(row.local_id)?.size ?? 0) + Math.log10(Math.max(row.word_count, 1)) / 10 + (row.subjects.length ? 0.2 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.word_count - a.word_count || a.title.localeCompare(b.title))
    .slice(0, 100);
}

function discoveryOnlyRecords(rows) {
  return rows
    .filter((row) => !row.has_local_text)
    .sort((a, b) => String(b.publication_year).localeCompare(String(a.publication_year)) || a.title.localeCompare(b.title))
    .slice(0, 200);
}

function buildFindings({ records, textRows, sourceRows, rightsRows, bookshelfRows, subjectRows, termRollupRows, representativeRows, discoveryRows }) {
  return {
    corpus: [
      `${textRows.length} local texts are quote-ready public-domain files, totaling ${formatInt(sum(textRows, "word_count"))} estimated words.`,
      `${discoveryRows.length} matched records are discovery-only metadata, mostly useful for acquisition planning rather than immediate quotation.`,
      `${textRows.filter((row) => row.subjects.length).length} quote-ready texts have subject metadata and ${textRows.filter((row) => row.bookshelves.length).length} have bookshelf metadata.`,
    ],
    top_sources: sourceRows.map((row) => `${row.source_id}: ${row.rows} records, ${row.rows_with_local_text} with local text, ${row.quote_ready_rows} quote-ready`),
    rights: rightsRows.map((row) => `${row.rights_status}/${row.quote_status}: ${row.rows} records`),
    top_bookshelves: bookshelfRows.slice(0, 8).map((row) => `${row.bookshelf}: ${row.texts} texts`),
    top_subjects: subjectRows.slice(0, 8).map((row) => `${row.subject}: ${row.texts} texts`),
    term_families: termRollupRows.filter((row) => row.mentions > 0).slice(0, 8).map((row) => `${row.family}: ${row.mentions} mentions across ${row.records_with_mentions} texts`),
    representative_titles: representativeRows.slice(0, 8).map((row) => `${row.title} (${row.author || "unknown author"}, ${formatInt(row.word_count)} words)`),
    readiness: records.length && textRows.length
      ? "The KB can already support a first local-text scoping essay about quote-ready public-domain texts and recurring language families."
      : "The KB does not yet have enough local quote-ready public-domain text for this experiment.",
  };
}

function renderWorkReport({ result, sourceRows, rightsRows, bookshelfRows, subjectRows, termRollupRows, termByBookshelfRows, representativeRows, discoveryRows }) {
  return [
    "# Public-Domain Text Corpus Analysis",
    "",
    `Generated at: ${result.generated_at}`,
    "",
    "## Corpus",
    "",
    ...result.findings.corpus.map((line) => `- ${line}`),
    `- Total records: ${result.total_records}`,
    `- Rights statuses: ${Object.entries(result.rights_statuses).map(([key, value]) => `${key}=${value}`).join(", ")}`,
    "",
    "## Source Coverage",
    "",
    table(sourceRows, ["source_id", "rows", "rows_with_local_text", "quote_ready_rows", "discovery_only_rows", "rows_with_subjects", "rows_with_bookshelves", "total_words"]),
    "",
    "## Rights Coverage",
    "",
    table(rightsRows, ["rights_status", "quote_status", "rows", "rows_with_local_text", "total_words"]),
    "",
    "## Bookshelf Coverage",
    "",
    table(bookshelfRows.slice(0, 25), ["bookshelf", "texts", "total_words", "example_titles"]),
    "",
    "## Subject Coverage",
    "",
    table(subjectRows.slice(0, 25), ["subject", "texts", "total_words", "example_titles"]),
    "",
    "## Term-Family Signals",
    "",
    table(termRollupRows.filter((row) => row.mentions > 0).slice(0, 25), ["family", "mentions", "records_with_mentions", "records", "words"]),
    "",
    "## Term Families By Bookshelf",
    "",
    table(termByBookshelfRows.filter((row) => row.mentions > 0).slice(0, 30), ["top_bookshelf", "family", "mentions", "records_with_mentions", "records"]),
    "",
    "## Representative Quote-Ready Texts",
    "",
    table(representativeRows.slice(0, 25), ["title", "author", "word_count", "top_bookshelf", "term_families", "rights_status", "quote_status"]),
    "",
    "## Discovery-Only Metadata",
    "",
    table(discoveryRows.slice(0, 20), ["source_id", "title", "creator", "publication_year", "rights_status"]),
    "",
    "## Output Tables",
    "",
    "- `data/processed/coverage-by-source.csv`",
    "- `data/processed/coverage-by-rights.csv`",
    "- `data/processed/coverage-by-bookshelf.csv`",
    "- `data/processed/coverage-by-subject.csv`",
    "- `data/processed/term-family-rollup.csv`",
    "- `data/processed/term-family-by-bookshelf.csv`",
    "- `data/processed/representative-texts.csv`",
    "- `data/processed/discovery-only-records.csv`",
    "",
    "## Caveats",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
  ].join("\n");
}

function renderPublicDraft({ result, sourceRows, bookshelfRows, termRollupRows, representativeRows }) {
  return [
    "# Public Draft Scaffold: What The Local Public-Domain Corpus Can Support",
    "",
    "The local humanities knowledge base now has enough stored public-domain text to support a first essay about corpus readiness: which texts can be quoted, which genres are overrepresented, and which recurring language families are visible before doing any new scraping.",
    "",
    "## What The Local Corpus Contains",
    "",
    ...result.findings.corpus.map((line) => `- ${line}`),
    "",
    "The source split is:",
    "",
    ...sourceRows.map((row) => `- ${row.source_id}: ${row.rows} records, ${row.rows_with_local_text} with local text, ${row.discovery_only_rows} discovery-only.`),
    "",
    "The strongest bookshelf clusters are:",
    "",
    ...bookshelfRows.slice(0, 8).map((row) => `- ${row.bookshelf}: ${row.texts} texts.`),
    "",
    "The clearest recurring-language signals are:",
    "",
    ...termRollupRows.filter((row) => row.mentions > 0).slice(0, 7).map((row) => `- ${row.family}: ${row.mentions} mentions across ${row.records_with_mentions} texts.`),
    "",
    "Representative quote-ready texts to inspect first:",
    "",
    ...representativeRows.slice(0, 8).map((row) => `- ${row.title} by ${row.author || "unknown author"} (${formatInt(row.word_count)} words).`),
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
    ...rows.map((row) => `| ${columns.map((column) => escapeMd(row[column])).join(" | ")} |`),
  ].join("\n");
}

function splitList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(cleanField).filter(Boolean);
  return String(value).split(";").map(cleanField).filter(Boolean);
}

function parseYear(value) {
  const match = String(value ?? "").match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : "";
}

function countWords(text) {
  return (String(text).match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;
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

function sum(rows, field) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
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

function formatInt(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}
