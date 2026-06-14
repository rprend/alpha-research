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

const experimentDir = path.join(rootDir, "docs", "experiments", "kb-museum-collections-describe-acquisition-classification-public-domain-ima");
const processedOutDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const sourceMap = JSON.parse(await fs.readFile(path.join(experimentDir, "config", "source-map.json"), "utf8"));
const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const objects = await readJsonl(path.join(processedDir, "objects.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const rightsById = new Map(rights.map((row) => [row.local_id, row]));
const objectById = new Map(objects.map((row) => [row.local_id, row]));
const matchedSourceIds = new Set((sourceMap.matched_sources ?? [])
  .filter((source) => source.source_class === "cultural-collections")
  .map((source) => source.source_id));

const records = sourceDocuments
  .filter((row) => matchedSourceIds.has(row.source_id))
  .map((row) => normalizeObject(row, objectById.get(row.local_id), rightsById.get(row.local_id)));

const sourceRows = coverageBySource(records);
const fieldRows = fieldCoverage(records);
const classificationRows = rollup(records, ["source_id", "classification"], { requireField: "classification" }).slice(0, 200);
const departmentRows = rollup(records, ["source_id", "department"], { requireField: "department" }).slice(0, 200);
const dateRows = datePrecisionRows(records);
const acquisitionRows = acquisitionRowsBySource(records);
const imageRows = imageRowsBySource(records);
const publicDomainRows = publicDomainRowsBySource(records);
const representativeRows = representativeRecords(records);
const findings = buildFindings({ records, sourceRows, fieldRows, classificationRows, dateRows, acquisitionRows, imageRows, publicDomainRows, representativeRows });
const result = {
  generated_at: new Date().toISOString(),
  question: sourceMap.question,
  source_count: matchedSourceIds.size,
  object_rows: records.length,
  rows_with_dates: records.filter((row) => row.content_date_precision && row.content_date_precision !== "none").length,
  rows_with_classification: records.filter((row) => row.classification).length,
  rows_with_department: records.filter((row) => row.department).length,
  rows_with_acquisition_number: records.filter((row) => row.accession_number).length,
  rows_with_acquisition_year: records.filter((row) => row.accession_year).length,
  rows_with_image_url: records.filter((row) => row.image_url).length,
  rows_marked_public_domain: records.filter((row) => row.public_domain === true || row.public_domain === "true" || /cc0|public domain/i.test(`${row.share_license_status} ${row.rights_license}`)).length,
  rights_statuses: countBy(records, (row) => row.rights_status),
  findings,
  caveats: [
    "Rows are local KB object/collection metadata, not complete institutional collections.",
    "Image URLs are retained as metadata; media files are not stored and reuse requires item-level rights review.",
    "Public-domain and CC0 indicators are source metadata fields and should be verified before publication reuse.",
    "Acquisition coverage is source-specific: Met/Cleveland expose accession fields; LOC and Smithsonian rows often do not.",
    "Date precision is derived from source object/item date strings and accession years where available; raw date strings remain authoritative.",
  ],
};

await writeText(path.join(processedOutDir, "coverage-by-source.csv"), toCsv(sourceRows, ["source_id", "rows", "rows_with_dates", "rows_with_classification", "rows_with_department", "rows_with_accession_number", "rows_with_accession_year", "rows_with_image_url", "public_domain_or_cc0_rows", "rights_statuses"]));
await writeText(path.join(processedOutDir, "field-coverage.csv"), toCsv(fieldRows, ["source_id", "field", "rows", "filled_rows", "coverage_pct"]));
await writeText(path.join(processedOutDir, "classification-by-source.csv"), toCsv(classificationRows, ["source_id", "classification", "rows", "rows_with_dates", "rows_with_image_url", "public_domain_or_cc0_rows"]));
await writeText(path.join(processedOutDir, "department-by-source.csv"), toCsv(departmentRows, ["source_id", "department", "rows", "rows_with_dates", "rows_with_image_url", "public_domain_or_cc0_rows"]));
await writeText(path.join(processedOutDir, "date-precision-by-source.csv"), toCsv(dateRows, ["source_id", "content_date_kind", "content_date_precision", "rows", "min_year", "max_year"]));
await writeText(path.join(processedOutDir, "acquisition-by-source.csv"), toCsv(acquisitionRows, ["source_id", "rows", "rows_with_accession_number", "rows_with_accession_year", "accession_year_min", "accession_year_max"]));
await writeText(path.join(processedOutDir, "image-rights-by-source.csv"), toCsv(imageRows, ["source_id", "rows", "rows_with_image_url", "public_domain_or_cc0_rows", "image_and_public_domain_rows"]));
await writeText(path.join(processedOutDir, "public-domain-by-source.csv"), toCsv(publicDomainRows, ["source_id", "rows", "public_domain_or_cc0_rows", "public_domain_or_cc0_pct"]));
await writeText(path.join(processedOutDir, "representative-records.csv"), toCsv(representativeRows, ["local_id", "source_id", "title", "date", "classification", "department", "accession_number", "accession_year", "public_domain_or_cc0", "image_url", "source_url", "rights_status"]));
await writeJson(path.join(reportsDir, "result.json"), result);
await writeText(path.join(reportsDir, "work.md"), renderWorkReport({ result, sourceRows, fieldRows, classificationRows, dateRows, acquisitionRows, imageRows, representativeRows }));
await writeText(path.join(reportsDir, "public-draft.md"), renderPublicDraft({ result, sourceRows, classificationRows, acquisitionRows, imageRows, representativeRows }));

console.log(`Built museum collections analysis: ${records.length} object rows across ${matchedSourceIds.size} matched sources.`);

function normalizeObject(document, object, rights) {
  const merged = { ...(object ?? {}), ...document };
  return {
    local_id: merged.local_id,
    source_id: merged.source_id,
    source_native_id: merged.source_native_id ?? "",
    source_url: normalizeUrl(merged.source_url),
    title: cleanField(merged.title),
    type: cleanField(merged.type),
    date: cleanField(merged.date || merged.creation_date),
    content_date_kind: cleanField(merged.content_date_kind),
    content_date_precision: cleanField(merged.content_date_precision),
    content_year_start: cleanField(merged.content_year_start),
    content_year_end: cleanField(merged.content_year_end),
    department: cleanField(merged.department),
    culture: cleanField(merged.culture),
    classification: cleanField(merged.classification),
    medium: cleanField(merged.medium),
    artist: cleanField(merged.artist),
    accession_number: cleanField(merged.accession_number),
    accession_year: cleanField(merged.accession_year),
    public_domain: merged.public_domain,
    share_license_status: cleanField(merged.share_license_status),
    image_url: cleanField(merged.image_url),
    description: cleanField(merged.description),
    rights_license: rights?.license ?? "",
    rights_status: rights?.redistribution_status ?? "unknown",
  };
}

function coverageBySource(rows) {
  return Object.values(groupBy(rows, (row) => row.source_id)).map((group) => {
    const years = group.map((row) => numberOrBlank(row.content_year_start)).filter(Number.isFinite);
    const rightsCounts = countBy(group, (row) => row.rights_status);
    return {
      source_id: group[0].source_id,
      rows: group.length,
      rows_with_dates: group.filter(hasDate).length,
      rows_with_classification: group.filter((row) => row.classification).length,
      rows_with_department: group.filter((row) => row.department).length,
      rows_with_accession_number: group.filter((row) => row.accession_number).length,
      rows_with_accession_year: group.filter((row) => row.accession_year).length,
      rows_with_image_url: group.filter((row) => row.image_url).length,
      public_domain_or_cc0_rows: group.filter(isPublicDomainLike).length,
      min_year: years.length ? Math.min(...years) : "",
      max_year: years.length ? Math.max(...years) : "",
      rights_statuses: Object.entries(rightsCounts).map(([key, value]) => `${key}=${value}`).join("; "),
    };
  }).sort((a, b) => b.rows - a.rows || a.source_id.localeCompare(b.source_id));
}

function fieldCoverage(rows) {
  const fields = ["date", "content_date_precision", "department", "classification", "medium", "artist", "accession_number", "accession_year", "image_url", "description"];
  const output = [];
  for (const [sourceId, group] of Object.entries(groupBy(rows, (row) => row.source_id))) {
    for (const field of fields) {
      const filled = group.filter((row) => row[field] !== "" && row[field] != null).length;
      output.push({
        source_id: sourceId,
        field,
        rows: group.length,
        filled_rows: filled,
        coverage_pct: pct(filled, group.length),
      });
    }
  }
  return output.sort((a, b) => a.source_id.localeCompare(b.source_id) || b.coverage_pct - a.coverage_pct);
}

function rollup(rows, keys, options = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (options.requireField && !row[options.requireField]) continue;
    const key = keys.map((field) => row[field]).join("\t");
    const current = groups.get(key) ?? {
      ...Object.fromEntries(keys.map((field) => [field, row[field]])),
      rows: 0,
      rows_with_dates: 0,
      rows_with_image_url: 0,
      public_domain_or_cc0_rows: 0,
    };
    current.rows += 1;
    if (hasDate(row)) current.rows_with_dates += 1;
    if (row.image_url) current.rows_with_image_url += 1;
    if (isPublicDomainLike(row)) current.public_domain_or_cc0_rows += 1;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.rows - a.rows || JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function datePrecisionRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = [row.source_id, row.content_date_kind || "missing", row.content_date_precision || "missing"].join("\t");
    const current = groups.get(key) ?? {
      source_id: row.source_id,
      content_date_kind: row.content_date_kind || "missing",
      content_date_precision: row.content_date_precision || "missing",
      rows: 0,
      years: [],
    };
    current.rows += 1;
    const year = numberOrBlank(row.content_year_start);
    if (Number.isFinite(year)) current.years.push(year);
    groups.set(key, current);
  }
  return [...groups.values()].map((row) => ({
    ...row,
    min_year: row.years.length ? Math.min(...row.years) : "",
    max_year: row.years.length ? Math.max(...row.years) : "",
  })).sort((a, b) => a.source_id.localeCompare(b.source_id) || b.rows - a.rows);
}

function acquisitionRowsBySource(rows) {
  return Object.values(groupBy(rows, (row) => row.source_id)).map((group) => {
    const accessionYears = group.map((row) => numberOrBlank(row.accession_year)).filter(Number.isFinite);
    return {
      source_id: group[0].source_id,
      rows: group.length,
      rows_with_accession_number: group.filter((row) => row.accession_number).length,
      rows_with_accession_year: accessionYears.length,
      accession_year_min: accessionYears.length ? Math.min(...accessionYears) : "",
      accession_year_max: accessionYears.length ? Math.max(...accessionYears) : "",
    };
  }).sort((a, b) => b.rows_with_accession_number - a.rows_with_accession_number || a.source_id.localeCompare(b.source_id));
}

function imageRowsBySource(rows) {
  return Object.values(groupBy(rows, (row) => row.source_id)).map((group) => ({
    source_id: group[0].source_id,
    rows: group.length,
    rows_with_image_url: group.filter((row) => row.image_url).length,
    public_domain_or_cc0_rows: group.filter(isPublicDomainLike).length,
    image_and_public_domain_rows: group.filter((row) => row.image_url && isPublicDomainLike(row)).length,
  })).sort((a, b) => b.rows_with_image_url - a.rows_with_image_url || a.source_id.localeCompare(b.source_id));
}

function publicDomainRowsBySource(rows) {
  return Object.values(groupBy(rows, (row) => row.source_id)).map((group) => {
    const publicRows = group.filter(isPublicDomainLike).length;
    return {
      source_id: group[0].source_id,
      rows: group.length,
      public_domain_or_cc0_rows: publicRows,
      public_domain_or_cc0_pct: pct(publicRows, group.length),
    };
  }).sort((a, b) => b.public_domain_or_cc0_rows - a.public_domain_or_cc0_rows || a.source_id.localeCompare(b.source_id));
}

function representativeRecords(rows) {
  return rows
    .filter((row) => row.title)
    .map((row) => ({
      ...row,
      public_domain_or_cc0: isPublicDomainLike(row) ? "yes" : "no",
      score: (hasDate(row) ? 1 : 0) + (row.classification ? 1 : 0) + (row.department ? 1 : 0) + (row.accession_number ? 1 : 0) + (row.image_url ? 1 : 0) + (isPublicDomainLike(row) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.source_id.localeCompare(b.source_id) || a.title.localeCompare(b.title))
    .slice(0, 100);
}

function buildFindings({ records, sourceRows, classificationRows, acquisitionRows, imageRows, publicDomainRows, representativeRows }) {
  return {
    corpus: [
      `${records.length} local cultural-collection metadata rows across ${sourceRows.length} sources.`,
      `${records.filter(hasDate).length} rows carry derived object/item/acquisition year information.`,
      `${records.filter((row) => row.classification).length} rows include normalized classification/type metadata.`,
      `${records.filter((row) => row.image_url).length} rows include image URLs as metadata.`,
      `${records.filter(isPublicDomainLike).length} rows carry public-domain/CC0-like source indicators.`,
    ],
    top_sources: sourceRows.map((row) => `${row.source_id}: ${row.rows} rows, ${row.rows_with_dates} dated, ${row.rows_with_image_url} with image URLs`),
    acquisition: acquisitionRows.map((row) => `${row.source_id}: ${row.rows_with_accession_number} accession numbers, ${row.rows_with_accession_year} accession years`),
    image_rights: imageRows.map((row) => `${row.source_id}: ${row.rows_with_image_url} image URLs, ${row.image_and_public_domain_rows} also public-domain/CC0-like`),
    top_classifications: classificationRows.slice(0, 8).map((row) => `${row.source_id} ${row.classification}: ${row.rows} rows`),
    representative_titles: representativeRows.slice(0, 8).map((row) => `${row.source_id}: ${row.title} (${row.date || "undated"})`),
  };
}

function renderWorkReport({ result, sourceRows, fieldRows, classificationRows, dateRows, acquisitionRows, imageRows, representativeRows }) {
  return [
    "# Museum Collections Metadata Analysis",
    "",
    `Generated at: ${result.generated_at}`,
    "",
    "## Corpus",
    "",
    ...result.findings.corpus.map((line) => `- ${line}`),
    `- Rights statuses: ${Object.entries(result.rights_statuses).map(([key, value]) => `${key}=${value}`).join(", ")}`,
    "",
    "## Source Coverage",
    "",
    table(sourceRows, ["source_id", "rows", "rows_with_dates", "rows_with_classification", "rows_with_department", "rows_with_accession_number", "rows_with_accession_year", "rows_with_image_url", "public_domain_or_cc0_rows"]),
    "",
    "## Field Coverage",
    "",
    table(fieldRows.slice(0, 40), ["source_id", "field", "filled_rows", "rows", "coverage_pct"]),
    "",
    "## Classification Coverage",
    "",
    table(classificationRows.slice(0, 20), ["source_id", "classification", "rows", "rows_with_dates", "rows_with_image_url", "public_domain_or_cc0_rows"]),
    "",
    "## Date Precision",
    "",
    table(dateRows, ["source_id", "content_date_kind", "content_date_precision", "rows", "min_year", "max_year"]),
    "",
    "## Acquisition Fields",
    "",
    table(acquisitionRows, ["source_id", "rows", "rows_with_accession_number", "rows_with_accession_year", "accession_year_min", "accession_year_max"]),
    "",
    "## Image And Public-Domain Indicators",
    "",
    table(imageRows, ["source_id", "rows", "rows_with_image_url", "public_domain_or_cc0_rows", "image_and_public_domain_rows"]),
    "",
    "## Representative Records",
    "",
    table(representativeRows.slice(0, 20), ["source_id", "title", "date", "classification", "department", "accession_number", "accession_year", "public_domain_or_cc0", "image_url"]),
    "",
    "## Output Tables",
    "",
    "- `data/processed/coverage-by-source.csv`",
    "- `data/processed/field-coverage.csv`",
    "- `data/processed/classification-by-source.csv`",
    "- `data/processed/department-by-source.csv`",
    "- `data/processed/date-precision-by-source.csv`",
    "- `data/processed/acquisition-by-source.csv`",
    "- `data/processed/image-rights-by-source.csv`",
    "- `data/processed/public-domain-by-source.csv`",
    "- `data/processed/representative-records.csv`",
    "",
    "## Caveats",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
  ].join("\n");
}

function renderPublicDraft({ result, sourceRows, classificationRows, acquisitionRows, imageRows, representativeRows }) {
  return [
    "# Public Draft Scaffold: What Museum Metadata Makes Visible",
    "",
    "The local humanities knowledge base can compare museum and cultural-collection metadata at the level of fields: object dates, classification labels, departments, accession identifiers, image URLs, and public-domain/CC0-like indicators.",
    "",
    "## What The Local Corpus Contains",
    "",
    ...result.findings.corpus.map((line) => `- ${line}`),
    "",
    "Source coverage starts unevenly, which is itself one of the findings:",
    "",
    ...sourceRows.map((row) => `- ${row.source_id}: ${row.rows} rows, ${row.rows_with_dates} dated, ${row.rows_with_classification} classified, ${row.rows_with_image_url} with image URLs.`),
    "",
    "Acquisition fields are concentrated in sources that expose accession metadata:",
    "",
    ...acquisitionRows.map((row) => `- ${row.source_id}: ${row.rows_with_accession_number} accession numbers and ${row.rows_with_accession_year} accession years.`),
    "",
    "Image and rights metadata should be treated as an inspection guide, not a reuse license:",
    "",
    ...imageRows.map((row) => `- ${row.source_id}: ${row.rows_with_image_url} image URLs; ${row.image_and_public_domain_rows} also carry public-domain/CC0-like indicators.`),
    "",
    "Representative records to inspect first:",
    "",
    ...representativeRows.slice(0, 8).map((row) => `- ${row.source_id}: ${row.title} (${row.date || "undated"}; ${row.classification || "unclassified"}).`),
    "",
    "## What This Does Not Yet Prove",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
  ].join("\n");
}

function hasDate(row) {
  return row.content_date_precision && row.content_date_precision !== "none";
}

function isPublicDomainLike(row) {
  return row.public_domain === true
    || row.public_domain === "true"
    || /cc0|public domain/i.test(`${row.share_license_status} ${row.rights_license} ${row.rights_status}`);
}

function groupBy(rows, getKey) {
  const groups = {};
  for (const row of rows) {
    const key = getKey(row) || "unknown";
    (groups[key] ??= []).push(row);
  }
  return groups;
}

function countBy(rows, getKey) {
  const counts = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function pct(value, total) {
  return total ? Math.round((value / total) * 1000) / 10 : 0;
}

function numberOrBlank(value) {
  const number = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(number) ? number : "";
}

function cleanField(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeUrl(value) {
  if (!value) return "";
  if (String(value).startsWith("//")) return `https:${value}`;
  return String(value);
}

function table(rows, columns) {
  if (!rows.length) return "No rows.";
  return [
    `| ${columns.join(" |")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => escapeMd(row[column])).join(" | ")} |`),
  ].join("\n");
}

function escapeMd(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}
