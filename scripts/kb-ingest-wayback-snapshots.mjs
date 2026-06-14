import path from "node:path";
import {
  appendText,
  auditsDir,
  kbDir,
  loadRegistry,
  processedDir,
  rawDir,
  readJson,
  readJsonl,
  relative,
  slug,
  writeJson,
  writeJsonl,
} from "./kb-lib.mjs";

const targetConfig = await readJson(path.join(kbDir, "config", "department-pages.json"));
const registry = await loadRegistry();
const source = registry.sources.find((entry) => entry.source_id === "wayback-machine-cdx") ?? {};
const runDate = new Date().toISOString().slice(0, 10);
const runId = `wayback-snapshots-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const perTarget = Number.parseInt(getArg("--per-target") ?? "5", 10);
const limit = Number.parseInt(getArg("--limit") ?? String(targetConfig.targets.length), 10);
const fromYear = getArg("--from") ?? "2020";
const toYear = getArg("--to") ?? new Date().getUTCFullYear().toString();
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "30000", 10);

const sourceDocuments = (await readJsonl(path.join(processedDir, "source_documents.jsonl")))
  .filter((row) => row.source_id !== "wayback-machine-cdx");
const rights = (await readJsonl(path.join(processedDir, "rights.jsonl")))
  .filter((row) => row.source_id !== "wayback-machine-cdx");
const runRecords = [];
const snapshotRows = [];

for (const target of targetConfig.targets.slice(0, limit)) {
  const started = new Date().toISOString();
  const queryUrl = waybackQueryFor(target.url);
  const route = `https://web.archive.org/cdx?url=${encodeURIComponent(queryUrl)}&from=${fromYear}&to=${toYear}&collapse=urlkey&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=${perTarget}`;
  const rawDirForTarget = path.join(rawDir, "wayback-machine-cdx", runDate, runId, slug(`${target.school}-${target.department}-${target.page_type}`));
  const rawPath = path.join(rawDirForTarget, "response.json");
  try {
    const payload = await fetchJson(route);
    await writeJson(rawPath, payload);
    const rows = normalizeWaybackRows(payload, target, route);
    snapshotRows.push(...rows);
    sourceDocuments.push(...rows);
    rights.push(...rows.map((row) => rightsRow(row)));
    const record = manifestRecord({
      target,
      started,
      route,
      rawPath,
      status: rows.length ? "success" : "empty",
      recordCount: rows.length,
      errors: rows.length ? [] : ["CDX returned no matching captures."],
    });
    runRecords.push(record);
    await writeJson(path.join(rawDirForTarget, "manifest.json"), record);
  } catch (error) {
    const record = manifestRecord({
      target,
      started,
      route,
      rawPath: null,
      status: "failed",
      recordCount: 0,
      errors: [error.message],
    });
    runRecords.push(record);
    await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${JSON.stringify(record)}\n`);
  }
}

await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${runRecords.map((record) => JSON.stringify(record)).join("\n")}\n`);

const report = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  target_count: Math.min(limit, targetConfig.targets.length),
  success_count: runRecords.filter((record) => record.status === "success").length,
  empty_count: runRecords.filter((record) => record.status === "empty").length,
  failed_count: runRecords.filter((record) => record.status === "failed").length,
  snapshot_count: snapshotRows.length,
  from_year: fromYear,
  to_year: toYear,
  per_target: perTarget,
  records: runRecords,
};
await writeJson(path.join(auditsDir, "wayback-snapshots-last-run.json"), report);

console.log(`KB Wayback snapshot ingest ${runId}: ${report.snapshot_count} snapshots across ${report.success_count}/${report.target_count} targets.`);

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function waybackQueryFor(value) {
  const url = new URL(value);
  const pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return `${url.hostname}${pathname}*`;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "alpha-research-local-humanities-kb/0.1 mailto:research@alpharesearch.nyc",
        accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return JSON.parse(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWaybackRows(payload, target, route) {
  const rows = Array.isArray(payload) ? payload.slice(1) : [];
  return rows.filter((row) => matchesTargetUrl(row[1], target.url)).map((row) => {
    const [timestamp, original, statuscode, mimetype, digest] = row;
    const archiveUrl = `https://web.archive.org/web/${timestamp}/${original}`;
    return {
      local_id: `wayback-machine-cdx:${slug(`${target.school}-${target.department}-${target.page_type}-${timestamp}-${original}`)}`,
      source_id: "wayback-machine-cdx",
      source_native_id: `${timestamp}:${original}`,
      source_url: archiveUrl,
      title: `${target.school} ${target.department} ${target.page_type} snapshot ${timestamp}`,
      fetched_at: new Date().toISOString(),
      type: "web-archive-cdx",
      publication_year: timestamp.slice(0, 4),
      venue: "Internet Archive Wayback Machine",
      department: target.department,
      description: `Archived capture metadata for ${original}; school=${target.school}; page_type=${target.page_type}; status=${statuscode}; mimetype=${mimetype}; digest=${digest}; cdx_route=${route}`,
      text_path: "",
      text_chars: "",
    };
  });
}

function matchesTargetUrl(original, targetUrl) {
  try {
    const originalUrl = new URL(original);
    const target = new URL(targetUrl);
    const originalPath = originalUrl.pathname.replace(/\/+$/, "/");
    const targetPath = target.pathname.replace(/\/+$/, "/");
    return originalUrl.hostname === target.hostname && originalPath === targetPath && originalUrl.search === target.search;
  } catch {
    return false;
  }
}

function rightsRow(row) {
  return {
    local_id: row.local_id,
    source_id: "wayback-machine-cdx",
    license: source.license ?? "Internet Archive CDX metadata; underlying page rights vary",
    redistribution_status: source.redistribution_status ?? "metadata-only",
    full_text_allowed: false,
    metadata_allowed: true,
    quote_status: "metadata-only-no-quotes",
    rights_note: "CDX capture metadata only; archived page text is not stored or redistributed.",
  };
}

function manifestRecord({ target, started, route, rawPath, status, recordCount, errors }) {
  return {
    run_id: runId,
    source_id: "wayback-machine-cdx",
    started_at: started,
    completed_at: new Date().toISOString(),
    status,
    access_route: route,
    target_source_id: target.source_id,
    target_school: target.school,
    target_department: target.department,
    target_page_type: target.page_type,
    raw_outputs: rawPath ? [relative(rawPath)] : [],
    processed_outputs: recordCount ? [
      "data/knowledge-base/processed/source_documents.jsonl",
      "data/knowledge-base/processed/rights.jsonl",
    ] : [],
    record_count: recordCount,
    rights_review: "Wayback CDX metadata only; archived page text not stored.",
    errors,
  };
}

function dedupe(rows, key) {
  const byKey = new Map();
  for (const row of rows) byKey.set(row[key], row);
  return Array.from(byKey.values());
}
