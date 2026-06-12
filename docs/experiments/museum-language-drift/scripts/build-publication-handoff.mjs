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

const historicalRows = (result.pagesDetail ?? [])
  .filter((row) => row.source_layer === "wayback")
  .sort((a, b) => Number(a.year) - Number(b.year) || a.museum.localeCompare(b.museum));
const currentRows = (result.pagesDetail ?? []).filter((row) => row.source_layer === "current");
const yearsWithMultipleMuseums = yearsWithAtLeastTwoMuseums(historicalRows);
const flaggedRows = (audit.rows ?? []).filter((row) => row.flags);

const handoff = {
  generatedAt: new Date().toISOString(),
  title: "The Language Of Museums After Decolonization",
  publishState: "ready-for-copyedit",
  readinessStatus: readiness?.status ?? "pending-readiness-check",
  format: "what-changed",
  thesis: "Museum language can be studied as a changing public record, but about pages, collection pages, exhibition pages, and research pages must remain separate source genres.",
  corpus: {
    currentPages: result.currentPages,
    historicalPages: result.historicalPages,
    museums: result.museums,
    pageTypes: result.pageTypes,
    yearRange: result.yearRange,
    currentMuseums: [...new Set(currentRows.map((row) => row.museum))].length,
    historicalMuseums: [...new Set(historicalRows.map((row) => row.museum))].length,
    historicalYears: [...new Set(historicalRows.map((row) => row.year))].sort(),
    yearsWithMultipleMuseums,
    auditFlaggedRows: flaggedRows.length,
  },
  paths: {
    draft: "docs/experiments/museum-language-drift/reports/public-draft.md",
    result: "docs/experiments/museum-language-drift/reports/result.json",
    readiness: "docs/experiments/museum-language-drift/reports/readiness.json",
    auditPacket: "docs/experiments/museum-language-drift/reports/audit-packet.md",
    sourceInventory: "docs/experiments/museum-language-drift/reports/source-inventory.md",
    processedPages: "docs/experiments/museum-language-drift/data/processed/pages.json",
    termFamilyByYear: "docs/experiments/museum-language-drift/data/processed/term-family-by-year.csv",
  },
  evidenceSummary: [
    `${result.currentPages} current public museum pages across ${result.museums} museums.`,
    `${result.historicalPages} archived Wayback snapshots from ${result.yearRange.earliest} through ${result.yearRange.latest}.`,
    `${result.pageTypes.length} page genres represented: ${result.pageTypes.join(", ")}.`,
    `${yearsWithMultipleMuseums.length} historical years with at least two museums: ${yearsWithMultipleMuseums.join(", ") || "none"}.`,
    `${flaggedRows.length} automatic audit flags after excluding weak extracted pages from the processed corpus.`,
  ],
  historicalSnapshotTable: historicalRows.map((row) => ({
    museum: row.museum,
    pageType: row.page_type,
    year: row.year,
    words: row.words,
    archiveUrl: row.archive_url,
  })),
  publicClaimChecklist: [
    `Say this is a ${result.currentPages}-current-page and ${result.historicalPages}-historical-snapshot corpus, not a census of museum practice.`,
    "Separate source genres before interpreting language differences.",
    "Use about-page historical snapshots for longitudinal language, not collection/exhibition pages.",
    "Describe term counts as audit leads, not as final interpretation.",
    "Mention that weak extracted pages were excluded from the processed publication corpus.",
    "Do not quote snippets unless they have been checked against the audit packet.",
  ],
  copyeditNotes: [
    "Lead with public museum language as a source layer, not a direct measure of institutional practice.",
    "Use the historical snapshot table to establish source depth before discussing change over time.",
    "Keep decolonization/restitution/provenance language separate from access/community/research language.",
    "End with the next stronger study: annual reports, provenance pages, exhibition texts, and source-genre-specific trend lines.",
  ],
};

await writeJson(path.join(reportsDir, "publication-handoff.json"), handoff);
await writeText(path.join(reportsDir, "publication-handoff.md"), buildMarkdown(handoff));

console.log("Built museum language publication handoff");

function buildMarkdown(handoff) {
  return [
    "# Museum Language Publication Handoff",
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
    `- Source inventory: \`${handoff.paths.sourceInventory}\``,
    `- Processed pages: \`${handoff.paths.processedPages}\``,
    `- Term family by year: \`${handoff.paths.termFamilyByYear}\``,
    "",
    "## Thesis",
    "",
    handoff.thesis,
    "",
    "## Corpus Note",
    "",
    `The artifact contains ${handoff.corpus.currentPages} current pages and ${handoff.corpus.historicalPages} historical snapshots covering ${handoff.corpus.yearRange.earliest}-${handoff.corpus.yearRange.latest}. It includes ${handoff.corpus.museums} museums and page genres: ${handoff.corpus.pageTypes.join(", ")}.`,
    "",
    "## Evidence Summary",
    "",
    ...handoff.evidenceSummary.map((item) => `- ${item}`),
    "",
    "## Historical Snapshot Table",
    "",
    "| Museum | Page Type | Year | Words | Archive |",
    "| --- | --- | ---: | ---: | --- |",
    ...handoff.historicalSnapshotTable.map((row) => `| ${row.museum} | ${row.pageType} | ${row.year} | ${row.words} | ${row.archiveUrl} |`),
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

function yearsWithAtLeastTwoMuseums(rows) {
  const byYear = new Map();
  for (const row of rows) {
    const museums = byYear.get(row.year) ?? new Set();
    museums.add(row.museum);
    byYear.set(row.year, museums);
  }
  return [...byYear.entries()]
    .filter(([, museums]) => museums.size >= 2)
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
