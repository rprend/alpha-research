import path from "node:path";
import {
  ensureDir,
  experimentDir,
  extractTitle,
  readJson,
  slug,
  today,
  writeJson,
  writeText,
} from "./lib.mjs";

const runDate = today();
const pages = await readJson(path.join(experimentDir, "config", "institutions.json"));
const outDir = path.join(experimentDir, "data", "raw", "current-pages", runDate);
const manifest = {
  runDate,
  startedAt: new Date().toISOString(),
  source: "current university about/mission pages",
  requests: [],
  errors: [],
};

await ensureDir(outDir);

for (const page of pages) {
  const pageDir = path.join(outDir, slug(page.institution));
  const responsePath = path.join(pageDir, "index.html");
  await ensureDir(pageDir);
  let response;
  let body = "";
  try {
    response = await fetch(page.url, {
      headers: {
        "user-agent": "alpha-research-mission-statement-drift/0.1",
        accept: "text/html,application/xhtml+xml",
      },
    });
    body = await response.text();
  } catch (error) {
    manifest.errors.push({ institution: page.institution, url: page.url, error: error.message });
    manifest.requests.push({ ...page, status: "fetch-error", responsePath: path.relative(experimentDir, responsePath) });
    continue;
  }

  manifest.requests.push({
    ...page,
    status: response.status,
    responsePath: path.relative(experimentDir, responsePath),
  });

  if (!response.ok) {
    manifest.errors.push({ institution: page.institution, url: page.url, status: response.status, body: body.slice(0, 1000) });
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
}

manifest.finishedAt = new Date().toISOString();
manifest.recordCount = manifest.requests.filter((request) => Number(request.status) >= 200 && Number(request.status) < 300).length;
await writeJson(path.join(outDir, "manifest.json"), manifest);

console.log(`Fetched ${manifest.recordCount} current university pages into ${path.relative(process.cwd(), outDir)}`);
