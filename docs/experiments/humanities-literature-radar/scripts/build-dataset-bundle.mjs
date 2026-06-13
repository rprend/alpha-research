import fs from "node:fs/promises";
import path from "node:path";
import {
  experimentDir,
  readJson,
  stableWorkId,
  writeJson,
  writeText,
} from "./lib.mjs";

const datasetId = "humanities-literature-radar";
const bundleDir = path.join(experimentDir, "dataset-bundle");
const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const runsDir = path.join(experimentDir, "runs");

const works = await readJson(path.join(processedDir, "works.json"));
const topics = await readJson(path.join(processedDir, "topics.json"));
const result = await readJson(path.join(reportsDir, "result.json"));
const readiness = await readJson(path.join(reportsDir, "readiness.json"));
const monitorManifest = await readOptionalJson(path.join(runsDir, "2026-06-12", "manifest.json"));

const bySource = countBy(works, (work) => work.source_name || "unknown");
const byYear = countBy(works, (work) => work.year || "unknown");
const quantitativeCandidates = works.filter((work) => work.is_quantitative_humanities_candidate);
const sampleRows = works.slice(0, 10).map((work) => ({
  stable_id: stableWorkId(work),
  title: work.title,
  year: work.year,
  source_name: work.source_name,
  venue_name: work.venue_name,
  doi: work.doi,
  url: work.url,
  methods: work.methods ?? [],
  quantitative_signals: work.quantitative_signals ?? [],
  is_quantitative_humanities_candidate: Boolean(work.is_quantitative_humanities_candidate),
}));

const schema = buildSchema(works);
const profile = {
  datasetId,
  name: "Humanities Literature Radar",
  status: "ready-for-research",
  sourceType: "public_metadata",
  mode: "public_research_dataset",
  mountPath: `/data/datasets/${datasetId}`,
  manifestPath: `/data/datasets/${datasetId}/manifest.json`,
  generatedAt: new Date().toISOString(),
  corpus: {
    works: works.length,
    recentWorks2024Present: works.filter((work) => Number(work.year) >= 2024).length,
    quantitativeHumanitiesCandidates: quantitativeCandidates.length,
    sources: bySource,
    years: byYear,
  },
  monitor: monitorManifest ? {
    runDate: monitorManifest.runDate,
    counts: monitorManifest.counts,
    resultPath: `runs/${monitorManifest.runDate}/result.json`,
  } : null,
  readiness: readiness.status,
  files: {
    briefing: "dataset_briefing.md",
    processedWorks: "processed/works.json",
    topics: "processed/topics.json",
    result: "reports/result.json",
    sourceInventory: "reports/source-inventory.md",
    monitorRun: monitorManifest ? `runs/${monitorManifest.runDate}/` : null,
  },
  suggestedStarterQuestions: [
    "What are the main topic clusters in AI-and-humanities publishing since 2020?",
    "Which venues and sources publish computational or quantitative humanities work?",
    "Which methods are most visible across the corpus?",
    "Which representative works should be manually reviewed before publishing the first field-map essay?",
    "What source gaps would change the interpretation most?",
  ],
  limitations: result.caveats,
};

const briefing = buildBriefing(profile, result, topics);
const manifest = {
  datasetId,
  name: profile.name,
  generatedAt: profile.generatedAt,
  mountPath: profile.mountPath,
  sourceExperiment: "docs/experiments/humanities-literature-radar",
  recordCounts: profile.corpus,
  files: [
    "manifest.json",
    "dataset_briefing.md",
    "dataset_profile.json",
    "schema.json",
    "sample_rows.json",
    "processed/works.json",
    "processed/works.csv",
    "processed/topics.json",
    "processed/topics.csv",
    "processed/representative-works.csv",
    "processed/quantitative-humanities-opportunities.csv",
    "reports/result.json",
    "reports/source-inventory.md",
    "reports/work.md",
    "runs/2026-06-12/manifest.json",
    "runs/2026-06-12/result.json",
    "runs/2026-06-12/new-works.csv",
    "runs/2026-06-12/changed-sources.csv",
  ],
};

await fs.rm(bundleDir, { recursive: true, force: true });
await fs.mkdir(bundleDir, { recursive: true });
await fs.mkdir(path.join(bundleDir, "processed"), { recursive: true });
await fs.mkdir(path.join(bundleDir, "reports"), { recursive: true });
await fs.mkdir(path.join(bundleDir, "runs", "2026-06-12"), { recursive: true });

await writeJson(path.join(bundleDir, "manifest.json"), manifest);
await writeText(path.join(bundleDir, "dataset_briefing.md"), briefing);
await writeJson(path.join(bundleDir, "dataset_profile.json"), profile);
await writeJson(path.join(bundleDir, "schema.json"), schema);
await writeJson(path.join(bundleDir, "sample_rows.json"), sampleRows);
await copyFiles(processedDir, path.join(bundleDir, "processed"), [
  "works.json",
  "works.csv",
  "topics.json",
  "topics.csv",
  "representative-works.csv",
  "quantitative-humanities-opportunities.csv",
]);
await copyFiles(reportsDir, path.join(bundleDir, "reports"), [
  "result.json",
  "source-inventory.md",
  "source-inventory.csv",
  "work.md",
  "readiness.json",
  "publication-handoff.json",
]);
await copyFiles(path.join(runsDir, "2026-06-12"), path.join(bundleDir, "runs", "2026-06-12"), [
  "manifest.json",
  "result.json",
  "new-works.csv",
  "changed-sources.csv",
  "work.md",
]);

const registration = {
  dataset: {
    datasetId,
    name: profile.name,
    ownerEmail: "platform@alpha-research.local",
    sourceType: "public_metadata",
    sourceFilename: "dataset-bundle",
    mode: "public_research_dataset",
    description: "Public metadata corpus for Archive Signals / The Cultural Observatory field maps of AI, computation, and quantitative humanities.",
    manifestPath: profile.manifestPath,
    ingestConfig: {
      sourceExperiment: "docs/experiments/humanities-literature-radar",
      bundlePath: "docs/experiments/humanities-literature-radar/dataset-bundle",
      modalSyncCommand: `python scripts/sync_modal_dataset.py --dataset-id ${datasetId} --source docs/experiments/humanities-literature-radar/dataset-bundle --contents --force`,
    },
  },
  profile: {
    schema,
    sampleRows,
    notes: "Generated from the current literature-radar processed corpus. Source coverage caveats are in dataset_briefing.md and reports/result.json.",
    briefingMarkdown: briefing,
    profile,
    describedAt: profile.generatedAt,
  },
};

await writeJson(path.join(experimentDir, "registration", "control-plane-registration.json"), registration);
await writeText(path.join(experimentDir, "registration", "README.md"), buildRegistrationReadme(registration));
await writeText(path.join(experimentDir, "dataset_briefing.md"), briefing);

console.log(`Built dataset bundle for ${datasetId} with ${works.length} works at ${path.relative(process.cwd(), bundleDir)}`);

function buildSchema(rows) {
  const fields = new Map();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!fields.has(key)) fields.set(key, { name: key, types: new Set(), example: null });
      const field = fields.get(key);
      field.types.add(Array.isArray(value) ? "array" : value === null ? "null" : typeof value);
      if (field.example === null && value != null && value !== "") field.example = value;
    }
  }
  return {
    primaryKey: "stableWorkId(work)",
    rowCount: rows.length,
    fields: [...fields.values()].map((field) => ({
      name: field.name,
      types: [...field.types].sort(),
      example: field.example,
    })),
  };
}

function buildBriefing(datasetProfile, reportResult, topicRows) {
  const topTopics = topicRows.slice(0, 10).map((topic) => `${topic.label} (${topic.count})`).join(", ");
  return [
    "# Humanities Literature Radar Dataset Briefing",
    "",
    "## What This Dataset Contains",
    "",
    "This dataset is the source-backed literature-radar corpus for the Cultural Observatory / Archive Signals research program. It collects public metadata about recent humanities and humanities-adjacent scholarship from OpenAlex, Crossref, DOAJ, OSF Preprints / SocArXiv, Knowledge Commons Works / Humanities Commons, arXiv, NBER search pages, and selected public department pages.",
    "",
    "The current committed run includes a broad DOAJ OAI backfill plus bounded companion sources. It is ready for field-map research and publication drafting with source-coverage caveats, but broad trend claims still need manual audit of representative records and further expansion of non-DOAJ source families.",
    "",
    "## Current Corpus",
    "",
    `- ${datasetProfile.corpus.works} deduped works`,
    `- ${datasetProfile.corpus.recentWorks2024Present} works dated 2024-present`,
    `- ${datasetProfile.corpus.quantitativeHumanitiesCandidates} quantitative/computational humanities candidates`,
    `- processed sources: ${Object.keys(datasetProfile.corpus.sources).join(", ")}`,
    `- readiness: ${datasetProfile.readiness}`,
    datasetProfile.monitor ? `- monitor: ${datasetProfile.monitor.counts.genuinelyNewPublications} genuinely new publications and ${datasetProfile.monitor.counts.newlyDiscoveredOldRecords} newly discovered old records versus the configured baseline` : null,
    "",
    "## Current Files",
    "",
    "- `manifest.json`: dataset bundle manifest",
    "- `dataset_profile.json`: machine-readable dataset profile",
    "- `schema.json`: inferred processed-work schema",
    "- `sample_rows.json`: bounded sample rows for prompt/dashboard context",
    "- `processed/works.json`: deduped work records",
    "- `processed/works.csv`: tabular work inventory",
    "- `processed/topics.json`: heuristic topic/method/signal counts",
    "- `processed/representative-works.csv`: high-signal works for review",
    "- `processed/quantitative-humanities-opportunities.csv`: candidate essay/study opportunities",
    "- `reports/source-inventory.md`: source run summary",
    "- `reports/result.json`: structured field-map result payload",
    "- `reports/work.md`: work log and caveats",
    "- `runs/2026-06-12/`: bootstrap recurring monitor run",
    "",
    "## Fields",
    "",
    "Primary work fields include `work_id`, `source_name`, `source_record_id`, `title`, `abstract`, `publication_date`, `year`, `doi`, `url`, `open_access_url`, `venue_name`, `publisher`, `work_type`, `authors`, `institutions`, `concepts`, `references`, `cited_by_count`, `license`, `raw_path`, `disciplines`, `methods`, `quantitative_signals`, and `is_quantitative_humanities_candidate`.",
    "",
    "## Current Topic Signals",
    "",
    topTopics || "No topic rows available.",
    "",
    "## Known Limitations",
    "",
    ...reportResult.caveats.map((caveat) => `- ${caveat}`),
    "- Public metadata underrepresents books, book chapters, non-English scholarship, and paywalled humanities journals.",
    "- Department-page records are coverage/enrichment evidence and should not be used to rank departments.",
    "- Classification is heuristic and needs manual audit before public claims.",
    "",
    "## Starter Questions",
    "",
    ...datasetProfile.suggestedStarterQuestions.map((question) => `- ${question}`),
    "",
  ].filter((line) => line !== null).join("\n");
}

function buildRegistrationReadme(registration) {
  return [
    "# Humanities Literature Radar Registration",
    "",
    "This folder contains the control-plane registration payload for the `humanities-literature-radar` dataset.",
    "",
    "## Dataset Bundle",
    "",
    "Build the local bundle:",
    "",
    "```bash",
    "node docs/experiments/humanities-literature-radar/scripts/build-dataset-bundle.mjs",
    "```",
    "",
    "Upload the bundle to the shared dataset volume:",
    "",
    "```bash",
    registration.dataset.ingestConfig.modalSyncCommand,
    "```",
    "",
    "The intended remote mount is `/data/datasets/humanities-literature-radar/`.",
    "",
    "## Control Plane Payload",
    "",
    "- Create/update dataset with `dataset` from `control-plane-registration.json`.",
    "- Attach profile with `profile` from `control-plane-registration.json` at `/datasets/humanities-literature-radar/profile`.",
    "- Verify dashboard dataset detail renders `briefingMarkdown` and the profile endpoint returns schema and sample rows.",
    "",
  ].join("\n");
}

async function copyFiles(fromDir, toDir, names) {
  await fs.mkdir(toDir, { recursive: true });
  for (const name of names) {
    await fs.copyFile(path.join(fromDir, name), path.join(toDir, name));
  }
}

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}

function countBy(items, fn) {
  return items.reduce((acc, item) => {
    const key = String(fn(item));
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}
