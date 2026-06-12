import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const result = await readJson(path.join(reportsDir, "result.json"));
const audit = await readJson(path.join(reportsDir, "audit-packet.json"));
const readiness = await readOptionalJson(path.join(reportsDir, "readiness.json"));

const image = Object.fromEntries(result.imageAvailability.map((row) => [row.value, row]));
const paths = {
  draft: "docs/experiments/cleveland-museum-collection-shape/reports/publication-draft.md",
  result: "docs/experiments/cleveland-museum-collection-shape/reports/result.json",
  readiness: "docs/experiments/cleveland-museum-collection-shape/reports/readiness.json",
  auditPacket: "docs/experiments/cleveland-museum-collection-shape/reports/audit-packet.md",
  auditPacketJson: "docs/experiments/cleveland-museum-collection-shape/reports/audit-packet.json",
  processedRecords: "docs/experiments/cleveland-museum-collection-shape/data/processed/artworks.csv",
};

const chartCaptions = [
  {
    id: "departments",
    path: "docs/experiments/cleveland-museum-collection-shape/reports/charts/departments.svg",
    caption: `Top departments in the ${result.sampleRecords.toLocaleString()}-record Cleveland sample. Department counts show dataset shape, not cultural importance.`,
  },
  {
    id: "creation-centuries",
    path: "docs/experiments/cleveland-museum-collection-shape/reports/charts/creation-centuries.svg",
    caption: "Creation-century buckets from normalized earliest creation dates; blunt time buckets hide date uncertainty.",
  },
  {
    id: "acquisition-decades",
    path: "docs/experiments/cleveland-museum-collection-shape/reports/charts/acquisition-decades.svg",
    caption: `Accession-number decade proxy; ${audit.mismatchRows.toLocaleString()} mismatches against explicit accession_date in audit.`,
  },
  {
    id: "image-availability",
    path: "docs/experiments/cleveland-museum-collection-shape/reports/charts/image-availability.svg",
    caption: `Visual availability in sample; ${(image["has-image"]?.count ?? 0).toLocaleString()} has image, ${(image["no-image"]?.count ?? 0).toLocaleString()} no image.`,
  },
];

const claimChecklist = [
  `Say this is a bounded ${result.sampleRecords.toLocaleString()}-record sample, not the full Cleveland collection.`,
  `Mention ${result.totalAvailable.toLocaleString()} total API records were available at collection time.`,
  "Do not generalize from Cleveland to museums as a whole.",
  `Treat accession decade as a proxy and disclose ${audit.mismatchRows.toLocaleString()} accession-year mismatches.`,
  "Caption charts as sample charts, not complete collection charts.",
  `Include audit caveats: ${audit.flaggedRows.toLocaleString()} flagged rows, ${audit.noImageRows.toLocaleString()} no-image rows, and ${audit.flagCounts["no-provenance-entries"].toLocaleString()} rows with no provenance entries.`,
];

const handoff = {
  generatedAt: new Date().toISOString(),
  title: "What A Museum Collection Looks Like When It Becomes Data",
  publishState: "ready-for-copyedit",
  readinessStatus: readiness?.status ?? "pending-readiness-check",
  source: result.source,
  corpus: {
    sampleRecords: result.sampleRecords,
    totalAvailable: result.totalAvailable,
    sampleShare: result.sampleShare,
    departments: result.departments.length,
    creationCenturyRows: result.creationCenturies.length,
    acquisitionDecadeRows: result.acquisitionDecades.length,
  },
  audit: {
    reviewRows: audit.reviewRows,
    flaggedRows: audit.flaggedRows,
    accessionYearProxyMismatches: audit.mismatchRows,
    missingExplicitAccessionYearRows: audit.missingExplicitAccessionYearRows,
    noImageRows: audit.noImageRows,
    noProvenanceEntryRows: audit.flagCounts["no-provenance-entries"],
  },
  paths,
  charts: chartCaptions,
  claimChecklist,
  finalCopyNotes: [
    "Lead with the methodological observation: an open API changes the unit of attention from object to collection table.",
    "Use the Cleveland sample as a first essay, not as a proxy for museum collections generally.",
    "Keep acquisition-decade language tentative unless the audit rows are manually reviewed.",
    "Use one to three charts in the post; the chart set is deliberately larger than the likely published figure set.",
  ],
};

await writeJson(path.join(reportsDir, "publication-handoff.json"), handoff);
await writeText(path.join(reportsDir, "publication-handoff.md"), buildMarkdown(handoff));

console.log("Built Cleveland publication handoff");

function buildMarkdown(handoff) {
  return [
    "# Cleveland Collection Publication Handoff",
    "",
    `Generated at: ${handoff.generatedAt}`,
    `Publish state: ${handoff.publishState}`,
    `Readiness status: ${handoff.readinessStatus}`,
    "",
    "## Final Draft",
    "",
    `- Draft: \`${handoff.paths.draft}\``,
    `- Structured findings: \`${handoff.paths.result}\``,
    `- Readiness: \`${handoff.paths.readiness}\``,
    `- Audit packet: \`${handoff.paths.auditPacket}\``,
    `- Processed records: \`${handoff.paths.processedRecords}\``,
    "",
    "## Corpus Note",
    "",
    `The current essay uses ${handoff.corpus.sampleRecords.toLocaleString()} sampled Cleveland Museum of Art API records from ${handoff.corpus.totalAvailable.toLocaleString()} total available records (${(handoff.corpus.sampleShare * 100).toFixed(1)}%). It covers ${handoff.corpus.departments} departments, ${handoff.corpus.creationCenturyRows} creation-century rows, and ${handoff.corpus.acquisitionDecadeRows} acquisition-decade rows.`,
    "",
    "## Chart Captions",
    "",
    ...handoff.charts.flatMap((chart) => [
      `### ${titleize(chart.id)}`,
      "",
      `- Path: \`${chart.path}\``,
      `- Caption: ${chart.caption}`,
      "",
    ]),
    "## Audit Notes",
    "",
    `- Review rows: ${handoff.audit.reviewRows.toLocaleString()}`,
    `- Flagged rows: ${handoff.audit.flaggedRows.toLocaleString()}`,
    `- Accession-year proxy mismatches: ${handoff.audit.accessionYearProxyMismatches.toLocaleString()}`,
    `- Missing explicit accession-year rows: ${handoff.audit.missingExplicitAccessionYearRows.toLocaleString()}`,
    `- No-image rows: ${handoff.audit.noImageRows.toLocaleString()}`,
    `- No-provenance-entry rows: ${handoff.audit.noProvenanceEntryRows.toLocaleString()}`,
    "",
    "## Public Claim Checklist",
    "",
    ...handoff.claimChecklist.map((item) => `- [ ] ${item}`),
    "",
    "## Copyedit Notes",
    "",
    ...handoff.finalCopyNotes.map((note) => `- ${note}`),
    "",
  ].join("\n");
}

function titleize(id) {
  return id
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}
