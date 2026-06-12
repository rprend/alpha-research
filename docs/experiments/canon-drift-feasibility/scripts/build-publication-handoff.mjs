import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const result = await readJson(path.join(reportsDir, "result.json"));
const readiness = await readOptionalJson(path.join(reportsDir, "readiness.json"));
const accessibleSignals = Object.entries(result.signals ?? {})
  .filter(([, value]) => value.accessible > 0)
  .map(([signal]) => signal);
const blockedRows = (result.rows ?? []).filter((row) => row.access_status !== "accessible");

const handoff = {
  generatedAt: new Date().toISOString(),
  title: "Canon Drift: A Feasibility Report",
  publishState: "ready-for-copyedit",
  readinessStatus: readiness?.status ?? "pending-readiness-check",
  format: "methods-piece",
  thesis: "Canon drift is not one dataset; teaching, anthologization, citation, and holdings are separate signals that need separate source layers.",
  corpus: {
    probes: result.probes,
    accessibleProbes: result.accessibleProbes,
    blockedProbes: result.blockedProbes,
    accessibleSignals,
    sourceTypes: result.sourceTypes,
  },
  paths: {
    draft: "docs/experiments/canon-drift-feasibility/reports/public-draft.md",
    result: "docs/experiments/canon-drift-feasibility/reports/result.json",
    readiness: "docs/experiments/canon-drift-feasibility/reports/readiness.json",
    sourceInventory: "docs/experiments/canon-drift-feasibility/reports/source-inventory.md",
    feasibilityMatrix: "docs/experiments/canon-drift-feasibility/data/processed/feasibility-matrix.csv",
  },
  evidenceBlocks: [
    {
      label: "Teaching signals",
      evidence: signalEvidence("teaching"),
      allowedClaim: "Public courseware and syllabus-index probes are candidate teaching signals, not representative curriculum evidence.",
    },
    {
      label: "Anthologization signals",
      evidence: signalEvidence("anthologization"),
      allowedClaim: "Anthology pages can support a source-access discussion, but edition-level TOC claims need a separate audit.",
    },
    {
      label: "Holdings signals",
      evidence: [...signalEvidence("holdings-or-collections"), ...signalEvidence("holdings-or-editions")],
      allowedClaim: "Library and catalog signals describe preservation, cataloging, and holdings; they do not measure reading.",
    },
    {
      label: "Scholarly-discussion signals",
      evidence: signalEvidence("citation-or-scholarly-discussion"),
      allowedClaim: "OpenAlex name searches can map scholarly discussion, but require relevance review before author-level trend claims.",
    },
  ],
  publicClaimChecklist: [
    `Say this is a feasibility report based on ${result.probes} probes, not a measurement of canon change.`,
    `Mention ${result.accessibleProbes} accessible probes and ${result.blockedProbes} blocked probes.`,
    "Keep teaching, anthology, holdings, and citation evidence separated.",
    "Do not rank authors or works as more or less canonical from this artifact.",
    "Name blocked/constrained sources before proposing the narrow pilot.",
    "Frame the next study as one author cohort plus one signal layer.",
  ],
  copyeditNotes: [
    "Lead with the methodological problem: canon is an overloaded word hiding different institutions.",
    "Make the piece useful as a map of evidence types, not as a verdict about any author.",
    "Use the blocked HathiTrust and WorldCat probes as evidence that access terms shape quantitative humanities work.",
    "End by proposing a narrow pilot rather than a universal canon index.",
  ],
  blockedSources: blockedRows.map((row) => ({
    id: row.id,
    label: row.label,
    status: row.access_status,
    httpStatus: row.http_status,
    nextUse: row.publication_use,
  })),
};

await writeJson(path.join(reportsDir, "publication-handoff.json"), handoff);
await writeText(path.join(reportsDir, "publication-handoff.md"), buildMarkdown(handoff));

console.log("Built canon drift publication handoff");

function signalEvidence(signal) {
  return (result.rows ?? [])
    .filter((row) => row.signal === signal)
    .map((row) => ({
      id: row.id,
      label: row.label,
      accessStatus: row.access_status,
      recordsOrResults: row.records_or_results,
      publicationUse: row.publication_use,
      coverageRisk: row.coverage_risk,
    }));
}

function buildMarkdown(handoff) {
  return [
    "# Canon Drift Publication Handoff",
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
    `- Feasibility matrix: \`${handoff.paths.feasibilityMatrix}\``,
    "",
    "## Thesis",
    "",
    handoff.thesis,
    "",
    "## Corpus Note",
    "",
    `The artifact probes ${handoff.corpus.probes} sources across ${handoff.corpus.accessibleSignals.length} accessible signal types. ${handoff.corpus.accessibleProbes} probes were accessible and ${handoff.corpus.blockedProbes} were blocked or constrained in the latest run.`,
    "",
    "## Evidence Blocks",
    "",
    ...handoff.evidenceBlocks.flatMap((block) => [
      `### ${block.label}`,
      "",
      `Allowed claim: ${block.allowedClaim}`,
      "",
      ...block.evidence.map((row) => `- ${row.label}: ${row.accessStatus}, ${row.recordsOrResults} records/results. ${row.coverageRisk}`),
      "",
    ]),
    "## Blocked Sources",
    "",
    ...(handoff.blockedSources.length ? handoff.blockedSources.map((row) => `- ${row.label}: ${row.status} (${row.httpStatus}); ${row.nextUse}`) : ["- none"]),
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
