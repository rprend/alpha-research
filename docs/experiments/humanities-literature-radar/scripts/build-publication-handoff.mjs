import path from "node:path";
import fs from "node:fs/promises";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const processedDir = path.join(experimentDir, "data", "processed");
const result = await readJson(path.join(reportsDir, "result.json"));
const readiness = await readOptionalJson(path.join(reportsDir, "readiness.json"));
const representativeRows = await readCsvRows(path.join(processedDir, "representative-works.csv"));
const opportunityRows = await readCsvRows(path.join(processedDir, "quantitative-humanities-opportunities.csv"));

const sources = Object.entries(result.corpus.sources ?? {})
  .sort((a, b) => b[1] - a[1])
  .map(([source, count]) => ({ source, count }));
const years = Object.entries(result.corpus.years ?? {})
  .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  .map(([year, count]) => ({ year, count }));

const handoff = {
  generatedAt: new Date().toISOString(),
  title: "The Rise Of AI And The Humanities",
  publishState: "ready-for-copyedit",
  readinessStatus: readiness?.status ?? "pending-readiness-check",
  format: "field-map",
  thesis: "The first literature-radar corpus is large enough to support a field-map essay about AI, computational methods, and quantitative humanities signals, while still requiring source-coverage caveats.",
  corpus: {
    works: result.corpus.works,
    recentWorks2024Present: result.corpus.recentWorks2024Present,
    quantitativeHumanitiesCandidates: result.corpus.quantitativeHumanitiesCandidates,
    sourceCount: sources.length,
    sources,
    yearRange: {
      earliest: years.find((row) => row.year !== "unknown")?.year ?? "unknown",
      latest: [...years].reverse().find((row) => row.year !== "unknown")?.year ?? "unknown",
    },
    representativeRows: representativeRows.length,
    opportunityRows: opportunityRows.length,
  },
  paths: {
    draft: "docs/experiments/humanities-literature-radar/reports/public-draft.md",
    result: "docs/experiments/humanities-literature-radar/reports/result.json",
    readiness: "docs/experiments/humanities-literature-radar/reports/readiness.json",
    sourceInventory: "docs/experiments/humanities-literature-radar/reports/source-inventory.md",
    works: "docs/experiments/humanities-literature-radar/data/processed/works.csv",
    representativeWorks: "docs/experiments/humanities-literature-radar/data/processed/representative-works.csv",
    opportunities: "docs/experiments/humanities-literature-radar/data/processed/quantitative-humanities-opportunities.csv",
  },
  evidenceSummary: [
    `${result.corpus.works.toLocaleString()} deduped works across ${sources.length} source families.`,
    `${result.corpus.recentWorks2024Present.toLocaleString()} works dated 2024-present.`,
    `${result.corpus.quantitativeHumanitiesCandidates.toLocaleString()} quantitative/computational humanities candidates.`,
    `${representativeRows.length} representative rows available for manual review.`,
    `${opportunityRows.length} opportunity rows available for next-study selection.`,
  ],
  publicClaimChecklist: [
    `Say this is a metadata corpus of ${result.corpus.works.toLocaleString()} deduped records, not full-text scholarship.`,
    "Name source families and their uneven coverage before making field-level claims.",
    "Use 2024-present counts for current-field language, not older backfill counts.",
    "Frame topic and method labels as heuristic classifications until manually audited.",
    "Do not treat OpenAlex/Crossref/DOAJ/HCommons coverage as representative of all humanities publishing.",
    "Point readers to representative works and opportunity tables for inspection.",
  ],
  copyeditNotes: [
    "Lead with the practical point: the field is now large enough to map, but not clean enough to rank without caveats.",
    "Use the source inventory early so readers can see where the corpus came from.",
    "Turn the opportunity table into a list of possible future posts, not a claim that all opportunities are equally strong.",
    "End with the next data expansion: DOAJ/OAI-PMH, broader preprint harvesting, and manual review of representative rows.",
  ],
};

await writeJson(path.join(reportsDir, "publication-handoff.json"), handoff);
await writeText(path.join(reportsDir, "publication-handoff.md"), buildMarkdown(handoff));

console.log("Built literature radar publication handoff");

function buildMarkdown(handoff) {
  return [
    "# Literature Radar Publication Handoff",
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
    `- Source inventory: \`${handoff.paths.sourceInventory}\``,
    `- Works: \`${handoff.paths.works}\``,
    `- Representative works: \`${handoff.paths.representativeWorks}\``,
    `- Opportunities: \`${handoff.paths.opportunities}\``,
    "",
    "## Thesis",
    "",
    handoff.thesis,
    "",
    "## Corpus Note",
    "",
    `The corpus contains ${handoff.corpus.works.toLocaleString()} deduped works, including ${handoff.corpus.recentWorks2024Present.toLocaleString()} works from 2024-present and ${handoff.corpus.quantitativeHumanitiesCandidates.toLocaleString()} quantitative/computational humanities candidates. It spans ${handoff.corpus.sourceCount} source families and years ${handoff.corpus.yearRange.earliest}-${handoff.corpus.yearRange.latest}.`,
    "",
    "## Source Counts",
    "",
    "| Source | Works |",
    "| --- | ---: |",
    ...handoff.corpus.sources.map((row) => `| ${row.source} | ${row.count.toLocaleString()} |`),
    "",
    "## Evidence Summary",
    "",
    ...handoff.evidenceSummary.map((item) => `- ${item}`),
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

async function readCsvRows(file) {
  const text = await fs.readFile(file, "utf8");
  return text.trim().split(/\n/).slice(1).filter(Boolean);
}

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}
