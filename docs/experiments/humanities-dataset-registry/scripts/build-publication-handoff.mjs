import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const result = await readJson(path.join(reportsDir, "result.json"));
const studySpecs = await readJson(path.join(experimentDir, "data", "processed", "study-specs.json"));
const readiness = await readOptionalJson(path.join(reportsDir, "readiness.json"));
const topReady = (result.topCandidates ?? []).filter((row) => row.readiness_bucket === "ready-now").slice(0, 6);

const handoff = {
  generatedAt: new Date().toISOString(),
  title: "What Counts As A Humanities Dataset?",
  publishState: "ready-for-copyedit",
  readinessStatus: readiness?.status ?? "pending-readiness-check",
  format: "research-agenda",
  thesis: "A humanities dataset becomes analytically useful when access, rights, metadata structure, time depth, and coverage bias are legible together.",
  corpus: {
    candidates: result.candidates,
    accessibleCandidates: result.accessibleCandidates,
    readyCandidates: result.readyCandidates,
    needsWorkCandidates: result.needsWorkCandidates,
    blockedCandidates: result.blockedCandidates,
    domains: result.domains,
    accessModes: result.accessModes,
    studySpecs: studySpecs.count,
  },
  paths: {
    draft: "docs/experiments/humanities-dataset-registry/reports/public-draft.md",
    result: "docs/experiments/humanities-dataset-registry/reports/result.json",
    readiness: "docs/experiments/humanities-dataset-registry/reports/readiness.json",
    sourceInventory: "docs/experiments/humanities-dataset-registry/reports/source-inventory.md",
    rankings: "docs/experiments/humanities-dataset-registry/data/processed/dataset-rankings.csv",
    studySpecs: "docs/experiments/humanities-dataset-registry/reports/study-specs.md",
  },
  readyNowCandidates: topReady.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    accessMode: row.access_mode,
    readinessScore: row.readiness_score,
    starterQuestion: row.starter_question,
    qualityRisk: row.quality_risk,
  })),
  editorialFrame: [
    "Use the registry as a research-agenda essay, not as a definitive list of all humanities datasets.",
    "Show that dataset readiness is multidimensional: access, rights, structure, time depth, entity richness, and normalization burden.",
    "Treat ready-now as ready for source-probed experimentation, not as representative of culture.",
    "Point directly to the Cleveland study as the first launched example from the registry.",
  ],
  publicClaimChecklist: [
    `Say the registry probes ${result.candidates} candidate corpora, not the whole humanities data universe.`,
    `Mention ${result.accessibleCandidates} accessible candidates and ${result.readyCandidates} ready-now candidates.`,
    "Separate public availability from cultural representativeness.",
    "Do not imply API richness means interpretive neutrality.",
    "Include licensing and redistribution caveats before recommending derivative datasets.",
    `Point readers to ${studySpecs.count} generated study specs as next experiments, not final results.`,
  ],
  copyeditNotes: [
    "Lead with the question: what makes a pile of cultural material become a usable humanities dataset?",
    "Use the ranked candidates to make the method concrete.",
    "Keep examples diverse across museums, linked data, libraries, teaching, and books.",
    "End with a short publication roadmap from registry to study spec to essay.",
  ],
};

await writeJson(path.join(reportsDir, "publication-handoff.json"), handoff);
await writeText(path.join(reportsDir, "publication-handoff.md"), buildMarkdown(handoff));

console.log("Built humanities dataset registry publication handoff");

function buildMarkdown(handoff) {
  return [
    "# Humanities Dataset Registry Publication Handoff",
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
    `- Dataset rankings: \`${handoff.paths.rankings}\``,
    `- Study specs: \`${handoff.paths.studySpecs}\``,
    "",
    "## Thesis",
    "",
    handoff.thesis,
    "",
    "## Corpus Note",
    "",
    `The registry probes ${handoff.corpus.candidates} candidate corpora. ${handoff.corpus.accessibleCandidates} were accessible, ${handoff.corpus.readyCandidates} were ready-now, ${handoff.corpus.needsWorkCandidates} needed work, and ${handoff.corpus.blockedCandidates} were blocked or constrained in the latest run. It generated ${handoff.corpus.studySpecs} study specs.`,
    "",
    "## Ready-Now Examples",
    "",
    ...handoff.readyNowCandidates.map((row) => `- ${row.name} (${row.domain}, score ${row.readinessScore}): ${row.starterQuestion} Risk: ${row.qualityRisk}`),
    "",
    "## Editorial Frame",
    "",
    ...handoff.editorialFrame.map((item) => `- ${item}`),
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

async function readOptionalJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}
