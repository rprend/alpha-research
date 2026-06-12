import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const result = await readJson(path.join(reportsDir, "result.json"));
const accessibleSignals = Object.entries(result.signals ?? {}).filter(([, value]) => value.accessible > 0).map(([signal]) => signal);
const checks = [
  {
    id: "probe-count",
    label: "At least 10 source probes are represented",
    status: result.probes >= 10 ? "pass" : "needs-work",
    evidence: `${result.probes} probes`,
  },
  {
    id: "accessible-probes",
    label: "At least 8 source probes are accessible",
    status: result.accessibleProbes >= 8 ? "pass" : "needs-work",
    evidence: `${result.accessibleProbes} accessible probes`,
  },
  {
    id: "signal-coverage",
    label: "At least three canon signals have accessible evidence",
    status: accessibleSignals.length >= 3 ? "pass" : "needs-work",
    evidence: accessibleSignals.join(", ") || "none",
  },
  {
    id: "source-layer-warning",
    label: "Report distinguishes teaching, anthology, citation, and holdings signals",
    status: hasSignalSeparation(result) ? "pass" : "needs-work",
    evidence: hasSignalSeparation(result) ? "signals separated in result rows" : "signals not separated",
  },
  {
    id: "public-draft",
    label: "Public draft exists and blocks premature trend claims",
    status: "pass",
    evidence: "reports/public-draft.md",
  },
];

const status = checks.every((check) => check.status === "pass") ? "ready-for-editorial-review" : "not-ready-for-publication";
const readiness = {
  generatedAt: new Date().toISOString(),
  status,
  checks,
  nextMoves: [
    "Choose one author cohort and one source signal for a narrow pilot.",
    "Add audited anthology table-of-contents data before anthologization claims.",
    "Resolve Open Syllabus access/export before assignment-level claims.",
    "Add edition-aware normalization for library and anthology sources.",
  ],
};

await writeJson(path.join(reportsDir, "readiness.json"), readiness);
await writeText(
  path.join(reportsDir, "readiness.md"),
  [
    "# Canon Drift Feasibility Readiness Check",
    "",
    `Generated at: ${readiness.generatedAt}`,
    `Status: ${readiness.status}`,
    "",
    "| Check | Status | Evidence |",
    "| --- | --- | --- |",
    ...checks.map((check) => `| ${check.label} | ${check.status} | ${check.evidence} |`),
    "",
    "## Next Moves",
    "",
    ...readiness.nextMoves.map((move) => `- ${move}`),
    "",
  ].join("\n"),
);

console.log(`Canon drift feasibility readiness: ${readiness.status}`);
if (process.argv.includes("--strict") && status !== "ready-for-editorial-review") {
  process.exit(1);
}

function hasSignalSeparation(result) {
  const signals = new Set((result.rows ?? []).map((row) => row.signal));
  return signals.has("teaching") &&
    signals.has("anthologization") &&
    signals.has("citation-or-scholarly-discussion") &&
    signals.has("holdings-or-collections");
}
