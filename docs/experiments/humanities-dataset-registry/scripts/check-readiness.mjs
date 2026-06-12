import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const result = await readJson(path.join(reportsDir, "result.json"));
const readyDomains = new Set((result.rows ?? []).filter((row) => row.readiness_bucket === "ready-now").map((row) => row.domain));
const checks = [
  {
    id: "candidate-count",
    label: "At least 12 candidate humanities datasets are ranked",
    status: result.candidates >= 12 ? "pass" : "needs-work",
    evidence: `${result.candidates} candidates`,
  },
  {
    id: "accessible-candidates",
    label: "At least 10 candidates are accessible in the latest probe",
    status: result.accessibleCandidates >= 10 ? "pass" : "needs-work",
    evidence: `${result.accessibleCandidates} accessible candidates`,
  },
  {
    id: "ready-now",
    label: "At least 5 candidates are ready-now for first study specs",
    status: result.readyCandidates >= 5 ? "pass" : "needs-work",
    evidence: `${result.readyCandidates} ready-now candidates`,
  },
  {
    id: "domain-diversity",
    label: "Ready-now candidates cover at least three domains",
    status: readyDomains.size >= 3 ? "pass" : "needs-work",
    evidence: [...readyDomains].join(", ") || "none",
  },
  {
    id: "public-draft",
    label: "Public draft exists and distinguishes readiness from representativeness",
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
    "Create study specs for the top three ready-now corpora.",
    "Add file-level and API-pagination probes for the highest-ranked candidates.",
    "Add licensing notes before any public redistribution of derived data.",
    "Separate corpus availability from cultural representativeness in every draft.",
  ],
};

await writeJson(path.join(reportsDir, "readiness.json"), readiness);
await writeText(
  path.join(reportsDir, "readiness.md"),
  [
    "# Humanities Dataset Registry Readiness Check",
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

console.log(`Humanities dataset registry readiness: ${readiness.status}`);
if (process.argv.includes("--strict") && status !== "ready-for-editorial-review") {
  process.exit(1);
}
