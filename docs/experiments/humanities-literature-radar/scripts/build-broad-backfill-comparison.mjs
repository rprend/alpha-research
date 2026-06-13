import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const runsDir = path.join(experimentDir, "runs");
const route = await readJson(path.join(reportsDir, "doaj-oai-backfill-route.json"));
const result = await readJson(path.join(reportsDir, "result.json"));
const monitor = await readOptionalJson(path.join(runsDir, route.runDate, "result.json"));
const monitorManifest = await readOptionalJson(path.join(runsDir, route.runDate, "manifest.json"));
const doajOaiProcessed = result.corpus.sources["doaj-oai"] ?? 0;
const status = route.corpusTier === "broad-backfill-corpus" ? "broad-backfill-built" : "broad-backfill-pilot-built";

const comparison = {
  generatedAt: new Date().toISOString(),
  status,
  corpusTier: route.corpusTier,
  source: route.source,
  route: route.route,
  sourceDocs: route.sourceDocs,
  rawHarvest: {
    runDate: route.runDate,
    from: route.from,
    until: route.until,
    maxPages: route.maxPages,
    pagesFetched: route.pagesFetched,
    rawRecords: route.recordCount,
    manifestPath: route.manifestPath,
    checkpointPath: route.checkpointPath,
    resume: route.resume,
    resumedFromCheckpoint: route.resumedFromCheckpoint,
  },
  processedCorpus: {
    works: result.corpus.works,
    recentWorks2024Present: result.corpus.recentWorks2024Present,
    quantitativeHumanitiesCandidates: result.corpus.quantitativeHumanitiesCandidates,
    doajOaiProcessedRecords: doajOaiProcessed,
    sources: result.corpus.sources,
    years: result.corpus.years,
  },
  baselineComparison: monitor ? {
    baseline: monitorManifest?.baseline?.source ?? "unknown",
    currentWorks: monitor.counts.currentWorks,
    newWorks: monitor.counts.newWorks,
    genuinelyNewPublications: monitor.counts.genuinelyNewPublications,
    newlyDiscoveredOldRecords: monitor.counts.newlyDiscoveredOldRecords,
    monitorRun: `runs/${route.runDate}/result.json`,
  } : null,
  qualityGate: [
    "DOAJ OAI records require relevance_score >= 1 before entering processed works.",
    "The OAI route uses source-level pagination rather than keyword search, so public field claims must keep source-coverage and relevance-gate caveats attached.",
    "Representative DOAJ OAI records still need manual audit before stronger field claims.",
  ],
  nextActions: [
    "Continue the DOAJ OAI harvest with --resume=true beyond the current page budget if a fuller source harvest is needed.",
    "Manually audit representative DOAJ OAI records before publishing examples.",
    "Rebuild, sync, and remotely verify the Alpha Research dataset bundle after promotion.",
    "Expand Knowledge Commons Works, OSF/SocArXiv, and NBER routes to reduce source-family imbalance.",
  ],
};

await writeJson(path.join(reportsDir, "broad-backfill-comparison.json"), comparison);
await writeText(path.join(reportsDir, "broad-backfill-comparison.md"), buildMarkdown(comparison));

console.log(`Built broad backfill comparison: ${comparison.status}, ${comparison.rawHarvest.rawRecords} raw records, ${comparison.processedCorpus.works} processed works`);

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}

function buildMarkdown(comparison) {
  return [
    "# Humanities Literature Radar Broad Backfill Comparison",
    "",
    `Generated at: ${comparison.generatedAt}`,
    `Status: ${comparison.status}`,
    `Corpus tier: ${comparison.corpusTier}`,
    "",
    "## DOAJ OAI Route",
    "",
    `- Route: ${comparison.route}`,
    `- Source docs: ${comparison.sourceDocs}`,
    `- Run date: ${comparison.rawHarvest.runDate}`,
    `- Window: ${comparison.rawHarvest.from} through ${comparison.rawHarvest.until}`,
    `- Pages fetched: ${comparison.rawHarvest.pagesFetched}`,
    `- Raw records: ${comparison.rawHarvest.rawRecords}`,
    `- Manifest: \`${comparison.rawHarvest.manifestPath}\``,
    `- Checkpoint: \`${comparison.rawHarvest.checkpointPath}\``,
    `- Resume mode: ${comparison.rawHarvest.resume ? "yes" : "no"}`,
    "",
    "## Processed Corpus After Relevance Gate",
    "",
    `- Deduped works: ${comparison.processedCorpus.works}`,
    `- Works dated 2024-present: ${comparison.processedCorpus.recentWorks2024Present}`,
    `- Quantitative/computational humanities candidates: ${comparison.processedCorpus.quantitativeHumanitiesCandidates}`,
    `- DOAJ OAI processed records: ${comparison.processedCorpus.doajOaiProcessedRecords}`,
    "",
    "## Baseline Comparison",
    "",
    ...(comparison.baselineComparison ? [
      `- Baseline: \`${comparison.baselineComparison.baseline}\``,
      `- Current works: ${comparison.baselineComparison.currentWorks}`,
      `- New works versus baseline: ${comparison.baselineComparison.newWorks}`,
      `- Genuinely new publications: ${comparison.baselineComparison.genuinelyNewPublications}`,
      `- Newly discovered old records: ${comparison.baselineComparison.newlyDiscoveredOldRecords}`,
      `- Monitor run: \`${comparison.baselineComparison.monitorRun}\``,
    ] : ["- No monitor run was found for this route date."]),
    "",
    "## Quality Gate",
    "",
    ...comparison.qualityGate.map((item) => `- ${item}`),
    "",
    "## Next Actions",
    "",
    ...comparison.nextActions.map((item) => `- ${item}`),
    "",
  ].join("\n");
}
