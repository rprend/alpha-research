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
    id: "current-pages",
    label: "At least 12 current museum pages are collected",
    status: result.currentPages >= 12 ? "pass" : "needs-work",
    evidence: `${result.currentPages} current pages`,
  },
  {
    id: "museum-coverage",
    label: "At least 10 museums are represented",
    status: result.museums >= 10 ? "pass" : "needs-work",
    evidence: `${result.museums} museums`,
  },
  {
    id: "source-genres",
    label: "At least three source genres are represented",
    status: result.pageTypes.length >= 3 ? "pass" : "needs-work",
    evidence: result.pageTypes.join(", ") || "none",
  },
  {
    id: "historical-pages",
    label: "Historical snapshots exist before temporal claims",
    status: result.historicalPages >= 12 ? "pass" : "needs-work",
    evidence: `${result.historicalPages} historical snapshots`,
  },
  {
    id: "public-draft",
    label: "Public draft exists and blocks premature claims",
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
    "Add Wayback snapshots for selected current pages and historically stable museum URLs.",
    "Add annual reports, exhibition pages, collection pages, and provenance pages as source layers.",
    "Build a snippet audit packet before public claims.",
  ],
};

await writeJson(path.join(reportsDir, "readiness.json"), readiness);
await writeText(
  path.join(reportsDir, "readiness.md"),
  [
    "# Museum Language Drift Readiness Check",
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

console.log(`Museum language readiness: ${readiness.status}`);
if (process.argv.includes("--strict") && status !== "ready-for-editorial-review") {
  process.exit(1);
}
