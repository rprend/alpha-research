import path from "node:path";
import {
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const result = await readJson(path.join(reportsDir, "result.json"));
const auditPacket = await readJson(path.join(reportsDir, "audit-packet.json"));

const checks = [
  check("processed-pages", result.pages === 22, `${result.pages} processed pages`),
  check("current-pages", result.currentPages === 10, `${result.currentPages} current pages`),
  check("historical-pages", result.historicalPages === 12, `${result.historicalPages} historical pages`),
  check("year-range", result.yearRange?.earliest === 2000 && result.yearRange?.latest === 2026, `${result.yearRange?.earliest}-${result.yearRange?.latest}`),
  check("current-global-leadership", result.currentTermFamilyTotals?.global_leadership === 98, `${result.currentTermFamilyTotals?.global_leadership}`),
  check("current-truth-knowledge", result.currentTermFamilyTotals?.truth_knowledge === 52, `${result.currentTermFamilyTotals?.truth_knowledge}`),
  check("current-innovation-impact", result.currentTermFamilyTotals?.innovation_impact === 47, `${result.currentTermFamilyTotals?.innovation_impact}`),
  check("current-civic-public", result.currentTermFamilyTotals?.civic_public === 37, `${result.currentTermFamilyTotals?.civic_public}`),
  check("current-inclusion-belonging", result.currentTermFamilyTotals?.inclusion_belonging === 23, `${result.currentTermFamilyTotals?.inclusion_belonging}`),
  check("current-excellence-prestige", result.currentTermFamilyTotals?.excellence_prestige === 17, `${result.currentTermFamilyTotals?.excellence_prestige}`),
  check("current-career-economy", result.currentTermFamilyTotals?.career_economy === 6, `${result.currentTermFamilyTotals?.career_economy}`),
  check("historical-global-leadership", result.historicalTermFamilyTotals?.global_leadership === 34, `${result.historicalTermFamilyTotals?.global_leadership}`),
  check("historical-civic-public", result.historicalTermFamilyTotals?.civic_public === 24, `${result.historicalTermFamilyTotals?.civic_public}`),
  check("historical-truth-knowledge", result.historicalTermFamilyTotals?.truth_knowledge === 20, `${result.historicalTermFamilyTotals?.truth_knowledge}`),
  check("historical-innovation-impact", result.historicalTermFamilyTotals?.innovation_impact === 20, `${result.historicalTermFamilyTotals?.innovation_impact}`),
  check("historical-excellence-prestige", result.historicalTermFamilyTotals?.excellence_prestige === 11, `${result.historicalTermFamilyTotals?.excellence_prestige}`),
  check("historical-career-economy", result.historicalTermFamilyTotals?.career_economy === 5, `${result.historicalTermFamilyTotals?.career_economy}`),
  check("historical-inclusion-belonging", result.historicalTermFamilyTotals?.inclusion_belonging === 2, `${result.historicalTermFamilyTotals?.inclusion_belonging}`),
  check("year-2003-pages", yearPages(2003) === 2, `${yearPages(2003)} pages in 2003`),
  check("year-2005-pages", yearPages(2005) === 2, `${yearPages(2005)} pages in 2005`),
  check("year-2020-pages", yearPages(2020) === 3, `${yearPages(2020)} pages in 2020`),
  check("audit-page-count", auditPacket.pageCount === 22, `${auditPacket.pageCount} audit pages`),
  check("audit-flags", flaggedRows() === 0, `${flaggedRows()} flagged rows`),
];

const audit = {
  generatedAt: new Date().toISOString(),
  postPath: "docs/experiments/university-mission-statement-drift/reports/post.md",
  resultPath: "docs/experiments/university-mission-statement-drift/reports/result.json",
  auditPacketPath: "docs/experiments/university-mission-statement-drift/reports/audit-packet.json",
  status: checks.every((item) => item.status === "pass") ? "pass" : "needs-review",
  checkCount: checks.length,
  passedCount: checks.filter((item) => item.status === "pass").length,
  checks,
  nextMoves: [
    "Keep the post framed as a source-layer methods piece, not a broad higher-education trend claim.",
    "Add catalogs, strategic plans, and speeches as separate source genres before stronger claims.",
    "Review snippets manually before quoting institutional language in public copy.",
  ],
};

await writeJson(path.join(reportsDir, "post-evidence-audit.json"), audit);
await writeText(path.join(reportsDir, "post-evidence-audit.md"), buildMarkdown(audit));

console.log(`University mission post evidence audit: ${audit.status} (${audit.passedCount}/${audit.checkCount} checks)`);
if (process.argv.includes("--strict") && audit.status !== "pass") {
  process.exit(1);
}

function yearPages(year) {
  const rows = result.termFamilyByYear.filter((row) => row.year === year);
  return rows.length ? rows[0].pages : 0;
}

function flaggedRows() {
  if (typeof auditPacket.flaggedRows === "number") return auditPacket.flaggedRows;
  return (auditPacket.rows ?? []).filter((row) => String(row.flags ?? "").trim()).length;
}

function check(id, passed, evidence) {
  return {
    id,
    status: passed ? "pass" : "needs-review",
    evidence,
  };
}

function buildMarkdown(audit) {
  return [
    "# University Mission Statement Drift Post Evidence Audit",
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
