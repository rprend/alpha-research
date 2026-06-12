import path from "node:path";
import {
  ensureDir,
  experimentDir,
  readJson,
  slug,
  today,
  writeJson,
  writeText,
} from "./lib.mjs";

const args = parseArgs();
const years = String(args.years ?? "2000,2005,2010,2015,2020")
  .split(",")
  .map((year) => Number(year.trim()))
  .filter(Boolean);
const timeoutMs = Number(args.timeout ?? 12000);
const limitPerInstitution = Number(args["limit-per-institution"] ?? 6);
const institutionLimit = Number(args.institutions ?? institutions.length);
const seedLimit = Number(args["seed-limit"] ?? 6);
const patterns = ["*mission*", "*about*", "*vision*", "*values*", "*history*", "*strategic*", "*plan*"];
const runDate = today();
const institutions = await readJson(path.join(experimentDir, "config", "institutions.json"));
const historicalPathPatterns = await readJson(path.join(experimentDir, "config", "historical-path-patterns.json"));
const outDir = path.join(experimentDir, "data", "raw", "wayback-discovery", runDate);
const candidates = [];
const manifest = {
  runDate,
  years,
  source: "Internet Archive CDX wildcard URL discovery",
  startedAt: new Date().toISOString(),
  requests: [],
  errors: [],
};

await ensureDir(outDir);

for (const institution of institutions.slice(0, institutionLimit)) {
  const base = new URL(institution.url);
  const host = base.hostname.replace(/^www\./, "");
  const discovered = new Map();

  for (const year of years) {
    for (const candidateUrl of seededUrls(base, historicalPathPatterns).slice(0, seedLimit)) {
      const row = await closestSnapshot(candidateUrl, year);
      if (!row) continue;
      const score = scoreUrl(candidateUrl) + 3;
      const key = canonicalUrl(candidateUrl);
      const current = discovered.get(key);
      if (!current || score > current.score) {
        discovered.set(key, {
          institution: institution.institution,
          url: key,
          discovery_host: host,
          year,
          timestamp: row.timestamp,
          score,
          reason: `seeded; ${reasonForUrl(key)}`,
        });
      }
    }
    for (const pattern of patterns.slice(0, Number(args["pattern-limit"] ?? 3))) {
      const rows = await cdxRows(`${host}/${pattern}`, year);
      for (const row of rows) {
        const score = scoreUrl(row.original);
        if (score <= 0) continue;
        const key = canonicalUrl(row.original);
        const current = discovered.get(key);
        if (!current || score > current.score) {
          discovered.set(key, {
            institution: institution.institution,
            url: key,
            discovery_host: host,
            year,
            timestamp: row.timestamp,
            score,
            reason: reasonForUrl(key),
          });
        }
      }
    }
  }

  candidates.push(
    ...[...discovered.values()]
      .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
      .slice(0, limitPerInstitution),
  );
}

async function closestSnapshot(candidateUrl, year) {
  const cdx = new URL("https://web.archive.org/cdx");
  cdx.searchParams.set("url", candidateUrl);
  cdx.searchParams.set("from", `${year}0101`);
  cdx.searchParams.set("to", `${year}1231`);
  cdx.searchParams.set("output", "json");
  cdx.searchParams.set("fl", "timestamp,original,statuscode,mimetype,digest");
  cdx.searchParams.set("filter", "statuscode:200");
  cdx.searchParams.set("collapse", "digest");
  cdx.searchParams.set("limit", "10");
  try {
    const response = await fetch(cdx, {
      headers: { "user-agent": "alpha-research-mission-statement-drift/0.1" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    manifest.requests.push({ url: cdx.toString(), year, mode: "seeded", status: response.status });
    if (!response.ok) {
      manifest.errors.push({ url: cdx.toString(), year, mode: "seeded", status: response.status, body: (await response.text()).slice(0, 1000) });
      return null;
    }
    const json = await response.json();
    const rows = (Array.isArray(json) ? json.slice(1) : [])
      .map(([timestamp, original, statuscode, mimetype, digest]) => ({ timestamp, original, statuscode, mimetype, digest }))
      .filter((row) => /html/i.test(row.mimetype ?? ""));
    if (!rows.length) return null;
    const target = Number(`${year}0701000000`);
    return rows.sort((a, b) => Math.abs(Number(a.timestamp) - target) - Math.abs(Number(b.timestamp) - target))[0];
  } catch (error) {
    manifest.requests.push({ url: cdx.toString(), year, mode: "seeded", status: "fetch-error" });
    manifest.errors.push({ url: cdx.toString(), year, mode: "seeded", error: error.message });
    return null;
  }
}

function seededUrls(base, paths) {
  const hosts = [...new Set([base.hostname, base.hostname.replace(/^www\./, ""), `www.${base.hostname.replace(/^www\./, "")}`])];
  const schemes = ["https:", "http:"];
  const urls = [];
  for (const scheme of schemes) {
    for (const host of hosts) {
      for (const pathPart of paths) {
        urls.push(`${scheme}//${host}${pathPart}`);
      }
    }
  }
  return [...new Set(urls)];
}

manifest.finishedAt = new Date().toISOString();
manifest.recordCount = candidates.length;
await writeJson(path.join(outDir, "manifest.json"), manifest);
await writeJson(path.join(experimentDir, "config", "wayback-discovered-targets.json"), candidates.map(({ institution, url, reason }) => ({ institution, url, reason })));
await writeText(
  path.join(outDir, "candidates.csv"),
  [
    "institution,url,score,reason,year,timestamp",
    ...candidates.map((candidate) => [
      csv(candidate.institution),
      csv(candidate.url),
      candidate.score,
      csv(candidate.reason),
      candidate.year,
      candidate.timestamp,
    ].join(",")),
  ].join("\n") + "\n",
);

console.log(`Discovered ${candidates.length} Wayback target candidates into ${path.relative(process.cwd(), outDir)}`);

async function cdxRows(urlPattern, year) {
  const cdx = new URL("https://web.archive.org/cdx");
  cdx.searchParams.set("url", urlPattern);
  cdx.searchParams.set("from", `${year}0101`);
  cdx.searchParams.set("to", `${year}1231`);
  cdx.searchParams.set("output", "json");
  cdx.searchParams.set("fl", "timestamp,original,statuscode,mimetype,digest");
  cdx.searchParams.set("filter", "statuscode:200");
  cdx.searchParams.set("collapse", "urlkey");
  cdx.searchParams.set("limit", "80");
  try {
    const response = await fetch(cdx, {
      headers: { "user-agent": "alpha-research-mission-statement-drift/0.1" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    manifest.requests.push({ url: cdx.toString(), year, status: response.status });
    if (!response.ok) {
      manifest.errors.push({ url: cdx.toString(), year, status: response.status, body: (await response.text()).slice(0, 1000) });
      return [];
    }
    const json = await response.json();
    return (Array.isArray(json) ? json.slice(1) : [])
      .map(([timestamp, original, statuscode, mimetype, digest]) => ({ timestamp, original, statuscode, mimetype, digest }))
      .filter((row) => /html/i.test(row.mimetype ?? ""));
  } catch (error) {
    manifest.requests.push({ url: cdx.toString(), year, status: "fetch-error" });
    manifest.errors.push({ url: cdx.toString(), year, error: error.message });
    return [];
  }
}

function scoreUrl(url) {
  const lower = url.toLowerCase();
  let score = 0;
  if (/\/about(\/|$|-|_)/.test(lower)) score += 5;
  if (/mission/.test(lower)) score += 8;
  if (/vision/.test(lower)) score += 5;
  if (/values?/.test(lower)) score += 5;
  if (/history/.test(lower)) score += 3;
  if (/strategic|plan|priorit/.test(lower)) score += 4;
  if (/president|provost/.test(lower)) score += 2;
  if (/admission|apply|athletic|calendar|event|news|giving|donor|alumni|directory|login|search|privacy|policy|wp-content|\.pdf|\/21c\/|muttigrees|campaign|magazine|newsletter|store|shop/.test(lower)) score -= 8;
  if (lower.length > 120) score -= 2;
  return score;
}

function reasonForUrl(url) {
  const lower = url.toLowerCase();
  const reasons = [];
  for (const term of ["about", "mission", "vision", "values", "history", "strategic", "plan", "president", "provost"]) {
    if (lower.includes(term)) reasons.push(term);
  }
  return reasons.join("; ");
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}
