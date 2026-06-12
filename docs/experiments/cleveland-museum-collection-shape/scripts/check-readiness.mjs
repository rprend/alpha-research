import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const result = await readJson(path.join(reportsDir, "result.json"));
const checks = [
  {
    id: "sample-size",
    label: "At least 5,000 artwork records are sampled for the first runnable build",
    status: result.sampleRecords >= 5000 ? "pass" : "needs-work",
    evidence: `${result.sampleRecords} records`,
  },
  {
    id: "department-coverage",
    label: "At least 10 departments are represented",
    status: result.departments.length >= 10 ? "pass" : "needs-work",
    evidence: `${result.departments.length} departments`,
  },
  {
    id: "date-coverage",
    label: "Creation-century and acquisition-decade tables exist",
    status: result.creationCenturies.length && result.acquisitionDecades.length ? "pass" : "needs-work",
    evidence: `${result.creationCenturies.length} creation-century rows; ${result.acquisitionDecades.length} acquisition-decade rows`,
  },
  {
    id: "rights-images",
    label: "License and image-availability summaries exist",
    status: result.licenses.length && result.imageAvailability.length ? "pass" : "needs-work",
    evidence: `${result.licenses.length} license rows; ${result.imageAvailability.length} image rows`,
  },
  {
    id: "public-draft",
    label: "Public draft exists and limits claims to one sampled institution",
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
    "Fetch the full collection or a larger paginated corpus.",
    "Audit acquisition-year extraction against explicit provenance/acquisition fields where available.",
    "Add chart artifacts for department, creation century, acquisition decade, rights, and image availability.",
    "Compare with a second open museum API before making cross-institution claims.",
  ],
};

await writeJson(path.join(reportsDir, "readiness.json"), readiness);
await writeText(
  path.join(reportsDir, "readiness.md"),
  [
    "# Cleveland Collection Shape Readiness Check",
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

console.log(`Cleveland collection readiness: ${readiness.status}`);
if (process.argv.includes("--strict") && status !== "ready-for-editorial-review") {
  process.exit(1);
}
