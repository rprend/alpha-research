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

const sourceId = "met-collection-api";
const runDate = new Date().toISOString().slice(0, 10);
const runId = `met-stub-enrichment-${new Date().toISOString().replace(/[:.]/g, "-")}`;
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

const objectByLocalId = new Map(objects.map((row) => [row.local_id, row]));
const candidates = sourceDocuments
  .filter((row) => row.source_id === sourceId)
  .filter((row) => row.type === "museum-object-stub" || row.content_date_precision === "none")
  .filter((row) => /^\d+$/.test(String(row.source_native_id ?? "")));
const selected = limit > 0 ? candidates.slice(0, limit) : candidates;

const startedAt = new Date().toISOString();
const rawOutputs = [];
const failures = [];
const enriched = [];

for (const [index, row] of selected.entries()) {
  const objectId = String(row.source_native_id);
  const route = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`;
  const rawPath = path.join(sourceDir, `object-${String(index + 1).padStart(4, "0")}-${objectId}.json`);
  try {
    const payload = await fetchJson(route);
    await writeJson(rawPath, payload);
    rawOutputs.push(relative(rawPath));
    const normalized = normalizeMetObject(payload, row.local_id);
    if (!normalized) {
      failures.push({ local_id: row.local_id, object_id: objectId, route, error: "Met API returned no objectID." });
      continue;
    }
    enriched.push({ previous: row, next: mergeRecord(row, normalized), raw_path: relative(rawPath) });
  } catch (error) {
    failures.push({ local_id: row.local_id, object_id: objectId, route, error: error.message });
  }
  if ((index + 1) % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 250));
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
  access_route: "Met public collection object API for previously stubbed local records",
  selected_count: selected.length,
  enriched_count: enriched.length,
  failed_count: failures.length,
  raw_outputs: rawOutputs,
  processed_outputs: [
    "data/knowledge-base/processed/source_documents.jsonl",
    "data/knowledge-base/processed/objects.jsonl",
  ],
  record_count: enriched.length,
  rights_review: "Registry metadata rights apply; image/media URLs are retained as metadata and media files are not stored.",
  errors: failures.map((failure) => `${failure.object_id}: ${failure.error}`),
};

await writeJson(path.join(sourceDir, "manifest.json"), manifest);
await writeJson(path.join(auditsDir, "met-stub-enrichment-last-run.json"), {
  ...manifest,
  generated_at: new Date().toISOString(),
  failures,
  examples: enriched.slice(0, 10).map((entry) => ({
    local_id: entry.next.local_id,
    title_before: entry.previous.title,
    title_after: entry.next.title,
    date: entry.next.date ?? "",
    classification: entry.next.classification ?? "",
    department: entry.next.department ?? "",
    raw_path: entry.raw_path,
  })),
});
await writeTextSummary(manifest, enriched, failures);
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

console.log(`Met stub enrichment ${runId}: ${enriched.length}/${selected.length} records enriched; ${failures.length} failures.`);

function normalizeMetObject(row, localId) {
  if (!row?.objectID) return null;
  return {
    local_id: localId,
    source_id: sourceId,
    source_native_id: String(row.objectID),
    source_url: row.objectURL || `https://www.metmuseum.org/art/collection/search/${row.objectID}`,
    title: row.title || `Met object ${row.objectID}`,
    fetched_at: new Date().toISOString(),
    type: "museum-object",
    date: row.objectDate ?? "",
    creation_date: row.objectDate ?? "",
    department: row.department ?? "",
    culture: row.culture ?? "",
    classification: row.classification ?? "",
    medium: row.medium ?? "",
    artist: (row.constituents ?? []).map((entry) => entry.name).filter(Boolean).join("; "),
    accession_number: row.accessionNumber ?? "",
    accession_year: row.accessionYear ?? "",
    public_domain: row.isPublicDomain ?? "",
    image_url: row.primaryImageSmall || row.primaryImage || "",
    description: cleanHtml([row.objectName, row.period, row.dynasty, row.reign].filter(Boolean).join("; ")),
  };
}

function mergeRecord(previous, normalized) {
  const merged = { ...previous, ...normalized };
  for (const [key, value] of Object.entries(normalized)) {
    if (value === "" && previous[key]) merged[key] = previous[key];
  }
  return merged;
}

async function writeTextSummary(manifest, enrichedRows, failuresRows) {
  const lines = [
    "# Met Stub Enrichment",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Run ID: ${manifest.run_id}`,
    `Status: ${manifest.status}`,
    "",
    `Selected stub/undated rows: ${manifest.selected_count}`,
    `Enriched rows: ${manifest.enriched_count}`,
    `Failed rows: ${manifest.failed_count}`,
    "",
    "This enrichment fetches public Met object API records for existing local KB stubs and updates those records in place. It does not store image/media files.",
    "",
    "## Examples",
    "",
    "| Local ID | Title | Date | Department | Classification |",
    "| --- | --- | --- | --- | --- |",
    ...enrichedRows.slice(0, 12).map((entry) => `| ${escapeMd(entry.next.local_id)} | ${escapeMd(entry.next.title)} | ${escapeMd(entry.next.date ?? "")} | ${escapeMd(entry.next.department ?? "")} | ${escapeMd(entry.next.classification ?? "")} |`),
    "",
  ];
  if (failuresRows.length) {
    lines.push("## Failures", "", "| Object ID | Error |", "| --- | --- |");
    lines.push(...failuresRows.slice(0, 50).map((failure) => `| ${escapeMd(failure.object_id)} | ${escapeMd(failure.error)} |`));
    lines.push("");
  }
  await writeText(path.join(auditsDir, "met-stub-enrichment-last-run.md"), `${lines.join("\n")}\n`);
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

function escapeMd(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}
