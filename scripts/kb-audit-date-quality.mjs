import path from "node:path";
import {
  auditsDir,
  loadRegistry,
  processedDir,
  readJsonl,
  writeJson,
  writeText,
} from "./kb-lib.mjs";

const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const registry = await loadRegistry();
const sourceClassById = new Map((registry.sources ?? []).map((source) => [source.source_id, source.source_class]));

const auditTargets = [
  {
    target_id: "nber-culture-history",
    selector: (row) => row.source_id === "nber-culture-history",
    label: "NBER culture/history working papers",
    date_kind: "publication-date",
    accepted_sources: ["meta:citation_publication_date"],
    min_source_labeled_rate: 1,
    min_iso_date_rate: 1,
    min_year_rate: 1,
    min_fetch_rate: 1,
    note: "NBER rows should use page-level citation_publication_date metadata, not search-result display dates or crawl timestamps.",
  },
  {
    target_id: "ssrn-humanities-adjacent",
    selector: (row) => row.source_id === "ssrn-humanities-adjacent",
    label: "SSRN-adjacent Crossref posted-content metadata",
    date_kind: "posted-or-issued-year",
    accepted_sources: ["crossref:posted-content:issued"],
    min_source_labeled_rate: 1,
    min_iso_date_rate: 0,
    min_year_rate: 1,
    min_fetch_rate: 1,
    note: "SSRN rows currently come from Crossref posted-content metadata; publication_year is treated as an issued/posted year, not SSRN page full-text evidence.",
  },
  {
    target_id: "conference-programs",
    selector: (row) => sourceClassById.get(row.source_id) === "conference-programs",
    label: "Conference programs and conference pages",
    date_kind: "mixed-page-date-event-year",
    accepted_sources: [],
    min_source_labeled_rate: 0,
    min_iso_date_rate: 0,
    min_year_rate: 0.6,
    min_fetch_rate: 1,
    allow_fetch_date_only: true,
    allow_study_period_risk: true,
    min_precision_labeled_rate: 1,
    note: "Conference rows mix page/post dates, event-year records, and program metadata. The audit requires broad year coverage and fetch provenance, but does not treat these dates as normalized event dates yet.",
  },
  {
    target_id: "university-department-web",
    selector: (row) => sourceClassById.get(row.source_id) === "university-department-web",
    label: "University department and humanities-center web pages",
    date_kind: "crawl-snapshot-date",
    accepted_sources: [],
    min_source_labeled_rate: 0,
    min_iso_date_rate: 0,
    min_year_rate: 0,
    min_fetch_rate: 1,
    allow_fetch_date_only: true,
    allow_study_period_risk: true,
    note: "Department web rows are current-page crawl snapshots unless a source-specific event/page date is later extracted. `fetched_at` is provenance, not a content date.",
  },
  {
    target_id: "cultural-collections",
    selector: (row) => sourceClassById.get(row.source_id) === "cultural-collections",
    label: "Cultural collection item and object metadata",
    date_kind: "object-or-item-date",
    accepted_sources: [],
    min_source_labeled_rate: 0,
    min_iso_date_rate: 0,
    min_year_rate: 0.5,
    min_fetch_rate: 1,
    allow_fetch_date_only: true,
    allow_study_period_risk: true,
    min_precision_labeled_rate: 1,
    note: "Cultural collection rows use item/object dates and accession years where supplied. These are not publication dates and need source-specific precision parsing before strong object-date trend claims.",
  },
];

const source_reports = auditTargets.map((target) => auditTarget(target));
const report = {
  generated_at: new Date().toISOString(),
  audited_source_count: source_reports.length,
  status: source_reports.every((source) => source.status === "pass") ? "pass" : "fail",
  source_reports,
};

await writeJson(path.join(auditsDir, "date-quality.json"), report);
await writeText(path.join(auditsDir, "date-quality.md"), renderMarkdown(report));

console.log(`KB date-quality audit: ${report.status} (${report.audited_source_count} sources).`);

function auditTarget(rule) {
  const rows = sourceDocuments.filter(rule.selector);
  const details = rows.map((row) => classifyDate(row, rule));
  const counts = {
    rows: rows.length,
    rows_with_year: details.filter((row) => row.has_year).length,
    rows_with_iso_date: details.filter((row) => row.has_iso_date).length,
    rows_with_source_label: details.filter((row) => row.has_accepted_source_label).length,
    rows_with_fetch_timestamp: details.filter((row) => row.has_fetch_timestamp).length,
    rows_with_precision_label: details.filter((row) => row.has_precision_label).length,
    rows_with_fetch_date_only_risk: details.filter((row) => row.fetch_date_only_risk).length,
    rows_with_study_period_risk: details.filter((row) => row.study_period_risk).length,
  };
  const rates = {
    year_rate: rate(counts.rows_with_year, counts.rows),
    iso_date_rate: rate(counts.rows_with_iso_date, counts.rows),
    source_labeled_rate: rate(counts.rows_with_source_label, counts.rows),
    fetch_rate: rate(counts.rows_with_fetch_timestamp, counts.rows),
    precision_labeled_rate: rate(counts.rows_with_precision_label, counts.rows),
  };
  const failures = [];
  if (!counts.rows) failures.push("no local rows for audited source");
  if (rates.year_rate < rule.min_year_rate) failures.push(`year coverage ${pct(rates.year_rate)} below ${pct(rule.min_year_rate)}`);
  if (rates.iso_date_rate < rule.min_iso_date_rate) failures.push(`ISO date coverage ${pct(rates.iso_date_rate)} below ${pct(rule.min_iso_date_rate)}`);
  if (rates.source_labeled_rate < rule.min_source_labeled_rate) failures.push(`source-label coverage ${pct(rates.source_labeled_rate)} below ${pct(rule.min_source_labeled_rate)}`);
  if (rates.fetch_rate < rule.min_fetch_rate) failures.push(`fetch timestamp coverage ${pct(rates.fetch_rate)} below ${pct(rule.min_fetch_rate)}`);
  if (rates.precision_labeled_rate < (rule.min_precision_labeled_rate ?? 0)) failures.push(`precision-label coverage ${pct(rates.precision_labeled_rate)} below ${pct(rule.min_precision_labeled_rate)}`);
  if (!rule.allow_fetch_date_only && counts.rows_with_fetch_date_only_risk > 0) failures.push(`${counts.rows_with_fetch_date_only_risk} rows appear to use fetch/crawl date as content date`);
  if (!rule.allow_study_period_risk && counts.rows_with_study_period_risk > 0) failures.push(`${counts.rows_with_study_period_risk} rows may be using title/study-period years as content dates`);
  return {
    source_id: rule.target_id,
    label: rule.label,
    date_kind: rule.date_kind,
    status: failures.length ? "fail" : "pass",
    note: rule.note,
    counts,
    rates,
    accepted_sources: rule.accepted_sources,
    failures,
    examples: details.slice(0, 10),
  };
}

function classifyDate(row, rule) {
  const year = contentYear(row);
  const publicationDate = String(row.publication_date ?? "");
  const contentSource = String(row.content_date_source ?? "");
  const fetchedYear = String(row.fetched_at ?? "").slice(0, 4);
  const titleYears = [...String(row.title ?? "").matchAll(/\b(?:1[0-9]|20)\d{2}\b/g)].map((match) => match[0]);
  return {
    local_id: row.local_id,
    title: row.title ?? "",
    date_kind: rule.date_kind,
    publication_year: row.publication_year ?? "",
    date: row.date ?? "",
    accession_year: row.accession_year ?? "",
    publication_date: row.publication_date ?? "",
    content_date_kind: row.content_date_kind ?? "",
    content_date_precision: row.content_date_precision ?? "",
    content_year_start: row.content_year_start ?? "",
    content_year_end: row.content_year_end ?? "",
    content_date_source: row.content_date_source ?? "",
    has_year: Boolean(year),
    has_iso_date: /^\d{4}-\d{2}-\d{2}$/.test(publicationDate),
    has_accepted_source_label: rule.accepted_sources.includes(contentSource),
    has_fetch_timestamp: Boolean(row.fetched_at),
    has_precision_label: Boolean(row.content_date_kind && row.content_date_precision),
    fetch_date_only_risk: Boolean(year && fetchedYear && year === fetchedYear && !contentSource && !publicationDate),
    study_period_risk: titleYears.includes(year) && !contentSource && !publicationDate,
  };
}

function renderMarkdown(report) {
  return [
    "# KB Date Quality Audit",
    "",
    `Generated at: ${report.generated_at}`,
    `Status: ${report.status}`,
    "",
    ...report.source_reports.flatMap((source) => [
      `## ${source.source_id}`,
      "",
      `Status: ${source.status}`,
      `Date kind: ${source.date_kind}`,
      `Rows: ${source.counts.rows}`,
      `Year coverage: ${pct(source.rates.year_rate)}`,
      `ISO date coverage: ${pct(source.rates.iso_date_rate)}`,
      `Source-label coverage: ${pct(source.rates.source_labeled_rate)}`,
      `Fetch timestamp coverage: ${pct(source.rates.fetch_rate)}`,
      `Precision-label coverage: ${pct(source.rates.precision_labeled_rate)}`,
      `Fetch-date-only risks: ${source.counts.rows_with_fetch_date_only_risk}`,
      `Study-period risks: ${source.counts.rows_with_study_period_risk}`,
      "",
      source.failures.length ? `Failures: ${source.failures.join("; ")}` : "Failures: none",
      "",
      source.note,
      "",
    ]),
  ].join("\n");
}

function rate(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function pct(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

function contentYear(row) {
  if (row.content_year_start) return String(row.content_year_start);
  return String(row.publication_year ?? "").match(/\b(?:1[0-9]|20)\d{2}\b/)?.[0] ??
    String(row.publication_date ?? "").match(/\b(?:1[0-9]|20)\d{2}\b/)?.[0] ??
    String(row.date ?? "").match(/\b(?:1[0-9]|20)\d{2}\b/)?.[0] ??
    String(row.creation_date ?? "").match(/\b(?:1[0-9]|20)\d{2}\b/)?.[0] ??
    String(row.accession_year ?? "").match(/\b(?:1[0-9]|20)\d{2}\b/)?.[0] ??
    "";
}
