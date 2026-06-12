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

const historicalRows = (result.institutions ?? [])
  .filter((row) => row.source_layer === "wayback")
  .sort((a, b) => Number(a.year) - Number(b.year) || a.institution.localeCompare(b.institution));
const currentRows = (result.institutions ?? []).filter((row) => row.source_layer === "current");
const yearsWithMultipleInstitutions = yearsWithAtLeastTwoInstitutions(historicalRows);
const flaggedRows = (audit.rows ?? []).filter((row) => row.flags);

const handoff = {
  generatedAt: new Date().toISOString(),
  title: "What Universities Say They Are For",
  publishState: "ready-for-copyedit",
  readinessStatus: readiness?.status ?? "pending-readiness-check",
  format: "what-changed",
  thesis: "University self-description can be studied as a historical language layer, but current about pages and archived pages must be treated as source evidence rather than a clean census of institutional purpose.",
  corpus: {
    currentPages: result.currentPages,
    historicalPages: result.historicalPages,
    yearRange: result.yearRange,
    historicalInstitutions: [...new Set(historicalRows.map((row) => row.institution))].length,
    historicalYears: [...new Set(historicalRows.map((row) => row.year))].sort(),
    yearsWithMultipleInstitutions,
    auditFlaggedRows: flaggedRows.length,
  },
  paths: {
    draft: "docs/experiments/university-mission-statement-drift/reports/public-draft.md",
    result: "docs/experiments/university-mission-statement-drift/reports/result.json",
    readiness: "docs/experiments/university-mission-statement-drift/reports/readiness.json",
    auditPacket: "docs/experiments/university-mission-statement-drift/reports/audit-packet.md",
    processedPages: "docs/experiments/university-mission-statement-drift/data/processed/pages.json",
    termFamilyByYear: "docs/experiments/university-mission-statement-drift/data/processed/term-family-by-year.csv",
  },
  evidenceSummary: [
    `${result.currentPages} current public university pages.`,
    `${result.historicalPages} archived Wayback snapshots from ${result.yearRange.earliest} through ${result.yearRange.latest}.`,
    `${yearsWithMultipleInstitutions.length} historical years with at least two institutions: ${yearsWithMultipleInstitutions.join(", ")}.`,
    `${flaggedRows.length} automatic audit flags after replacing the short Harvard 2010 snapshot.`,
  ],
  historicalSnapshotTable: historicalRows.map((row) => ({
    institution: row.institution,
    year: row.year,
    words: row.words,
    archiveUrl: row.archive_url,
  })),
  publicClaimChecklist: [
    `Say this is a ${result.currentPages}-current-page and ${result.historicalPages}-historical-snapshot corpus, not a census of universities.`,
    "Separate current-page claims from historical Wayback claims.",
    "Use only years with multiple institutions for year-level trend language.",
    "Describe term counts as directional evidence, not proof of institutional motive.",
    "Mention archived HTML and page-type instability as limitations.",
    "Do not quote snippets unless they have been checked against the audit packet.",
  ],
  copyeditNotes: [
    "Lead with the tension between university purpose as rhetoric and university purpose as measurable web text.",
    "Keep the headline framed as a question or source map, not a settled trend claim.",
    "Use the historical snapshot table to show source depth before interpreting term-family movement.",
    "End with a stronger next-study plan: catalogs, strategic plans, speeches, and genre-separated institutional layers.",
  ],
};

await writeJson(path.join(reportsDir, "publication-handoff.json"), handoff);
await writeText(path.join(reportsDir, "publication-handoff.md"), buildMarkdown(handoff));

console.log("Built mission drift publication handoff");

function buildMarkdown(handoff) {
  return [
    "# Mission Drift Publication Handoff",
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
    `- Processed pages: \`${handoff.paths.processedPages}\``,
    `- Term family by year: \`${handoff.paths.termFamilyByYear}\``,
    "",
    "## Thesis",
    "",
    handoff.thesis,
    "",
    "## Corpus Note",
    "",
    `The artifact contains ${handoff.corpus.currentPages} current pages and ${handoff.corpus.historicalPages} historical snapshots covering ${handoff.corpus.yearRange.earliest}-${handoff.corpus.yearRange.latest}. Historical evidence covers ${handoff.corpus.historicalInstitutions} institutions and ${handoff.corpus.historicalYears.length} years.`,
    "",
    "## Evidence Summary",
    "",
    ...handoff.evidenceSummary.map((item) => `- ${item}`),
    "",
    "## Historical Snapshot Table",
    "",
    "| Institution | Year | Words | Archive |",
    "| --- | ---: | ---: | --- |",
    ...handoff.historicalSnapshotTable.map((row) => `| ${row.institution} | ${row.year} | ${row.words} | ${row.archiveUrl} |`),
    "",
    "## Public Claim Checklist",
    "",
    ...handoff.publicClaimChecklist.map((item) => `- [ ] ${item}`),
    "",
    "## Copyedit Notes",
    "",
    ...handoff.copyeditNotes.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

function yearsWithAtLeastTwoInstitutions(rows) {
  const byYear = new Map();
  for (const row of rows) {
    const institutions = byYear.get(row.year) ?? new Set();
    institutions.add(row.institution);
    byYear.set(row.year, institutions);
  }
  return [...byYear.entries()]
    .filter(([, institutions]) => institutions.size >= 2)
    .map(([year]) => year)
    .sort((a, b) => Number(a) - Number(b));
}

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}
