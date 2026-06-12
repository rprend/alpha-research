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
  writeJson,
  writeText,
} from "./lib.mjs";

const runDate = process.env.MUSEUM_LANGUAGE_RUN_DATE ?? today();
const pages = await readJson(path.join(experimentDir, "config", "museums.json"));
const outDir = path.join(experimentDir, "data", "raw", "current-pages", runDate);
const minWords = Number(process.env.MUSEUM_LANGUAGE_MIN_WORDS ?? 60);
const manifest = {
  runDate,
  startedAt: new Date().toISOString(),
  source: "current public museum pages",
  requests: [],
  errors: [],
};

await fs.rm(outDir, { recursive: true, force: true });
await ensureDir(outDir);

for (const page of pages) {
  const pageDir = path.join(outDir, slug(`${page.museum}-${page.pageType}`));
  const responsePath = path.join(pageDir, "index.html");
  await ensureDir(pageDir);

  let response;
  let body = "";
  try {
    response = await fetch(page.url, {
      headers: {
        "user-agent": "alpha-research-museum-language-drift/0.1",
        accept: "text/html,application/xhtml+xml",
      },
    });
    body = await response.text();
  } catch (error) {
    manifest.errors.push({ museum: page.museum, pageType: page.pageType, url: page.url, error: error.message });
    manifest.requests.push({ ...page, status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
    continue;
  }

  if (!response.ok) {
    manifest.errors.push({ museum: page.museum, pageType: page.pageType, url: page.url, status: response.status, body: body.slice(0, 1000) });
    manifest.requests.push({
      ...page,
      status: "http-error",
      httpStatus: response.status,
      responsePath: path.relative(experimentDir, responsePath),
    });
    continue;
  }

  const cleanText = cleanHtml(body);
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  if (wordCount < minWords) {
    manifest.errors.push({ museum: page.museum, pageType: page.pageType, url: page.url, status: response.status, wordCount, error: "Fetched page did not meet minimum readable word count" });
    manifest.requests.push({
      ...page,
      status: "quality-failed",
      httpStatus: response.status,
      wordCount,
      responsePath: path.relative(experimentDir, responsePath),
    });
    continue;
  }

  await writeText(responsePath, body);
  await writeJson(path.join(pageDir, "metadata.json"), {
    ...page,
    fetchedAt: new Date().toISOString(),
    status: response.status,
    bytes: Buffer.byteLength(body),
    wordCount,
    title: extractTitle(body),
  });
  manifest.requests.push({
    ...page,
    status: response.status,
    wordCount,
    responsePath: path.relative(experimentDir, responsePath),
  });
}

manifest.finishedAt = new Date().toISOString();
manifest.recordCount = manifest.requests.filter((request) => Number(request.status) >= 200 && Number(request.status) < 300).length;
await writeJson(path.join(outDir, "manifest.json"), manifest);

console.log(`Fetched ${manifest.recordCount} current museum pages into ${path.relative(process.cwd(), outDir)}`);
