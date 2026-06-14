import path from "node:path";
import {
  appendText,
  auditsDir,
  cleanHtml,
  loadRegistry,
  processedDir,
  rawDir,
  readJsonl,
  relative,
  writeJson,
  writeJsonl,
  writeText,
} from "./kb-lib.mjs";

const sourceId = "library-of-congress";
const runDate = new Date().toISOString().slice(0, 10);
const runId = `loc-undated-enrichment-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const limit = Number.parseInt(getArg("--limit") ?? "0", 10);
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "30000", 10);
const sourceDir = path.join(rawDir, sourceId, runDate, runId);

const registry = await loadRegistry();
const source = registry.sources.find((entry) => entry.source_id === sourceId);
if (!source) throw new Error(`${sourceId} is missing from source-registry.json`);

const sourceDocumentsPath = path.join(processedDir, "source_documents.jsonl");
const objectsPath = path.join(processedDir, "objects.jsonl");
const sourceDocuments = await readJsonl(sourceDocumentsPath);
const objects = await readJsonl(objectsPath);

const candidates = sourceDocuments
  .filter((row) => row.source_id === sourceId)
  .filter((row) => row.content_date_precision === "none" || !row.date)
  .filter((row) => row.source_url && /^https?:\/\/(www\.)?loc\.gov\//.test(row.source_url));
const selected = limit > 0 ? candidates.slice(0, limit) : candidates;
const objectByLocalId = new Map(objects.map((row) => [row.local_id, row]));

const startedAt = new Date().toISOString();
const rawOutputs = [];
const failures = [];
const enriched = [];

for (const [index, row] of selected.entries()) {
  const route = withJsonFormat(row.source_url);
  const rawPath = path.join(sourceDir, `loc-detail-${String(index + 1).padStart(4, "0")}-${slugish(row.source_native_id || row.title)}.json`);
  try {
    const payload = await fetchJson(route);
    await writeJson(rawPath, payload);
    rawOutputs.push(relative(rawPath));
    const normalized = normalizeLocPayload(payload, row);
    if (!hasUsefulUpdate(row, normalized)) {
      failures.push({ local_id: row.local_id, route, error: "No richer date or descriptive metadata found in LOC detail JSON." });
      continue;
    }
    enriched.push({ previous: row, next: mergeRecord(row, normalized), raw_path: relative(rawPath) });
  } catch (error) {
    failures.push({ local_id: row.local_id, route, error: error.message });
  }
  if ((index + 1) % 10 === 0) await new Promise((resolve) => setTimeout(resolve, 250));
}

const enrichedByLocalId = new Map(enriched.map((entry) => [entry.next.local_id, entry.next]));
const updatedSourceDocuments = sourceDocuments.map((row) => enrichedByLocalId.get(row.local_id) ?? row);
const updatedObjects = objects.map((row) => enrichedByLocalId.get(row.local_id) ?? row);
for (const entry of enriched) {
  if (!objectByLocalId.has(entry.next.local_id)) updatedObjects.push(entry.next);
}

await writeJsonl(sourceDocumentsPath, updatedSourceDocuments);
await writeJsonl(objectsPath, updatedObjects);

const manifest = {
  run_id: runId,
  source_id: sourceId,
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  status: failures.length === selected.length && selected.length > 0 ? "failed" : "success",
  access_route: "Library of Congress item/detail JSON via ?fo=json for previously undated local rows",
  selected_count: selected.length,
  enriched_count: enriched.length,
  failed_count: failures.length,
  raw_outputs: rawOutputs,
  processed_outputs: [
    "data/knowledge-base/processed/source_documents.jsonl",
    "data/knowledge-base/processed/objects.jsonl",
  ],
  record_count: enriched.length,
  rights_review: "Registry metadata rights apply; detail JSON is stored as raw metadata and media files are not stored.",
  errors: failures.map((failure) => `${failure.local_id}: ${failure.error}`),
};

await writeJson(path.join(sourceDir, "manifest.json"), manifest);
await writeJson(path.join(auditsDir, "loc-undated-enrichment-last-run.json"), {
  ...manifest,
  generated_at: new Date().toISOString(),
  failures,
  examples: enriched.slice(0, 12).map((entry) => ({
    local_id: entry.next.local_id,
    title: entry.next.title,
    date: entry.next.date ?? "",
    medium: entry.next.medium ?? "",
    raw_path: entry.raw_path,
  })),
});
await writeText(path.join(auditsDir, "loc-undated-enrichment-last-run.md"), renderSummary(manifest, enriched, failures));
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${JSON.stringify(manifest)}\n`);
if (failures.length) await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${failures.map((failure) => JSON.stringify({
  run_id: runId,
  source_id: sourceId,
  completed_at: new Date().toISOString(),
  status: "failed",
  access_route: failure.route,
  local_id: failure.local_id,
  error: failure.error,
})).join("\n")}\n`);

console.log(`LOC undated enrichment ${runId}: ${enriched.length}/${selected.length} records enriched; ${failures.length} failures.`);

function normalizeLocPayload(payload, previous) {
  const item = payload.item ?? payload.content ?? {};
  const nested = item.item ?? {};
  const date = firstText([
    item.date,
    item.dates,
    item.created_published_date,
    item.created_published,
    nested.date,
    nested.dates,
    nested.created_published_date,
    nested.created_published,
  ]);
  const title = firstText([item.title, nested.title, payload.title, previous.title]);
  const description = cleanHtml(firstText([item.description, nested.description, payload.content?.meta_description, previous.description]));
  const medium = firstText([item.medium, item.mediums, item.medium_brief, nested.medium, nested.mediums, nested.medium_brief, previous.medium]);
  const subjects = firstArray([item.subject, item.subject_headings, nested.subjects, nested.subject_headings, payload.subjects, previous.subjects]);
  return {
    local_id: previous.local_id,
    source_id: sourceId,
    source_native_id: previous.source_native_id,
    source_url: previous.source_url,
    title,
    fetched_at: new Date().toISOString(),
    type: previous.type || "loc-item",
    date,
    department: previous.department || "Library of Congress",
    culture: previous.culture || "",
    classification: previous.classification || "",
    medium,
    subjects,
    image_url: previous.image_url || firstText([payload.image_url, item.image_url, nested.image_url]),
    description,
  };
}

function hasUsefulUpdate(previous, normalized) {
  if (!previous.date && normalized.date) return true;
  if (!previous.medium && normalized.medium) return true;
  if ((!previous.subjects || previous.subjects.length === 0) && normalized.subjects?.length) return true;
  if (!previous.description && normalized.description) return true;
  return false;
}

function mergeRecord(previous, normalized) {
  const merged = { ...previous, ...normalized };
  for (const [key, value] of Object.entries(normalized)) {
    if ((value === "" || (Array.isArray(value) && value.length === 0)) && previous[key]) merged[key] = previous[key];
  }
  return merged;
}

function firstText(values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const text = value.map((entry) => typeof entry === "string" ? entry : "").filter(Boolean).join("; ");
      if (text.trim()) return text.trim();
    } else if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function firstArray(values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const flat = value.flatMap((entry) => {
        if (typeof entry === "string") return [entry];
        if (entry && typeof entry === "object") return Object.keys(entry);
        return [];
      }).filter(Boolean);
      if (flat.length) return [...new Set(flat)].slice(0, 30);
    }
  }
  return [];
}

function withJsonFormat(url) {
  const parsed = new URL(url);
  parsed.searchParams.set("fo", "json");
  return parsed.toString();
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
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function renderSummary(manifest, enrichedRows, failuresRows) {
  const lines = [
    "# LOC Undated Enrichment",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Run ID: ${manifest.run_id}`,
    `Status: ${manifest.status}`,
    "",
    `Selected undated rows: ${manifest.selected_count}`,
    `Enriched rows: ${manifest.enriched_count}`,
    `Failed rows: ${manifest.failed_count}`,
    "",
    "This enrichment fetches Library of Congress `?fo=json` detail metadata for existing undated local KB rows and updates records in place. It avoids LOC API record creation timestamps as content dates.",
    "",
    "## Examples",
    "",
    "| Local ID | Title | Date | Medium |",
    "| --- | --- | --- | --- |",
    ...enrichedRows.slice(0, 12).map((entry) => `| ${escapeMd(entry.next.local_id)} | ${escapeMd(entry.next.title)} | ${escapeMd(entry.next.date ?? "")} | ${escapeMd(entry.next.medium ?? "")} |`),
    "",
  ];
  if (failuresRows.length) {
    lines.push("## Failures", "", "| Local ID | Error |", "| --- | --- |");
    lines.push(...failuresRows.slice(0, 50).map((failure) => `| ${escapeMd(failure.local_id)} | ${escapeMd(failure.error)} |`));
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function escapeMd(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function slugish(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}
