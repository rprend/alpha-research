import fs from "node:fs/promises";
import path from "node:path";
import {
  escapeHtml,
  experimentDir,
  readJson,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const { manifest, runDir } = await latestRun();
const artworks = [];
for (const request of manifest.requests.filter((row) => Number(row.status) >= 200 && Number(row.status) < 300)) {
  const json = await readJson(path.join(experimentDir, request.responsePath));
  for (const item of json.data ?? []) artworks.push(normalizeArtwork(item));
}

const departmentCounts = topCounts(artworks, "department", 40);
const collectionCounts = topCounts(artworks, "collection", 40);
const typeCounts = topCounts(artworks, "type", 40);
const cultureCounts = topArrayCounts(artworks, "culture", 40);
const creationCenturyCounts = countBy(artworks, (row) => centuryLabel(row.creation_date_earliest));
const acquisitionDecadeCounts = countBy(artworks, (row) => decadeLabel(accessionYear(row.accession_number)));
const licenseCounts = topCounts(artworks, "share_license_status", 20);
const imageCounts = countBy(artworks, (row) => row.has_image ? "has-image" : "no-image");
const result = {
  generatedAt: new Date().toISOString(),
  source: manifest.source,
  sampleRecords: artworks.length,
  totalAvailable: manifest.totalAvailable,
  sampleShare: manifest.totalAvailable ? Number((artworks.length / manifest.totalAvailable).toFixed(4)) : null,
  departments: departmentCounts,
  collections: collectionCounts,
  types: typeCounts,
  cultures: cultureCounts,
  creationCenturies: creationCenturyCounts,
  acquisitionDecades: acquisitionDecadeCounts,
  licenses: licenseCounts,
  imageAvailability: imageCounts,
  representativeRecords: artworks.slice(0, 20),
  strongestFinding: "A structured museum API turns a collection into analyzable records, but the first artifact is a bounded sample of one institution, not a statement about museums generally.",
  caveats: [
    "This run uses a bounded API sample, not the full collection.",
    "Object metadata completeness varies by department, object type, date, culture, and image availability.",
    "Accession-number dates are a rough acquisition proxy and need audit before publication claims.",
    "One open museum collection cannot stand in for museum collections as a whole.",
  ],
  nextMoves: [
    "Fetch the full collection or a larger paginated corpus.",
    "Audit accession-number year extraction against explicit acquisition fields where available.",
    "Compare against another open museum API before making cross-institution claims.",
    "Use the generated chart artifacts in the public draft.",
  ],
  rawRunDir: path.relative(experimentDir, runDir),
};

await writeJson(path.join(processedDir, "artworks.json"), artworks);
await writeText(path.join(processedDir, "artworks.csv"), toCsv(artworks, [
  "id",
  "accession_number",
  "title",
  "department",
  "collection",
  "type",
  "creation_date",
  "creation_date_earliest",
  "creation_date_latest",
  "accession_year",
  "culture",
  "technique",
  "share_license_status",
  "has_image",
  "url",
]));
await writeText(path.join(processedDir, "department-counts.csv"), toCsv(departmentCounts, ["value", "count", "share"]));
await writeText(path.join(processedDir, "collection-counts.csv"), toCsv(collectionCounts, ["value", "count", "share"]));
await writeText(path.join(processedDir, "type-counts.csv"), toCsv(typeCounts, ["value", "count", "share"]));
await writeText(path.join(processedDir, "culture-counts.csv"), toCsv(cultureCounts, ["value", "count", "share"]));
await writeText(path.join(processedDir, "creation-century-counts.csv"), toCsv(creationCenturyCounts, ["value", "count", "share"]));
await writeText(path.join(processedDir, "acquisition-decade-counts.csv"), toCsv(acquisitionDecadeCounts, ["value", "count", "share"]));
await writeJson(path.join(reportsDir, "result.json"), result);
await writeText(path.join(reportsDir, "report.html"), buildHtml(result));
await writeText(path.join(reportsDir, "public-draft.md"), buildPublicDraft(result));
await writeText(path.join(reportsDir, "work.md"), buildWorkLog(result));

console.log(`Built Cleveland collection report for ${artworks.length} artwork records`);

async function latestRun() {
  const root = path.join(experimentDir, "data", "raw", "api");
  const entries = await fs.readdir(root, { withFileTypes: true });
  const latest = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().at(-1);
  if (!latest) throw new Error("No Cleveland API run found");
  const runDir = path.join(root, latest);
  return { runDir, manifest: await readJson(path.join(runDir, "manifest.json")) };
}

function normalizeArtwork(item) {
  const accessionYearValue = accessionYear(item.accession_number);
  return {
    id: item.id,
    accession_number: item.accession_number ?? "",
    title: item.title ?? "",
    department: item.department ?? "unknown",
    collection: item.collection ?? "unknown",
    type: item.type ?? "unknown",
    creation_date: item.creation_date ?? "",
    creation_date_earliest: item.creation_date_earliest ?? "",
    creation_date_latest: item.creation_date_latest ?? "",
    accession_year: accessionYearValue ?? "",
    culture: Array.isArray(item.culture) ? item.culture : [],
    technique: item.technique ?? "",
    share_license_status: item.share_license_status ?? "unknown",
    has_image: Boolean(item.images?.web?.url || item.images?.print?.url),
    url: item.url ?? `https://www.clevelandart.org/art/${item.accession_number ?? ""}`,
  };
}

function accessionYear(value) {
  const match = String(value ?? "").match(/\b(18|19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function topCounts(rows, key, limit) {
  return countBy(rows, (row) => row[key] || "unknown").slice(0, limit);
}

function topArrayCounts(rows, key, limit) {
  const counts = new Map();
  let total = 0;
  for (const row of rows) {
    const values = Array.isArray(row[key]) && row[key].length ? row[key] : ["unknown"];
    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
      total += 1;
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, share: total ? Number((count / total).toFixed(4)) : 0 }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

function countBy(rows, fn) {
  const counts = new Map();
  for (const row of rows) {
    const value = fn(row) || "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, share: rows.length ? Number((count / rows.length).toFixed(4)) : 0 }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

function centuryLabel(year) {
  const value = Number(year);
  if (!Number.isFinite(value)) return "unknown";
  const century = Math.floor((value - 1) / 100) + 1;
  return `${century}th century`;
}

function decadeLabel(year) {
  const value = Number(year);
  if (!Number.isFinite(value)) return "unknown";
  return `${Math.floor(value / 10) * 10}s`;
}

function buildHtml(result) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Cleveland Museum Collection Shape</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; margin: 40px auto; max-width: 1120px; color: #1f2933; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0 28px; }
    th, td { border-bottom: 1px solid #d9e2ec; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f0f4f8; }
    .stat { display: inline-block; border: 1px solid #d9e2ec; padding: 10px 12px; margin: 0 8px 8px 0; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Cleveland Museum Collection Shape</h1>
  <p>${escapeHtml(result.strongestFinding)}</p>
  <p>
    <span class="stat"><strong>${result.sampleRecords}</strong> sampled records</span>
    <span class="stat"><strong>${result.totalAvailable}</strong> total available</span>
    <span class="stat"><strong>${result.sampleShare}</strong> sample share</span>
  </p>
  <h2>Departments</h2>
  <img src="charts/departments.svg" alt="Top departments in the sample" width="980">
  ${table(result.departments.slice(0, 15), ["value", "count", "share"])}
  <h2>Creation Centuries</h2>
  <img src="charts/creation-centuries.svg" alt="Creation century distribution" width="980">
  ${table(result.creationCenturies, ["value", "count", "share"])}
  <h2>Acquisition Decades</h2>
  <img src="charts/acquisition-decades.svg" alt="Accession-year decade proxy" width="980">
  ${table(result.acquisitionDecades.slice(0, 20), ["value", "count", "share"])}
  <h2>Image Availability</h2>
  <img src="charts/image-availability.svg" alt="Image availability in the sample" width="980">
  ${table(result.imageAvailability, ["value", "count", "share"])}
</body>
</html>
`;
}

function table(rows, columns) {
  const header = `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column] ?? "")}</td>`).join("")}</tr>`).join("\n");
  return `<table>${header}${body}</table>`;
}

function buildPublicDraft(result) {
  return [
    "# What A Museum Collection Looks Like When It Becomes Data",
    "",
    "This is a research draft from a bounded Cleveland Museum of Art Open Access API sample.",
    "",
    "## Thesis To Test",
    "",
    "A structured open museum API makes collection shape measurable: departments, object dates, acquisition proxies, cultures, object types, rights, and image availability become inspectable as data.",
    "",
    "## Corpus Note",
    "",
    `The current artifact contains ${result.sampleRecords} sampled artwork records from ${result.totalAvailable} total available API records.`,
    "",
    "## Central Finding",
    "",
    result.strongestFinding,
    "",
    "## Caveats",
    "",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
    "## Next Moves",
    "",
    ...result.nextMoves.map((move) => `- ${move}`),
    "",
  ].join("\n");
}

function buildWorkLog(result) {
  return [
    "# Work Log",
    "",
    `Generated at: ${result.generatedAt}`,
    `Sample records: ${result.sampleRecords}`,
    `Total available: ${result.totalAvailable}`,
    `Raw run dir: ${result.rawRunDir}`,
    "",
    "## Commands",
    "",
    "```bash",
    "node docs/experiments/cleveland-museum-collection-shape/scripts/fetch-artworks.mjs --limit=5000 --page-size=1000",
    "node docs/experiments/cleveland-museum-collection-shape/scripts/build-report.mjs",
    "node docs/experiments/cleveland-museum-collection-shape/scripts/build-charts.mjs",
    "node docs/experiments/cleveland-museum-collection-shape/scripts/check-readiness.mjs",
    "```",
    "",
  ].join("\n");
}
