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
const artworks = await readJson(path.join(processedDir, "artworks.json"));

const rows = artworks.map((artwork) => {
  const flags = [];
  if (!artwork.accession_year) flags.push("missing-accession-number-year");
  if (!artwork.explicit_accession_year) flags.push("missing-explicit-accession-year");
  if (artwork.accession_year && artwork.explicit_accession_year && artwork.accession_year !== artwork.explicit_accession_year) flags.push("accession-year-mismatch");
  if (!artwork.creation_date_earliest || !artwork.creation_date_latest) flags.push("missing-creation-date-range");
  if (!artwork.has_image) flags.push("no-image");
  if (!artwork.culture?.length) flags.push("missing-culture");
  if ((artwork.provenance_entries ?? 0) === 0) flags.push("no-provenance-entries");
  return {
    id: artwork.id,
    accession_number: artwork.accession_number,
    title: artwork.title,
    department: artwork.department,
    accession_year: artwork.accession_year,
    accession_date: artwork.accession_date,
    explicit_accession_year: artwork.explicit_accession_year,
    accession_year_matches_explicit: artwork.accession_year_matches_explicit,
    creation_date: artwork.creation_date,
    creation_date_earliest: artwork.creation_date_earliest,
    creation_date_latest: artwork.creation_date_latest,
    culture: artwork.culture,
    share_license_status: artwork.share_license_status,
    has_image: artwork.has_image,
    provenance_entries: artwork.provenance_entries,
    flags: flags.join("; "),
    url: artwork.url,
  };
});

const flaggedRows = rows.filter((row) => row.flags);
const mismatchRows = rows.filter((row) => String(row.flags).includes("accession-year-mismatch"));
const missingExplicitRows = rows.filter((row) => String(row.flags).includes("missing-explicit-accession-year"));
const noImageRows = rows.filter((row) => String(row.flags).includes("no-image"));
const reviewRows = [
  ...mismatchRows.slice(0, 25),
  ...missingExplicitRows.slice(0, 25),
  ...noImageRows.slice(0, 25),
  ...flaggedRows.slice(0, 25),
]
  .filter((row, index, arr) => arr.findIndex((candidate) => candidate.id === row.id) === index)
  .slice(0, 100);

const summary = {
  generatedAt: new Date().toISOString(),
  recordCount: rows.length,
  flaggedRows: flaggedRows.length,
  mismatchRows: mismatchRows.length,
  missingExplicitAccessionYearRows: missingExplicitRows.length,
  noImageRows: noImageRows.length,
  reviewRows: reviewRows.length,
  flagCounts: countFlags(rows),
};

await writeJson(path.join(reportsDir, "audit-packet.json"), {
  ...summary,
  rows: reviewRows,
  reviewInstructions: [
    "Treat accession-number year as a proxy unless explicit accession_date confirms it.",
    "Manually review accession-year mismatches before publication claims about acquisition decades.",
    "Check no-image and license rows before making claims about public visual availability.",
    "Use provenance-entry counts as a coverage signal, not as a full provenance analysis.",
  ],
});
await writeText(path.join(reportsDir, "audit-packet.csv"), toCsv(reviewRows, [
  "id",
  "accession_number",
  "title",
  "department",
  "accession_year",
  "accession_date",
  "explicit_accession_year",
  "accession_year_matches_explicit",
  "creation_date",
  "creation_date_earliest",
  "creation_date_latest",
  "culture",
  "share_license_status",
  "has_image",
  "provenance_entries",
  "flags",
  "url",
]));
await writeText(path.join(reportsDir, "audit-packet.md"), buildMarkdown(summary, reviewRows));

console.log(`Built Cleveland audit packet with ${reviewRows.length} review rows`);

function countFlags(rows) {
  const counts = {};
  for (const row of rows) {
    for (const flag of String(row.flags || "").split("; ").filter(Boolean)) {
      counts[flag] = (counts[flag] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function buildMarkdown(summary, rows) {
  return [
    "# Cleveland Collection Shape Audit Packet",
    "",
    `Generated at: ${summary.generatedAt}`,
    `Records: ${summary.recordCount}`,
    `Flagged rows: ${summary.flaggedRows}`,
    `Accession-year mismatches: ${summary.mismatchRows}`,
    `Rows missing explicit accession year: ${summary.missingExplicitAccessionYearRows}`,
    `Rows without image: ${summary.noImageRows}`,
    "",
    "## Flag Counts",
    "",
    ...Object.entries(summary.flagCounts).map(([flag, count]) => `- ${flag}: ${count}`),
    "",
    "## Review Instructions",
    "",
    "- Treat accession-number year as a proxy unless explicit accession_date confirms it.",
    "- Manually review accession-year mismatches before publication claims about acquisition decades.",
    "- Check no-image and license rows before making claims about public visual availability.",
    "- Use provenance-entry counts as a coverage signal, not as a full provenance analysis.",
    "",
    "## Review Rows",
    "",
    ...rows.flatMap((row) => [
      `### ${row.title || row.id}`,
      "",
      `- ID: ${row.id}`,
      `- Accession: ${row.accession_number}`,
      `- Department: ${row.department}`,
      `- Accession year proxy: ${row.accession_year || "missing"}`,
      `- Explicit accession date: ${row.accession_date || "missing"}`,
      `- Creation date: ${row.creation_date || "missing"}`,
      `- Image: ${row.has_image ? "yes" : "no"}`,
      `- Provenance entries: ${row.provenance_entries}`,
      `- Flags: ${row.flags || "none"}`,
      `- URL: ${row.url}`,
      "",
    ]),
  ].join("\n");
}
