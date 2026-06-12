import fs from "node:fs/promises";
import path from "node:path";
import {
  cleanHtml,
  ensureDir,
  experimentDir,
  extractTitle,
  readJson,
  slug,
  today,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const runDate = today();
const sources = await readJson(path.join(experimentDir, "config", "second-layer-sources.json"));
const rawDir = path.join(experimentDir, "data", "raw", "second-layer-sources", runDate);
const reportsDir = path.join(experimentDir, "reports");
const minWords = Number(process.env.MISSION_DRIFT_SECOND_LAYER_MIN_WORDS ?? 80);
const manifest = {
  runDate,
  startedAt: new Date().toISOString(),
  source: "university institutional-language second-layer source probe",
  minWords,
  requests: [],
  errors: [],
};

await fs.rm(rawDir, { recursive: true, force: true });
await ensureDir(rawDir);

for (const source of sources) {
  const pageDir = path.join(rawDir, source.source_genre, slug(source.institution));
  const responsePath = path.join(pageDir, "index.html");
  await ensureDir(pageDir);
  let response;
  let body = "";
  try {
    response = await fetch(source.url, {
      headers: {
        "user-agent": "alpha-research-university-second-layer-probe/0.1",
        accept: "text/html,application/xhtml+xml",
      },
    });
    body = await response.text();
  } catch (error) {
    const row = {
      ...source,
      status: "fetch-error",
      error: error.message,
      responsePath: path.relative(experimentDir, responsePath),
    };
    manifest.requests.push(row);
    manifest.errors.push(row);
    continue;
  }

  const cleanText = cleanHtml(body);
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  const baseRow = {
    ...source,
    status: response.status,
    ok: response.ok,
    wordCount,
    title: extractTitle(body),
    responsePath: path.relative(experimentDir, responsePath),
  };

  if (!response.ok) {
    const row = {
      ...baseRow,
      error: `HTTP ${response.status}`,
      bodyPreview: body.slice(0, 500),
    };
    manifest.requests.push(row);
    manifest.errors.push(row);
    continue;
  }

  if (wordCount < minWords) {
    const row = {
      ...baseRow,
      status: "quality-failed",
      error: "Fetched page did not meet minimum readable word count",
    };
    manifest.requests.push(row);
    manifest.errors.push(row);
    continue;
  }

  await writeText(responsePath, body);
  await writeJson(path.join(pageDir, "metadata.json"), {
    ...baseRow,
    fetchedAt: new Date().toISOString(),
    bytes: Buffer.byteLength(body),
  });
  manifest.requests.push(baseRow);
}

manifest.finishedAt = new Date().toISOString();
manifest.recordCount = manifest.requests.filter((request) => request.ok === true).length;
manifest.genreCounts = countBy(manifest.requests.filter((request) => request.ok === true), "source_genre");
manifest.institutionCounts = countBy(manifest.requests.filter((request) => request.ok === true), "institution");

await writeJson(path.join(rawDir, "manifest.json"), manifest);
await writeJson(path.join(reportsDir, "second-layer-source-inventory.json"), {
  generatedAt: manifest.finishedAt,
  runDate,
  configuredSources: sources.length,
  accessibleSources: manifest.recordCount,
  errorCount: manifest.errors.length,
  genreCounts: manifest.genreCounts,
  rows: manifest.requests.map((request) => ({
    institution: request.institution,
    source_genre: request.source_genre,
    source_layer: request.source_layer,
    status: request.status,
    ok: request.ok === true,
    wordCount: request.wordCount ?? 0,
    title: request.title ?? "",
    url: request.url,
    responsePath: request.responsePath,
    error: request.error ?? "",
  })),
});
await writeText(path.join(reportsDir, "second-layer-source-inventory.csv"), toCsv(manifest.requests.map((request) => ({
  institution: request.institution,
  source_genre: request.source_genre,
  source_layer: request.source_layer,
  status: request.status,
  ok: request.ok === true,
  wordCount: request.wordCount ?? 0,
  title: request.title ?? "",
  url: request.url,
  responsePath: request.responsePath,
  error: request.error ?? "",
})), ["institution", "source_genre", "source_layer", "status", "ok", "wordCount", "title", "url", "responsePath", "error"]));
await writeText(path.join(reportsDir, "second-layer-source-inventory.md"), buildMarkdown(manifest));

console.log(`Probed ${manifest.recordCount}/${sources.length} university second-layer sources into ${path.relative(process.cwd(), rawDir)}`);
if (process.argv.includes("--strict") && manifest.recordCount === 0) {
  process.exit(1);
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function buildMarkdown(manifest) {
  const rows = manifest.requests.map((request) => `| ${request.institution} | ${request.source_genre} | ${request.status} | ${request.wordCount ?? 0} | ${request.url} |`);
  return [
    "# University Second-Layer Source Inventory",
    "",
    `Generated at: ${manifest.finishedAt}`,
    `Run date: ${manifest.runDate}`,
    `Accessible sources: ${manifest.recordCount}/${manifest.requests.length}`,
    "",
    "## Genre Counts",
    "",
    ...Object.entries(manifest.genreCounts).map(([genre, count]) => `- ${genre}: ${count}`),
    "",
    "| Institution | Genre | Status | Words | URL |",
    "| --- | --- | --- | ---: | --- |",
    ...rows,
    "",
    "## Notes",
    "",
    "- This is a source-route probe, not the second-layer corpus itself.",
    "- Catalogs, strategic plans, president-message pages, and commencement speeches must remain separate source genres in downstream analysis.",
    "- Any failed or low-word-count route in future runs should be replaced before publication-scale claims.",
    "",
  ].join("\n");
}
