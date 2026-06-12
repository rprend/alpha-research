import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureDir,
  escapeHtml,
  experimentDir,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";

const reportsDir = path.join(experimentDir, "reports");
const chartsDir = path.join(reportsDir, "charts");
const result = await readJson(path.join(reportsDir, "result.json"));
await fs.rm(chartsDir, { recursive: true, force: true });
await ensureDir(chartsDir);

const charts = [
  {
    id: "departments",
    title: "Top Departments In The Sample",
    filename: "departments.svg",
    rows: result.departments.slice(0, 12),
  },
  {
    id: "creation-centuries",
    title: "Creation Century Distribution",
    filename: "creation-centuries.svg",
    rows: orderChronological(result.creationCenturies).filter((row) => row.value !== "unknown"),
  },
  {
    id: "acquisition-decades",
    title: "Accession-Year Decade Proxy",
    filename: "acquisition-decades.svg",
    rows: orderChronological(result.acquisitionDecades).filter((row) => row.value !== "unknown"),
  },
  {
    id: "image-availability",
    title: "Image Availability In The Sample",
    filename: "image-availability.svg",
    rows: result.imageAvailability,
  },
];

for (const chart of charts) {
  await writeText(path.join(chartsDir, chart.filename), barChart(chart));
}

const manifest = {
  generatedAt: new Date().toISOString(),
  chartCount: charts.length,
  charts: charts.map((chart) => ({
    id: chart.id,
    title: chart.title,
    path: path.join("reports", "charts", chart.filename),
    rows: chart.rows.length,
  })),
};
await writeJson(path.join(chartsDir, "manifest.json"), manifest);
await writeText(path.join(chartsDir, "README.md"), [
  "# Cleveland Collection Shape Charts",
  "",
  `Generated at: ${manifest.generatedAt}`,
  "",
  ...manifest.charts.map((chart) => `- ${chart.title}: \`${chart.path}\``),
  "",
].join("\n"));

console.log(`Built ${manifest.chartCount} Cleveland collection chart artifacts`);

function orderChronological(rows) {
  return [...rows].sort((a, b) => chronologyValue(a.value) - chronologyValue(b.value));
}

function chronologyValue(value) {
  const text = String(value);
  if (text === "unknown") return Number.MAX_SAFE_INTEGER;
  const match = text.match(/-?\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function barChart({ title, rows }) {
  const width = 980;
  const left = 260;
  const top = 54;
  const barHeight = 24;
  const gap = 8;
  const right = 120;
  const bottom = 34;
  const height = top + rows.length * (barHeight + gap) + bottom;
  const max = Math.max(...rows.map((row) => Number(row.count)), 1);
  const plotWidth = width - left - right;
  const palette = ["#3b6ea8", "#7a9a01", "#c7532b", "#6b5ca5", "#20806d", "#b45f96"];
  const bars = rows.map((row, index) => {
    const y = top + index * (barHeight + gap);
    const barWidth = Math.max(2, (Number(row.count) / max) * plotWidth);
    const color = palette[index % palette.length];
    return [
      `<text x="${left - 12}" y="${y + 17}" text-anchor="end" class="label">${escapeHtml(row.value)}</text>`,
      `<rect x="${left}" y="${y}" width="${barWidth.toFixed(1)}" height="${barHeight}" fill="${color}" rx="2"></rect>`,
      `<text x="${left + barWidth + 8}" y="${y + 17}" class="value">${row.count} (${Math.round(Number(row.share) * 1000) / 10}%)</text>`,
    ].join("\n");
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
  <style>
    .title { font: 700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #1f2933; }
    .label { font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #334e68; }
    .value { font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #52606d; }
    .axis { stroke: #bcccdc; stroke-width: 1; }
  </style>
  <rect width="100%" height="100%" fill="#ffffff"></rect>
  <text x="24" y="34" class="title">${escapeHtml(title)}</text>
  <line x1="${left}" y1="${top - 10}" x2="${left}" y2="${height - bottom + 4}" class="axis"></line>
  ${bars}
</svg>
`;
}
