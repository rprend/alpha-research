import path from "node:path";
import {
  experimentDir,
  readJson,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const sampleRows = await readJson(path.join(processedDir, "canon-openalex-sample-works.json"));
const pilot = await readJson(path.join(reportsDir, "canon-narrow-pilot.json"));
const authorConfig = await readJson(path.join(experimentDir, "config", "author-cohort.json"));
const authorAliases = new Map(authorConfig.map((author) => [
  author.name,
  [author.name, author.openalexSearch, ...(author.aliases ?? []), compactName(author.name)].filter(Boolean).map((value) => String(value).toLowerCase()),
]));

const rows = sampleRows.map((row, index) => {
  const aliases = authorAliases.get(row.author) ?? [String(row.author).toLowerCase()];
  const title = String(row.title ?? "");
  const titleLower = title.toLowerCase();
  const venueLower = String(row.venue ?? "").toLowerCase();
  const flags = [];
  const titleHasAlias = aliases.some((alias) => alias && titleLower.includes(alias));
  if (!titleHasAlias) flags.push("author-name-not-in-title");
  if (String(row.is_likely_relevant) !== "true") flags.push("heuristic-not-likely-relevant");
  if (/(cancer|oncology|molecular|genome|clinical|patient|disease|prostate|renal|cell carcinoma|mortality)/i.test(title)) flags.push("likely-biomedical-false-positive");
  if (/(physics|chemistry|engineering|algorithm|protein|genomic)/i.test(title)) flags.push("likely-non-humanities-field");
  if (/(nature|jama|oncology|medicine|clinical|biology|sciencedirect)/i.test(venueLower)) flags.push("venue-scope-risk");
  if (!row.url && !row.doi) flags.push("missing-source-url");
  return {
    review_id: `canon-openalex-sample-${String(index + 1).padStart(3, "0")}`,
    review_status: "pending",
    relevance_label: "pending",
    public_example_safe: "pending",
    author: row.author,
    cohort: row.cohort,
    title: row.title,
    year: row.year,
    venue: row.venue,
    cited_by_count: Number(row.cited_by_count) || 0,
    doi: row.doi,
    url: row.url || (row.doi ? `https://doi.org/${row.doi}` : ""),
    heuristic_likely_relevant: String(row.is_likely_relevant) === "true",
    relevance_note: row.relevance_note,
    flags: flags.join("; "),
    raw_path: row.raw_path,
    reviewer_notes: "",
  };
});

const coverage = {
  rowCount: rows.length,
  pendingRows: rows.filter((row) => row.review_status === "pending").length,
  flaggedRows: rows.filter((row) => row.flags).length,
  authorCounts: countBy(rows, "author"),
  cohortCounts: countBy(rows, "cohort"),
  yearCounts: countBy(rows, "year"),
  heuristicRelevantRows: rows.filter((row) => row.heuristic_likely_relevant).length,
  likelyBiomedicalFalsePositiveRows: rows.filter((row) => row.flags.includes("likely-biomedical-false-positive")).length,
};

await writeText(
  path.join(reportsDir, "sample-audit-packet.csv"),
  toCsv(rows, [
    "review_id",
    "review_status",
    "relevance_label",
    "public_example_safe",
    "author",
    "cohort",
    "title",
    "year",
    "venue",
    "cited_by_count",
    "doi",
    "url",
    "heuristic_likely_relevant",
    "relevance_note",
    "flags",
    "raw_path",
    "reviewer_notes",
  ]),
);

await writeJson(path.join(reportsDir, "sample-audit-packet.json"), {
  generatedAt: new Date().toISOString(),
  status: rows.length ? "pending-review" : "no-sample-rows",
  pilot: {
    signal: pilot.signal,
    source: pilot.source,
    dateRange: pilot.dateRange,
    authors: pilot.authors,
    sampleWorks: pilot.sampleWorks,
    rawManifest: pilot.rawManifest,
  },
  coverage,
  rows,
  reviewInstructions: [
    "Open each source URL/DOI before using the row as a public example.",
    "Label relevance as yes only when the work is about the target author, their works, reception, teaching, translation, adaptation, or clearly related canon discourse.",
    "Rows flagged as biomedical or non-humanities should be presumed false positives until proven otherwise.",
    "Keep claims limited to OpenAlex scholarly-discussion search behavior unless another source layer is added.",
    "Set public_example_safe to yes only after human review; pending rows are artifact-ready but not publication-ready.",
  ],
});

await writeText(path.join(reportsDir, "sample-audit-packet.md"), buildMarkdown({ coverage, rows }));

console.log(`Built Canon Drift sample audit packet for ${rows.length} OpenAlex sample works`);

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key] || "unknown"] = (counts[item[key] || "unknown"] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))));
}

function buildMarkdown({ coverage, rows }) {
  return [
    "# Canon Drift Sample Audit Packet",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Status: ${rows.length ? "pending-review" : "no-sample-rows"}`,
    `Rows requiring review: ${coverage.rowCount}`,
    "",
    "## Coverage",
    "",
    `- Authors: ${formatCounts(coverage.authorCounts)}`,
    `- Cohorts: ${formatCounts(coverage.cohortCounts)}`,
    `- Years: ${formatCounts(coverage.yearCounts)}`,
    `- Heuristic relevant rows: ${coverage.heuristicRelevantRows}`,
    `- Likely biomedical false positives: ${coverage.likelyBiomedicalFalsePositiveRows}`,
    `- Flagged rows: ${coverage.flaggedRows}`,
    "",
    "## Review Instructions",
    "",
    "- Open each source URL/DOI before using the row.",
    "- Label relevance only when the work is about the target author, their works, reception, teaching, translation, adaptation, or canon discourse.",
    "- Treat biomedical and non-humanities rows as false positives unless proven otherwise.",
    "- Keep claims limited to OpenAlex scholarly-discussion search behavior.",
    "- Pending rows are artifact-ready but not publication-ready.",
    "",
    "## Rows",
    "",
    ...rows.flatMap((row) => [
      `### ${row.review_id}: ${row.author} - ${row.title}`,
      "",
      `- Review status: ${row.review_status}`,
      `- Relevance label: ${row.relevance_label}`,
      `- Public-example safe: ${row.public_example_safe}`,
      `- Cohort: ${row.cohort}`,
      `- Year: ${row.year || "unknown"}`,
      `- Venue: ${row.venue || "unknown"}`,
      `- Citations: ${row.cited_by_count}`,
      `- Flags: ${row.flags || "none"}`,
      `- URL: ${row.url || "none"}`,
      "",
    ]),
  ].join("\n");
}

function formatCounts(counts) {
  const entries = Object.entries(counts);
  return entries.length ? entries.map(([key, count]) => `${key}: ${count}`).join("; ") : "none";
}

function compactName(value) {
  return String(value ?? "").replace(/[.\s]+/g, " ").trim();
}
