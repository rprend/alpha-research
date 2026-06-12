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
  check("corpus-records", result.sampleRecords === 68742, `${result.sampleRecords} corpus records`),
  check("total-available", result.totalAvailable === 68743, `${result.totalAvailable} total API records`),
  check("corpus-share", Math.round(result.sampleShare * 1000) / 10 === 100, `${(result.sampleShare * 100).toFixed(1)}% corpus share`),
  check("corpus-tier", result.corpusTier === "full-source-corpus" && result.missingFromApiTotal === 1, `${result.corpusTier}; missing ${result.missingFromApiTotal}`),
  check("top-department", result.departments?.[0]?.value === "Prints" && result.departments?.[0]?.count === 21155, `${result.departments?.[0]?.value}: ${result.departments?.[0]?.count}`),
  check("top-creation-century", result.creationCenturies?.[0]?.value === "20th century" && result.creationCenturies?.[0]?.count === 24306, `${result.creationCenturies?.[0]?.value}: ${result.creationCenturies?.[0]?.count}`),
  check("top-acquisition-decade", result.acquisitionDecades?.[0]?.value === "2010s" && result.acquisitionDecades?.[0]?.count === 8250, `${result.acquisitionDecades?.[0]?.value}: ${result.acquisitionDecades?.[0]?.count}`),
  check("image-availability", imageCount("has-image") === 41444 && imageCount("no-image") === 27298, `has image=${imageCount("has-image")}; no image=${imageCount("no-image")}`),
  check("audit-flagged-rows", auditPacket.flaggedRows === 47636, `${auditPacket.flaggedRows} flagged rows`),
  check("audit-accession-mismatches", auditPacket.mismatchRows === 7739, `${auditPacket.mismatchRows} accession-year mismatches`),
  check("audit-no-image", auditPacket.noImageRows === 27298, `${auditPacket.noImageRows} rows without image`),
  check("audit-no-provenance", auditPacket.flagCounts?.["no-provenance-entries"] === 37779, `${auditPacket.flagCounts?.["no-provenance-entries"]} rows without provenance entries`),
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
    "Keep the post framed as one full-source Cleveland API corpus, not museums in general.",
    "Do not strengthen acquisition-decade language without manual review of mismatch rows.",
    "Compare with another open museum API before making cross-institution claims.",
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
