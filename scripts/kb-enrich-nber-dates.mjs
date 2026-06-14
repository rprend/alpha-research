import path from "node:path";
import {
  appendText,
  auditsDir,
  processedDir,
  rawDir,
  readJsonl,
  relative,
  writeJson,
  writeJsonl,
  writeText,
} from "./kb-lib.mjs";

const runDate = new Date().toISOString().slice(0, 10);
const runId = `nber-date-enrichment-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const limit = Number.parseInt(getArg("--limit") ?? "100", 10);
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "20000", 10);
const sourceId = "nber-culture-history";
const sourceDir = path.join(rawDir, sourceId, runDate, runId);

const sourceDocumentsPath = path.join(processedDir, "source_documents.jsonl");
const worksPath = path.join(processedDir, "works.jsonl");
const sourceDocuments = await readJsonl(sourceDocumentsPath);
const works = await readJsonl(worksPath);
const workById = new Map(works.map((row) => [row.local_id, row]));

const candidates = sourceDocuments
  .filter((row) => row.source_id === sourceId && row.type === "working-paper")
  .filter((row) => !hasContentYear(row.publication_year))
  .filter((row) => /\/papers\/w\d+/i.test(String(row.source_url ?? "")))
  .slice(0, limit);

const enriched = [];
const failed = [];

for (const [index, row] of candidates.entries()) {
  const rawPath = path.join(sourceDir, `paper-${String(index + 1).padStart(3, "0")}.html`);
  try {
    const html = await fetchText(row.source_url);
    await writeText(rawPath, html);
    const metadata = extractNberDateMetadata(html);
    if (!metadata.publication_year) {
      failed.push({
        local_id: row.local_id,
        source_url: row.source_url,
        raw_path: relative(rawPath),
        error: "No citation_publication_date or display date found on NBER page.",
      });
      continue;
    }
    row.publication_year = metadata.publication_year;
    row.publication_date = metadata.publication_date;
    row.content_date_source = metadata.source;
    row.date_enriched_at = new Date().toISOString();
    row.raw_date_enrichment_path = relative(rawPath);

    const work = workById.get(row.local_id);
    if (work) {
      work.publication_year = metadata.publication_year;
      work.publication_date = metadata.publication_date;
      work.content_date_source = metadata.source;
      work.date_enriched_at = row.date_enriched_at;
      work.raw_date_enrichment_path = row.raw_date_enrichment_path;
    }

    enriched.push({
      local_id: row.local_id,
      source_url: row.source_url,
      publication_year: metadata.publication_year,
      publication_date: metadata.publication_date,
      source: metadata.source,
      raw_path: relative(rawPath),
    });
  } catch (error) {
    failed.push({
      local_id: row.local_id,
      source_url: row.source_url,
      error: error.message,
    });
  }
}

await writeJsonl(sourceDocumentsPath, sourceDocuments);
await writeJsonl(worksPath, works);

const manifest = {
  run_id: runId,
  source_id: sourceId,
  source_route: "NBER working paper HTML citation metadata",
  generated_at: new Date().toISOString(),
  candidate_count: candidates.length,
  enriched_count: enriched.length,
  failed_count: failed.length,
  raw_dir: relative(sourceDir),
  outputs: [
    "data/knowledge-base/processed/source_documents.jsonl",
    "data/knowledge-base/processed/works.jsonl",
    "data/knowledge-base/audits/nber-date-enrichment-last-run.json",
    "data/knowledge-base/audits/nber-date-enrichment-last-run.md",
  ],
  enriched,
  failed,
};

await writeJson(path.join(sourceDir, "manifest.json"), manifest);
await writeJson(path.join(auditsDir, "nber-date-enrichment-last-run.json"), manifest);
await writeText(path.join(auditsDir, "nber-date-enrichment-last-run.md"), renderMarkdown(manifest));
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${JSON.stringify({
  run_id: runId,
  source_id: sourceId,
  source_route: "NBER working paper HTML citation metadata",
  started_at: manifest.generated_at,
  completed_at: manifest.generated_at,
  status: failed.length ? "partial-success" : "success",
  records: enriched.length,
  raw_dir: relative(sourceDir),
  outputs: manifest.outputs,
})}\n`);

console.log(`NBER date enrichment ${runId}: enriched ${enriched.length}/${candidates.length} candidates.`);
if (failed.length) console.log(`NBER date enrichment failures: ${failed.length}`);

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "alpha-research-local-humanities-kb/0.1 mailto:research@alpharesearch.nyc",
        accept: "text/html",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractNberDateMetadata(html) {
  const citationDate = metaContent(html, "citation_publication_date");
  const displayDate = matchText(html, /(?:displaydate|display_date)["']?\s*[:=]\s*["']([^"']+)/i);
  const candidate = citationDate || displayDate;
  const publicationYear = String(candidate ?? "").match(/\b(18|19|20)\d{2}\b/)?.[0] ?? "";
  return {
    publication_date: normalizeDate(candidate),
    publication_year: publicationYear,
    source: citationDate ? "meta:citation_publication_date" : displayDate ? "html:displaydate" : "",
  };
}

function metaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return matchText(html, pattern);
}

function matchText(text, pattern) {
  const match = String(text).match(pattern);
  return match ? decodeHtml(match[1]).trim() : "";
}

function normalizeDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const slashDate = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashDate) {
    return `${slashDate[1]}-${slashDate[2].padStart(2, "0")}-${slashDate[3].padStart(2, "0")}`;
  }
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2].padStart(2, "0")}-${isoDate[3].padStart(2, "0")}`;
  }
  return text;
}

function hasContentYear(value) {
  return /\b(18|19|20)\d{2}\b/.test(String(value ?? ""));
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function renderMarkdown(manifest) {
  return [
    "# NBER Date Enrichment",
    "",
    `Generated at: ${manifest.generated_at}`,
    `Run ID: ${manifest.run_id}`,
    `Candidates: ${manifest.candidate_count}`,
    `Enriched: ${manifest.enriched_count}`,
    `Failed: ${manifest.failed_count}`,
    "",
    "## Enriched Records",
    "",
    ...(manifest.enriched.length
      ? manifest.enriched.map((row) => `- ${row.local_id}: ${row.publication_date || row.publication_year} (${row.source})`)
      : ["No records enriched."]),
    "",
    "## Failures",
    "",
    ...(manifest.failed.length
      ? manifest.failed.map((row) => `- ${row.local_id}: ${row.error}`)
      : ["No failures."]),
    "",
  ].join("\n");
}
