import fs from "node:fs/promises";
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
  check("sample-records", result.sampleRecords === 5000, `${result.sampleRecords} sampled records`),
  check("total-available", result.totalAvailable === 68743, `${result.totalAvailable} total API records`),
  check("sample-share", Math.round(result.sampleShare * 1000) / 10 === 7.3, `${(result.sampleShare * 100).toFixed(1)}% sample share`),
  check("top-department", result.departments?.[0]?.value === "Medieval Art" && result.departments?.[0]?.count === 1313, `${result.departments?.[0]?.value}: ${result.departments?.[0]?.count}`),
  check("top-creation-century", result.creationCenturies?.[0]?.value === "10th century" && result.creationCenturies?.[0]?.count === 911, `${result.creationCenturies?.[0]?.value}: ${result.creationCenturies?.[0]?.count}`),
  check("top-acquisition-decade", result.acquisitionDecades?.[0]?.value === "1940s" && result.acquisitionDecades?.[0]?.count === 1275, `${result.acquisitionDecades?.[0]?.value}: ${result.acquisitionDecades?.[0]?.count}`),
  check("image-availability", imageCount("has-image") === 4360 && imageCount("no-image") === 640, `has image=${imageCount("has-image")}; no image=${imageCount("no-image")}`),
  check("audit-flagged-rows", auditPacket.flaggedRows === 1230, `${auditPacket.flaggedRows} flagged rows`),
  check("audit-accession-mismatches", auditPacket.mismatchRows === 229, `${auditPacket.mismatchRows} accession-year mismatches`),
  check("audit-no-image", auditPacket.noImageRows === 640, `${auditPacket.noImageRows} rows without image`),
  check("audit-no-provenance", auditPacket.flagCounts?.["no-provenance-entries"] === 582, `${auditPacket.flagCounts?.["no-provenance-entries"]} rows without provenance entries`),
  ...(await chartChecks()),
];

const audit = {
  generatedAt: new Date().toISOString(),
  postPath: "docs/experiments/cleveland-museum-collection-shape/reports/post.md",
  resultPath: "docs/experiments/cleveland-museum-collection-shape/reports/result.json",
  auditPacketPath: "docs/experiments/cleveland-museum-collection-shape/reports/audit-packet.json",
  status: checks.every((item) => item.status === "pass") ? "pass" : "needs-review",
  checkCount: checks.length,
  passedCount: checks.filter((item) => item.status === "pass").length,
  checks,
  nextMoves: [
    "Keep the post framed as a bounded 5,000-record Cleveland sample.",
    "Do not strengthen acquisition-decade language without manual review of mismatch rows.",
    "Fetch the full Cleveland API corpus before treating the charts as full-collection charts.",
  ],
};

await writeJson(path.join(reportsDir, "post-evidence-audit.json"), audit);
await writeText(path.join(reportsDir, "post-evidence-audit.md"), buildMarkdown(audit));

console.log(`Cleveland post evidence audit: ${audit.status} (${audit.passedCount}/${audit.checkCount} checks)`);
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

function imageCount(value) {
  return result.imageAvailability?.find((row) => row.value === value)?.count;
}

async function chartChecks() {
  const names = [
    "departments.svg",
    "creation-centuries.svg",
    "acquisition-decades.svg",
    "image-availability.svg",
  ];
  return Promise.all(names.map(async (name) => {
    const file = path.join(reportsDir, "charts", name);
    try {
      const stat = await fs.stat(file);
      return check(`chart-${name}`, stat.size > 0, `${file}; ${stat.size} bytes`);
    } catch {
      return check(`chart-${name}`, false, `${file} missing`);
    }
  }));
}

function buildMarkdown(audit) {
  return [
    "# Cleveland Collection Shape Post Evidence Audit",
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
