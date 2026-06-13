import fs from "node:fs/promises";
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
const representativeRows = parseCsv(await fs.readFile(path.join(processedDir, "representative-works.csv"), "utf8"));
const worksRows = parseCsv(await fs.readFile(path.join(processedDir, "works.csv"), "utf8"));
const readiness = await readJson(path.join(reportsDir, "readiness.json"));
const broadBackfill = await readJson(path.join(reportsDir, "broad-backfill-comparison.json"));
const worksByKey = new Map();
for (const work of worksRows) {
  for (const key of candidateKeys(work)) {
    if (key && !worksByKey.has(key)) worksByKey.set(key, work);
  }
}

const rows = representativeRows.map((row, index) => {
  const matched = findWork(row);
  const sourceName = row.source_name || matched?.source_name || "";
  const isCandidate = String(matched?.is_quantitative_humanities_candidate ?? "").toLowerCase() === "true";
  const flags = [];
  if (!matched) flags.push("not-matched-to-works-table");
  if (!row.url && !row.doi) flags.push("missing-source-url");
  if (!isCandidate) flags.push("not-quantitative-humanities-candidate");
  if (["openalex", "crossref", "doaj-oai", "doaj"].includes(sourceName)) flags.push("metadata-index-source");
  if (sourceName === "doaj-oai") flags.push("doaj-oai-source-bias");
  if ((Number(row.cited_by_count) || 0) > 1000) flags.push("high-citation-general-ai-risk");
  if (/\b(LLaMA|GPT-4|foundation language model|technical report)\b/i.test(row.title ?? "")) flags.push("likely-general-ai-not-humanities");
  return {
    review_id: `literature-radar-representative-${String(index + 1).padStart(3, "0")}`,
    review_status: "pending",
    field_claim_safe: "pending",
    title: row.title,
    publication_date: row.publication_date,
    year: matched?.year || yearFromDate(row.publication_date),
    venue_name: row.venue_name,
    source_name: sourceName,
    doi: row.doi,
    url: row.url || (row.doi ? `https://doi.org/${row.doi}` : ""),
    cited_by_count: Number(row.cited_by_count) || 0,
    is_quantitative_humanities_candidate: isCandidate,
    flags: flags.join("; "),
    reviewer_notes: "",
  };
});

const coverage = {
  rowCount: rows.length,
  pendingRows: rows.filter((row) => row.review_status === "pending").length,
  flaggedRows: rows.filter((row) => row.flags).length,
  sourceCounts: countBy(rows, "source_name"),
  yearCounts: countBy(rows, "year"),
  candidateRows: rows.filter((row) => row.is_quantitative_humanities_candidate).length,
  doajOaiRows: rows.filter((row) => row.source_name === "doaj-oai").length,
  unmatchedRows: rows.filter((row) => row.flags.includes("not-matched-to-works-table")).length,
};

await writeText(
  path.join(reportsDir, "representative-audit-packet.csv"),
  toCsv(rows, [
    "review_id",
    "review_status",
    "field_claim_safe",
    "title",
    "publication_date",
    "year",
    "venue_name",
    "source_name",
    "doi",
    "url",
    "cited_by_count",
    "is_quantitative_humanities_candidate",
    "flags",
    "reviewer_notes",
  ]),
);

await writeJson(path.join(reportsDir, "representative-audit-packet.json"), {
  generatedAt: new Date().toISOString(),
  status: rows.length ? "pending-review" : "no-representative-rows",
  corpus: readiness.corpus,
  broadBackfill: {
    status: broadBackfill.status,
    corpusTier: broadBackfill.corpusTier,
    rawHarvest: broadBackfill.rawHarvest,
    baselineComparison: broadBackfill.baselineComparison,
  },
  coverage,
  rows,
  reviewInstructions: [
    "Open each URL/DOI and verify the record is actually humanities, humanities-adjacent, or methods-relevant before citing it.",
    "Treat high-citation general AI records as context, not evidence of humanities publishing, unless the venue or abstract supports the claim.",
    "Keep DOAJ OAI source-bias caveats attached when a representative row comes from the broad backfill.",
    "Set field_claim_safe to yes only after human review; pending rows are artifact-ready but not publication-ready.",
  ],
});

await writeText(path.join(reportsDir, "representative-audit-packet.md"), buildMarkdown({ coverage, rows }));

console.log(`Built literature radar representative audit packet for ${rows.length} rows`);

function findWork(row) {
  for (const key of candidateKeys(row)) {
    const match = worksByKey.get(key);
    if (match) return match;
  }
  return null;
}

function candidateKeys(row) {
  return [
    row.doi ? `doi:${String(row.doi).toLowerCase()}` : "",
    row.url ? `url:${String(row.url).toLowerCase()}` : "",
    row.title ? `title:${normalizeKey(row.title)}` : "",
  ];
}

function normalizeKey(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function yearFromDate(value) {
  const match = String(value ?? "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key] || "unknown"] = (counts[item[key] || "unknown"] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))));
}

function buildMarkdown({ coverage, rows }) {
  return [
    "# Literature Radar Representative Audit Packet",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Status: ${rows.length ? "pending-review" : "no-representative-rows"}`,
    `Rows requiring review: ${coverage.rowCount}`,
    "",
    "## Coverage",
    "",
    `- Sources: ${formatCounts(coverage.sourceCounts)}`,
    `- Years: ${formatCounts(coverage.yearCounts)}`,
    `- Candidate rows: ${coverage.candidateRows}`,
    `- DOAJ OAI rows: ${coverage.doajOaiRows}`,
    `- Flagged rows: ${coverage.flaggedRows}`,
    `- Unmatched rows: ${coverage.unmatchedRows}`,
    "",
    "## Review Instructions",
    "",
    "- Open each URL/DOI before citing it.",
    "- Separate general AI records from humanities-field evidence.",
    "- Keep DOAJ OAI source-bias caveats attached.",
    "- Pending rows are artifact-ready but not publication-ready.",
    "",
    "## Rows",
    "",
    ...rows.slice(0, 100).flatMap((row) => [
      `### ${row.review_id}: ${row.title}`,
      "",
      `- Review status: ${row.review_status}`,
      `- Field-claim safe: ${row.field_claim_safe}`,
      `- Source: ${row.source_name || "unknown"}`,
      `- Year: ${row.year || "unknown"}`,
      `- Venue: ${row.venue_name || "unknown"}`,
      `- Quantitative humanities candidate: ${row.is_quantitative_humanities_candidate ? "yes" : "no"}`,
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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header = [], ...body] = rows.filter((items) => items.some((item) => item !== ""));
  return body.map((items) => Object.fromEntries(header.map((key, index) => [key, items[index] ?? ""])));
}
