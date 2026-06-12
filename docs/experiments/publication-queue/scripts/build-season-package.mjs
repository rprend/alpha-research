import fs from "node:fs/promises";
import path from "node:path";

const queuePath = path.resolve("docs", "experiments", "publication-queue", "reports", "publication-queue.json");
const outDir = path.resolve("docs", "experiments", "publication-queue", "reports");
const queue = JSON.parse(await fs.readFile(queuePath, "utf8"));

const rows = queue.rows
  .filter((row) => row.readiness_status === "ready-for-editorial-review")
  .sort((a, b) => b.priority_score - a.priority_score || a.title.localeCompare(b.title));

const publishable = rows.map((row, index) => ({
  sequence: index + 1,
  id: row.id,
  title: row.title,
  format: row.format,
  editorialLane: row.editorial_lane,
  priorityScore: row.priority_score,
  status: row.readiness_status,
  action: row.recommended_action,
  postPath: row.post_path,
  postAuditPath: row.post_audit_path,
  postAuditStatus: row.post_audit_status,
  resultPath: row.result_path,
  readinessPath: row.readiness_path,
  summary: row.summary,
}));

const missing = publishable.filter((row) => !row.postPath || row.postAuditStatus !== "pass");
const packageArtifact = {
  generatedAt: new Date().toISOString(),
  title: "Archive Signals Season One Publication Package",
  status: missing.length ? "needs-work" : "ready-for-final-editorial-review",
  itemCount: publishable.length,
  auditedPostCount: publishable.filter((row) => row.postPath && row.postAuditStatus === "pass").length,
  launchOrder: publishable,
  remainingRequirements: missing.map((row) => ({
    id: row.id,
    title: row.title,
    missingPost: !row.postPath,
    auditStatus: row.postAuditStatus || "missing",
  })),
  editorialRules: [
    "Keep source-layer and sample-size caveats in the published posts.",
    "Do not promote audited pilot artifacts into broader claims without the next backfill.",
    "Treat evidence audits as publication-readiness checks for cited counts, not final peer review.",
    "Publish dataset notes or reproducibility notes alongside posts where licensing permits.",
  ],
};

await fs.writeFile(path.join(outDir, "season-one-package.json"), `${JSON.stringify(packageArtifact, null, 2)}\n`);
await fs.writeFile(path.join(outDir, "season-one-package.md"), buildMarkdown(packageArtifact));

console.log(`Built season package: ${packageArtifact.status} (${packageArtifact.auditedPostCount}/${packageArtifact.itemCount} audited posts)`);
if (process.argv.includes("--strict") && packageArtifact.status !== "ready-for-final-editorial-review") {
  process.exit(1);
}

function buildMarkdown(pkg) {
  return [
    "# Archive Signals Season One Publication Package",
    "",
    `Generated at: ${pkg.generatedAt}`,
    `Status: ${pkg.status}`,
    `Audited posts: ${pkg.auditedPostCount}/${pkg.itemCount}`,
    "",
    "## Launch Order",
    "",
    "| # | Title | Format | Status | Post | Audit |",
    "| ---: | --- | --- | --- | --- | --- |",
    ...pkg.launchOrder.map((row) => [
      row.sequence,
      row.title,
      row.format,
      row.action,
      row.postPath ? `\`${row.postPath}\`` : "missing",
      row.postAuditPath ? `\`${row.postAuditPath}\` (${row.postAuditStatus})` : "missing",
    ].join(" | ")).map((line) => `| ${line} |`),
    "",
    "## Editorial Rules",
    "",
    ...pkg.editorialRules.map((rule) => `- ${rule}`),
    "",
    "## Remaining Requirements",
    "",
    ...(pkg.remainingRequirements.length
      ? pkg.remainingRequirements.map((item) => `- ${item.title}: post missing=${item.missingPost}; audit=${item.auditStatus}`)
      : ["- None for final editorial review. Broader backfills and monitor runs remain separate research-production work."]),
    "",
  ].join("\n");
}
