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

const pageTypeCounts = new Map(result.pageTypes.map((pageType) => [
  pageType,
  new Set(result.termFamilyByPageType
    .filter((row) => row.page_type === pageType)
    .map((row) => row.pages)).values().next().value,
]));

const checks = [
  check("processed-pages", result.pages === 40, `${result.pages} processed pages`),
  check("current-pages", result.currentPages === 28, `${result.currentPages} current pages`),
  check("historical-pages", result.historicalPages === 12, `${result.historicalPages} historical pages`),
  check("museum-count", result.museums === 14, `${result.museums} museums`),
  check("year-range", result.yearRange?.earliest === 2005 && result.yearRange?.latest === 2026, `${result.yearRange?.earliest}-${result.yearRange?.latest}`),
  check("page-types", sameSet(result.pageTypes, ["about", "collection", "education", "exhibition", "research"]), result.pageTypes.join(", ")),
  check("term-access-public", result.termFamilyTotals?.access_public === 143, `${result.termFamilyTotals?.access_public}`),
  check("term-research-scholarship", result.termFamilyTotals?.research_scholarship === 134, `${result.termFamilyTotals?.research_scholarship}`),
  check("term-community-inclusion", result.termFamilyTotals?.community_inclusion === 54, `${result.termFamilyTotals?.community_inclusion}`),
  check("term-provenance-ownership", result.termFamilyTotals?.provenance_ownership === 9, `${result.termFamilyTotals?.provenance_ownership}`),
  check("term-civilization-world-culture", result.termFamilyTotals?.civilization_world_culture === 4, `${result.termFamilyTotals?.civilization_world_culture}`),
  check("term-restitution-repatriation", result.termFamilyTotals?.restitution_repatriation === 3, `${result.termFamilyTotals?.restitution_repatriation}`),
  check("term-decolonization-reckoning", result.termFamilyTotals?.decolonization_reckoning === 3, `${result.termFamilyTotals?.decolonization_reckoning}`),
  check("about-page-count", pageTypeCounts.get("about") === 13, `${pageTypeCounts.get("about")} about pages`),
  check("collection-page-count", pageTypeCounts.get("collection") === 8, `${pageTypeCounts.get("collection")} collection pages`),
  check("research-page-count", pageTypeCounts.get("research") === 3, `${pageTypeCounts.get("research")} research pages`),
  check("about-access-public", pageTypeFamily("about", "access_public")?.count === 97, `${pageTypeFamily("about", "access_public")?.count}`),
  check("about-research-scholarship", pageTypeFamily("about", "research_scholarship")?.count === 68, `${pageTypeFamily("about", "research_scholarship")?.count}`),
  check("about-community-inclusion", pageTypeFamily("about", "community_inclusion")?.count === 52, `${pageTypeFamily("about", "community_inclusion")?.count}`),
  check("collection-research-scholarship", pageTypeFamily("collection", "research_scholarship")?.count === 25, `${pageTypeFamily("collection", "research_scholarship")?.count}`),
  check("collection-provenance-ownership", pageTypeFamily("collection", "provenance_ownership")?.count === 4, `${pageTypeFamily("collection", "provenance_ownership")?.count}`),
  check("collection-restitution-repatriation", pageTypeFamily("collection", "restitution_repatriation")?.count === 2, `${pageTypeFamily("collection", "restitution_repatriation")?.count}`),
  check("research-research-scholarship", pageTypeFamily("research", "research_scholarship")?.count === 31, `${pageTypeFamily("research", "research_scholarship")?.count}`),
  check("research-provenance-ownership", pageTypeFamily("research", "provenance_ownership")?.count === 4, `${pageTypeFamily("research", "provenance_ownership")?.count}`),
  check("historical-2012-pages", yearPages(2012) === 2, `${yearPages(2012)} pages in 2012`),
  check("historical-2015-pages", yearPages(2015) === 3, `${yearPages(2015)} pages in 2015`),
  check("audit-page-count", auditPacket.pageCount === 40, `${auditPacket.pageCount} audit pages`),
  check("audit-flags", auditPacket.flaggedRows === 0, `${auditPacket.flaggedRows} flagged rows`),
];

const audit = {
  generatedAt: new Date().toISOString(),
  postPath: "docs/experiments/museum-language-drift/reports/post.md",
  resultPath: "docs/experiments/museum-language-drift/reports/result.json",
  auditPacketPath: "docs/experiments/museum-language-drift/reports/audit-packet.json",
  status: checks.every((item) => item.status === "pass") ? "pass" : "needs-review",
  checkCount: checks.length,
  passedCount: checks.filter((item) => item.status === "pass").length,
  checks,
  nextMoves: [
    "Keep the post framed as a source-layer probe, not a museum-practice claim.",
    "Add annual reports and provenance pages as separate source layers before stronger trend claims.",
    "Review snippets manually before quoting source language in public copy.",
  ],
};

await writeJson(path.join(reportsDir, "post-evidence-audit.json"), audit);
await writeText(path.join(reportsDir, "post-evidence-audit.md"), buildMarkdown(audit));

console.log(`Museum language post evidence audit: ${audit.status} (${audit.passedCount}/${audit.checkCount} checks)`);
if (process.argv.includes("--strict") && audit.status !== "pass") {
  process.exit(1);
}

function pageTypeFamily(pageType, family) {
  return result.termFamilyByPageType.find((row) => row.page_type === pageType && row.family === family);
}

function yearPages(year) {
  const rows = result.termFamilyByYear.filter((row) => row.year === year);
  return rows.length ? rows[0].pages : 0;
}

function sameSet(actual, expected) {
  return actual.length === expected.length && expected.every((item) => actual.includes(item));
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
    "# Museum Language Drift Post Evidence Audit",
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
