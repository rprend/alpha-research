import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("docs", "experiments");
const outDir = path.join(root, "publication-queue", "reports");
const experiments = [
  {
    id: "cleveland-museum-collection-shape",
    title: "What A Museum Collection Looks Like When It Becomes Data",
    format: "field-map",
    path: "docs/experiments/cleveland-museum-collection-shape",
    editorialLane: "first-public-essay",
  },
  {
    id: "humanities-dataset-registry",
    title: "What Counts As A Humanities Dataset?",
    format: "research-agenda",
    path: "docs/experiments/humanities-dataset-registry",
    editorialLane: "research-agenda",
  },
  {
    id: "canon-drift-feasibility",
    title: "Canon Drift: A Feasibility Report",
    format: "moving-canon",
    path: "docs/experiments/canon-drift-feasibility",
    editorialLane: "methods-piece",
  },
  {
    id: "humanities-literature-radar",
    title: "The Rise Of AI And The Humanities",
    format: "field-map",
    path: "docs/experiments/humanities-literature-radar",
    editorialLane: "field-map",
  },
  {
    id: "university-mission-statement-drift",
    title: "What Universities Say They Are For",
    format: "what-changed",
    path: "docs/experiments/university-mission-statement-drift",
    editorialLane: "longitudinal",
  },
  {
    id: "museum-language-drift",
    title: "The Language Of Museums After Decolonization",
    format: "what-changed",
    path: "docs/experiments/museum-language-drift",
    editorialLane: "longitudinal",
  },
];

await fs.mkdir(outDir, { recursive: true });
const rows = [];
for (const experiment of experiments) {
  rows.push(await buildRow(experiment));
}
rows.sort((a, b) => b.priority_score - a.priority_score || a.title.localeCompare(b.title));

const queue = {
  generatedAt: new Date().toISOString(),
  itemCount: rows.length,
  readyCount: rows.filter((row) => row.readiness_status === "ready-for-editorial-review").length,
  notReadyCount: rows.filter((row) => row.readiness_status !== "ready-for-editorial-review").length,
  rows,
};

await writeJson(path.join(outDir, "publication-queue.json"), queue);
await writeText(path.join(outDir, "publication-queue.csv"), toCsv(rows, [
  "id",
  "title",
  "format",
  "editorial_lane",
  "readiness_status",
  "priority_score",
  "recommended_action",
  "draft_path",
  "result_path",
  "readiness_path",
]));
await writeText(path.join(outDir, "publication-queue.md"), buildQueueMarkdown(queue));
await writeText(path.join(outDir, "editorial-calendar.md"), buildCalendarMarkdown(rows));

console.log(`Built publication queue with ${rows.length} items (${queue.readyCount} ready)`);

async function buildRow(experiment) {
  const reportsDir = path.join(experiment.path, "reports");
  const resultPath = path.join(reportsDir, "result.json");
  const readinessPath = path.join(reportsDir, "readiness.json");
  const draftPath = path.join(reportsDir, "public-draft.md");
  const result = await readOptionalJson(resultPath);
  const readiness = await readOptionalJson(readinessPath);
  const draft = await readOptionalText(draftPath);
  const checks = readiness?.checks ?? [];
  const failedChecks = checks.filter((check) => check.status !== "pass");
  const ready = readiness?.status === "ready-for-editorial-review";
  const hasDraft = Boolean(draft?.trim());
  const chartCount = await countCharts(reportsDir);
  const priorityScore = score({ ready, failedChecks, hasDraft, chartCount, experiment });
  return {
    id: experiment.id,
    title: experiment.title,
    format: experiment.format,
    editorial_lane: experiment.editorialLane,
    readiness_status: readiness?.status ?? "missing-readiness",
    priority_score: priorityScore,
    recommended_action: recommend({ ready, failedChecks, hasDraft, chartCount, experiment }),
    failed_checks: failedChecks.map((check) => `${check.id}: ${check.evidence}`).join("; "),
    draft_exists: hasDraft,
    chart_count: chartCount,
    summary: result?.strongestFinding ?? result?.articleReadiness?.strongestNextMove ?? "",
    draft_path: draftPath,
    result_path: resultPath,
    readiness_path: readinessPath,
  };
}

function score({ ready, failedChecks, hasDraft, chartCount, experiment }) {
  let value = ready ? 100 : 20;
  if (hasDraft) value += 10;
  if (chartCount) value += Math.min(10, chartCount * 2);
  value -= failedChecks.length * 12;
  if (experiment.editorialLane === "first-public-essay") value += 15;
  if (experiment.editorialLane === "methods-piece") value += 8;
  return value;
}

function recommend({ ready, failedChecks, chartCount, experiment }) {
  if (ready && experiment.editorialLane === "first-public-essay") return "Move into polished public draft with chart captions and audit caveats.";
  if (ready && chartCount) return "Edit public draft, preserve caveats, and prepare chart-backed post.";
  if (ready) return "Edit as methods/research-agenda post; add charts if useful.";
  if (failedChecks.length) return `Resolve readiness blockers: ${failedChecks.map((check) => check.id).join(", ")}.`;
  return "Inspect missing readiness evidence.";
}

async function countCharts(reportsDir) {
  try {
    const entries = await fs.readdir(path.join(reportsDir, "charts"));
    return entries.filter((entry) => entry.endsWith(".svg")).length;
  } catch {
    return 0;
  }
}

async function readOptionalJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function readOptionalText(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, value);
}

function toCsv(rows, columns) {
  const escape = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${[columns.join(","), ...rows.map((row) => columns.map((col) => escape(row[col])).join(","))].join("\n")}\n`;
}

function buildQueueMarkdown(queue) {
  const detailLines = [];
  for (const row of queue.rows) {
    detailLines.push(
      `### ${row.title}`,
      "",
      `- Format: ${row.format}`,
      `- Lane: ${row.editorial_lane}`,
      `- Status: ${row.readiness_status}`,
      `- Draft: \`${row.draft_path}\``,
      `- Result: \`${row.result_path}\``,
      `- Readiness: \`${row.readiness_path}\``,
      `- Failed checks: ${row.failed_checks || "none"}`,
      `- Action: ${row.recommended_action}`,
    );
    if (row.summary) detailLines.push(`- Summary: ${row.summary}`);
    detailLines.push("");
  }
  return [
    "# Cultural Observatory Publication Queue",
    "",
    `Generated at: ${queue.generatedAt}`,
    `Ready for editorial review: ${queue.readyCount}`,
    `Not ready: ${queue.notReadyCount}`,
    "",
    "| Priority | Title | Status | Action |",
    "| ---: | --- | --- | --- |",
    ...queue.rows.map((row) => `| ${row.priority_score} | ${row.title} | ${row.readiness_status} | ${row.recommended_action} |`),
    "",
    "## Details",
    "",
    ...detailLines,
  ].join("\n");
}

function buildCalendarMarkdown(rows) {
  const ready = rows.filter((row) => row.readiness_status === "ready-for-editorial-review");
  const blocked = rows.filter((row) => row.readiness_status !== "ready-for-editorial-review");
  return [
    "# Editorial Calendar Draft",
    "",
    "## Publish/Edit Queue",
    "",
    ...ready.map((row, index) => `${index + 1}. ${row.title} - ${row.recommended_action}`),
    "",
    "## Source Work Queue",
    "",
    ...blocked.map((row, index) => `${index + 1}. ${row.title} - ${row.recommended_action}`),
    "",
  ].join("\n");
}
