import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const result = await readJson(path.join(reportsDir, "result.json"));

const rowById = new Map(result.rows.map((row) => [row.id, row]));

const checks = [
  check("probe-count", result.probes === 13, `${result.probes} probes`),
  check("accessible-probes", result.accessibleProbes === 11, `${result.accessibleProbes} accessible probes`),
  check("blocked-probes", result.blockedProbes === 2, `${result.blockedProbes} blocked probes`),
  checkSignal("teaching", 3, 3),
  checkSignal("anthologization", 1, 1),
  checkSignal("holdings-or-collections", 1, 1),
  checkSignal("holdings-or-editions", 2, 0),
  checkSignal("citation-or-scholarly-discussion", 6, 6),
  checkRow("mit-ocw-literature", "accessible", 1),
  checkRow("yale-open-courses-literature", "accessible", 2),
  checkRow("open-syllabus", "accessible", 2),
  checkRow("norton-anthology-english-literature", "accessible", 0),
  checkRow("library-of-congress-collections", "accessible", 2430),
  checkRow("hathitrust-catalog", "http-error", 0, 403),
  checkRow("worldcat-search", "http-error", 0, 429),
  checkRow("openalex-toni-morrison", "accessible", 18993),
  checkRow("openalex-jane-austen", "accessible", 23051),
  checkRow("openalex-william-shakespeare", "accessible", 68477),
  checkRow("openalex-w-e-b-du-bois", "accessible", 98545),
  checkRow("openalex-hannah-arendt", "accessible", 78575),
  checkRow("openalex-michel-foucault", "accessible", 223815),
];

const audit = {
  generatedAt: new Date().toISOString(),
  postPath: "docs/experiments/canon-drift-feasibility/reports/post.md",
  resultPath: "docs/experiments/canon-drift-feasibility/reports/result.json",
  sourceInventoryPath: "docs/experiments/canon-drift-feasibility/reports/source-inventory.md",
  status: checks.every((item) => item.status === "pass") ? "pass" : "needs-review",
  checkCount: checks.length,
  passedCount: checks.filter((item) => item.status === "pass").length,
  checks,
  nextMoves: [
    "Keep the post framed as a feasibility report, not a canon-change measurement.",
    "Choose one author cohort and one signal layer before the first trend claim.",
    "Resolve Open Syllabus export terms before assignment-level claims.",
    "Treat HathiTrust and WorldCat as blocked until access terms or fetchability are resolved.",
  ],
};

await writeJson(path.join(reportsDir, "post-evidence-audit.json"), audit);
await writeText(path.join(reportsDir, "post-evidence-audit.md"), buildMarkdown(audit));

console.log(`Canon drift post evidence audit: ${audit.status} (${audit.passedCount}/${audit.checkCount} checks)`);
if (process.argv.includes("--strict") && audit.status !== "pass") {
  process.exit(1);
}

function check(id, passed, evidence) {
  return {
    id,
    status: passed ? "pass" : "needs-review",
    evidence,
  };
}

function checkSignal(signal, probes, accessible) {
  const row = result.signals?.[signal];
  return check(
    `signal-${signal}`,
    row?.probes === probes && row?.accessible === accessible,
    `probes=${row?.probes}; accessible=${row?.accessible}`,
  );
}

function checkRow(id, accessStatus, recordsOrResults, httpStatus) {
  const row = rowById.get(id);
  const passed = row
    && row.access_status === accessStatus
    && row.records_or_results === recordsOrResults
    && (httpStatus == null || row.http_status === httpStatus);
  return check(
    `source-${id}`,
    passed,
    row
      ? `access=${row.access_status}; records=${row.records_or_results}; http=${row.http_status}`
      : "missing source row",
  );
}

function buildMarkdown(audit) {
  return [
    "# Canon Drift Feasibility Post Evidence Audit",
    "",
    `Generated at: ${audit.generatedAt}`,
    `Status: ${audit.status}`,
    `Checks passed: ${audit.passedCount}/${audit.checkCount}`,
    "",
    "| Check | Status | Evidence |",
    "| --- | --- | --- |",
    ...audit.checks.map((item) => `| ${item.id} | ${item.status} | ${String(item.evidence).replaceAll("|", "\\|")} |`),
    "",
    "## Next Moves",
    "",
    ...audit.nextMoves.map((move) => `- ${move}`),
    "",
  ].join("\n");
}
