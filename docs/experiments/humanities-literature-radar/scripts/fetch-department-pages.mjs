import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureDir,
  experimentDir,
  parseArgs,
  readJson,
  today,
  writeJson,
  writeManifest,
  writeText,
} from "./lib.mjs";

const args = parseArgs();
const runDate = args["run-date"] ?? today();
const limit = Number(args.limit ?? 25);
const source = "department-pages";
const startedAt = new Date().toISOString();
const configPath = path.join(experimentDir, "config", "department-pages.json");
const pages = (await readJson(configPath)).slice(0, limit);
const outDir = path.join(experimentDir, "data", "raw", source, runDate);
const requests = [];
const errors = [];
let recordCount = 0;

await ensureDir(outDir);

for (const page of pages) {
  const institutionSlug = slug(page.institution);
  const departmentSlug = slug(page.department);
  const pageDir = path.join(outDir, institutionSlug, departmentSlug);
  await ensureDir(pageDir);

  let response;
  let body = "";
  const responsePath = path.join(pageDir, "index.html");
  try {
    response = await fetch(page.url, {
      headers: {
        "user-agent": "alpha-research-humanities-radar/0.1",
        accept: "text/html,application/xhtml+xml",
      },
    });
    body = await response.text();
  } catch (error) {
    errors.push({ url: page.url, error: error.message });
    requests.push({ ...page, status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
    continue;
  }

  requests.push({
    ...page,
    status: response.status,
    responsePath: path.relative(experimentDir, responsePath),
  });

  if (!response.ok) {
    errors.push({ url: page.url, status: response.status, body: body.slice(0, 1000) });
    continue;
  }

  await writeText(responsePath, body);
  await writeJson(path.join(pageDir, "metadata.json"), {
    ...page,
    fetchedAt: new Date().toISOString(),
    status: response.status,
    bytes: Buffer.byteLength(body),
    title: extractTitle(body),
  });
  recordCount += 1;
}

await writeManifest({
  source,
  runDate,
  startedAt,
  finishedAt: new Date().toISOString(),
  requests,
  recordCount,
  errors,
});

await fs.writeFile(
  path.join(outDir, "crawl-notes.md"),
  [
    "# Department Page Crawl Notes",
    "",
    "This crawl stores public HTML snapshots for coverage and enrichment only.",
    "Department-derived records must be labeled separately from bibliographic index records.",
    "",
    `Fetched pages: ${recordCount}`,
    `Errors: ${errors.length}`,
    "",
  ].join("\n"),
);

console.log(`Fetched ${recordCount} department pages into ${path.relative(process.cwd(), outDir)}`);

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}
