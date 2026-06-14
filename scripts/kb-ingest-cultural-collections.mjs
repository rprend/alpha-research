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
} from "./kb-lib.mjs";

const runDate = new Date().toISOString().slice(0, 10);
const runId = `cultural-collections-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const perSource = Number.parseInt(getArg("--per-source") ?? "250", 10);
const pageSize = Number.parseInt(getArg("--page-size") ?? "50", 10);
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "30000", 10);
const registry = await loadRegistry();
const registryById = new Map(registry.sources.map((source) => [source.source_id, source]));

const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const objects = await readJsonl(path.join(processedDir, "objects.jsonl"));
const collections = await readJsonl(path.join(processedDir, "collections.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const runRecords = [];

const jobs = [
  {
    source_id: "met-collection-api",
    run: ingestMet,
  },
  {
    source_id: "cleveland-museum-open-access",
    run: ingestCleveland,
  },
  {
    source_id: "library-of-congress",
    run: ingestLoc,
  },
  {
    source_id: "smithsonian-open-access",
    run: ingestSmithsonian,
  },
];

for (const job of jobs) {
  job.registry = registryById.get(job.source_id) ?? {};
  const started = new Date().toISOString();
  const sourceDir = path.join(rawDir, job.source_id, runDate, runId);
  try {
    const result = await job.run(job, sourceDir);
    sourceDocuments.push(...result.documents);
    objects.push(...result.objects);
    collections.push(...result.collections);
    rights.push(...result.documents.map((row) => rightsRow(row, job)));
    const record = manifestRecord(job, started, "success", result.raw_outputs, result.documents.length, result.errors ?? []);
    runRecords.push(record);
    await writeJson(path.join(sourceDir, "manifest.json"), record);
  } catch (error) {
    const record = manifestRecord(job, started, "failed", [], 0, [error.message]);
    runRecords.push(record);
    await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${JSON.stringify(record)}\n`);
  }
}

await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "objects.jsonl"), dedupe(objects, "local_id"));
await writeJsonl(path.join(processedDir, "collections.jsonl"), dedupe(collections, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${runRecords.map((record) => JSON.stringify(record)).join("\n")}\n`);

const summary = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  per_source: perSource,
  page_size: pageSize,
  source_count: jobs.length,
  success_count: runRecords.filter((record) => record.status === "success").length,
  failed_count: runRecords.filter((record) => record.status === "failed").length,
  total_records: runRecords.reduce((sum, record) => sum + record.record_count, 0),
  records: runRecords,
};
await writeJson(path.join(auditsDir, "cultural-collections-last-run.json"), summary);

console.log(`KB cultural collections ingest ${runId}: ${summary.success_count}/${jobs.length} sources succeeded; ${summary.total_records} records imported.`);

async function ingestMet(job, sourceDir) {
  const rawOutputs = [];
  const errors = [];
  const documents = [];
  const searchTerms = ["painting", "sculpture", "textile", "photograph", "manuscript", "ceramic"];
  const objectIds = [];
  for (const [index, term] of searchTerms.entries()) {
    const route = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(term)}`;
    const rawPath = path.join(sourceDir, `search-${String(index + 1).padStart(2, "0")}-${slugish(term)}.json`);
    try {
      const payload = await fetchJson(route);
      await writeJson(rawPath, payload);
      rawOutputs.push(relative(rawPath));
      objectIds.push(...(payload.objectIDs ?? []));
    } catch (error) {
      errors.push(`${route}: ${error.message}`);
    }
  }
  const uniqueIds = [...new Set(objectIds)].slice(0, perSource);
  for (const [index, id] of uniqueIds.entries()) {
    const route = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`;
    const rawPath = path.join(sourceDir, `object-${String(index + 1).padStart(4, "0")}-${id}.json`);
    try {
      const payload = await fetchJson(route);
      await writeJson(rawPath, payload);
      rawOutputs.push(relative(rawPath));
      documents.push(normalizeMetObject(payload, job));
    } catch (error) {
      errors.push(`${route}: ${error.message}`);
    }
    if ((index + 1) % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const filtered = documents.filter(Boolean).slice(0, perSource);
  if (!filtered.length) throw new Error(errors.join("; ") || "No Met object records imported.");
  return { raw_outputs: rawOutputs, documents: filtered, objects: filtered, collections: [], errors };
}

async function ingestCleveland(job, sourceDir) {
  const rawOutputs = [];
  const documents = [];
  for (let page = 0; documents.length < perSource; page += 1) {
    const route = `https://openaccess-api.clevelandart.org/api/artworks/?limit=${pageSize}&skip=${page * pageSize}&has_image=1`;
    const rawPath = path.join(sourceDir, `artworks-page-${String(page + 1).padStart(3, "0")}.json`);
    const payload = await fetchJson(route);
    await writeJson(rawPath, payload);
    rawOutputs.push(relative(rawPath));
    const rows = (payload.data ?? []).map((row) => normalizeClevelandObject(row, job));
    documents.push(...rows);
    if (!rows.length || page > 20) break;
  }
  const sliced = documents.filter(Boolean).slice(0, perSource);
  return { raw_outputs: rawOutputs, documents: sliced, objects: sliced, collections: [] };
}

async function ingestLoc(job, sourceDir) {
  const rawOutputs = [];
  const errors = [];
  const documents = [];
  const collectionsRows = [];
  const subjects = ["art", "literature", "music", "photography", "manuscripts", "maps"];
  for (const [index, subject] of subjects.entries()) {
    const route = `https://www.loc.gov/photos/?fo=json&c=${Math.min(pageSize, 25)}&fa=subject:${encodeURIComponent(subject)}`;
    const rawPath = path.join(sourceDir, `photos-${String(index + 1).padStart(2, "0")}-${slugish(subject)}.json`);
    try {
      const payload = await fetchJson(route);
      await writeJson(rawPath, payload);
      rawOutputs.push(relative(rawPath));
      documents.push(...(payload.results ?? []).map((row) => normalizeLocItem(row, job, "loc-photo-item")));
    } catch (error) {
      errors.push(`${route}: ${error.message}`);
    }
  }
  const collectionsRoute = `https://www.loc.gov/collections/?fo=json&c=${Math.min(perSource, 100)}`;
  const collectionsPath = path.join(sourceDir, "collections.json");
  try {
    const collectionsPayload = await fetchJson(collectionsRoute);
    await writeJson(collectionsPath, collectionsPayload);
    rawOutputs.push(relative(collectionsPath));
    const locCollections = collectionsPayload.content?.results ?? collectionsPayload.results ?? [];
    collectionsRows.push(...locCollections.map((row) => normalizeLocCollection(row, job)));
  } catch (error) {
    errors.push(`${collectionsRoute}: ${error.message}`);
  }
  const sliced = documents.filter(Boolean).slice(0, perSource);
  if (!sliced.length && !collectionsRows.length) throw new Error(errors.join("; ") || "No Library of Congress records imported.");
  return { raw_outputs: rawOutputs, documents: sliced, objects: sliced, collections: collectionsRows.filter(Boolean), errors };
}

async function ingestSmithsonian(job, sourceDir) {
  const rawOutputs = [];
  const documents = [];
  const terms = ["art history", "painting", "literature", "photography", "music", "material culture"];
  for (const [index, term] of terms.entries()) {
    const route = `https://api.si.edu/openaccess/api/v1.0/search?api_key=DEMO_KEY&q=${encodeURIComponent(term)}&rows=${pageSize}`;
    const rawPath = path.join(sourceDir, `search-${String(index + 1).padStart(2, "0")}-${slugish(term)}.json`);
    const payload = await fetchJson(route);
    await writeJson(rawPath, payload);
    rawOutputs.push(relative(rawPath));
    documents.push(...(payload.response?.rows ?? []).map((row) => normalizeSmithsonianObject(row, job)));
  }
  const sliced = documents.filter(Boolean).slice(0, perSource);
  return { raw_outputs: rawOutputs, documents: sliced, objects: sliced, collections: [] };
}

function normalizeMetObject(row, source) {
  if (!row?.objectID) return null;
  return baseDoc(source, row.objectID, row.title || `Met object ${row.objectID}`, row.objectURL || `https://www.metmuseum.org/art/collection/search/${row.objectID}`, {
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
    description: [row.objectName, row.period, row.dynasty, row.reign].filter(Boolean).join("; "),
  });
}

function normalizeClevelandObject(row, source) {
  return baseDoc(source, row.id, row.title, row.url, {
    type: "museum-object",
    date: row.creation_date ?? "",
    creation_date: row.creation_date ?? "",
    department: row.department ?? "",
    culture: Array.isArray(row.culture) ? row.culture.join("; ") : row.culture ?? "",
    classification: row.type ?? "",
    medium: row.technique ?? "",
    artist: (row.creators ?? []).map((entry) => entry.description || entry.name).filter(Boolean).join("; "),
    accession_number: row.accession_number ?? "",
    share_license_status: row.share_license_status ?? "",
    image_url: row.images?.web?.url ?? row.images?.print?.url ?? "",
    description: cleanHtml(row.tombstone ?? row.wall_description ?? row.description ?? ""),
  });
}

function normalizeLocItem(row, source, type) {
  return baseDoc(source, row.id || row.url || row.title, row.title, absoluteUrl(row.url || row.id, "https://www.loc.gov"), {
    type,
    date: Array.isArray(row.date) ? row.date.join("; ") : row.date ?? "",
    department: "Library of Congress",
    culture: Array.isArray(row.location) ? row.location.join("; ") : "",
    classification: Array.isArray(row.original_format) ? row.original_format.join("; ") : row.original_format ?? "",
    medium: Array.isArray(row.medium) ? row.medium.join("; ") : row.medium ?? "",
    subjects: Array.isArray(row.subject) ? row.subject.slice(0, 20) : [],
    image_url: Array.isArray(row.image_url) ? row.image_url[0] ?? "" : row.image_url ?? "",
    description: cleanHtml(Array.isArray(row.description) ? row.description.join(" ") : row.description ?? ""),
  });
}

function normalizeLocCollection(row, source) {
  const url = absoluteUrl(row.url || row.link, "https://www.loc.gov");
  return {
    local_id: `${source.source_id}:collection:${slugish(row.title || url)}`,
    source_id: source.source_id,
    source_native_id: row.id || row.title || "",
    source_url: url,
    title: row.title || "",
    fetched_at: new Date().toISOString(),
    institution: "Library of Congress",
    date_range: Array.isArray(row.date) ? row.date.join("; ") : row.date ?? "",
    rights: row.rights ?? "",
  };
}

function normalizeSmithsonianObject(row, source) {
  const content = row.content ?? {};
  const descriptive = content.descriptiveNonRepeating ?? {};
  const indexed = content.indexedStructured ?? {};
  const notes = descriptive.notes ?? [];
  return baseDoc(source, row.id, row.title || descriptive.title?.content, `https://www.si.edu/object/${row.id}`, {
    type: "smithsonian-object",
    date: Array.isArray(indexed.date) ? indexed.date.join("; ") : "",
    department: row.unitCode ?? descriptive.unit_code ?? "",
    culture: Array.isArray(indexed.culture) ? indexed.culture.join("; ") : "",
    classification: Array.isArray(indexed.object_type) ? indexed.object_type.join("; ") : "",
    medium: Array.isArray(indexed.material) ? indexed.material.join("; ") : "",
    artist: Array.isArray(indexed.name) ? indexed.name.join("; ") : "",
    image_url: descriptive.online_media?.media?.[0]?.thumbnail ?? "",
    description: cleanHtml(notes.map((note) => note.content).filter(Boolean).join(" ")),
  });
}

function baseDoc(source, nativeId, title, url, extra = {}) {
  return {
    local_id: `${source.source_id}:${slugish(nativeId || title || url)}`,
    source_id: source.source_id,
    source_native_id: nativeId || "",
    source_url: url || "",
    title: title || "",
    fetched_at: new Date().toISOString(),
    ...extra,
  };
}

function rightsRow(row, source) {
  return {
    local_id: row.local_id,
    source_id: source.source_id,
    license: source.registry?.license ?? "",
    redistribution_status: source.registry?.redistribution_status ?? "metadata-ok",
    full_text_allowed: false,
    metadata_allowed: source.registry?.metadata_allowed ?? true,
    quote_status: "metadata-only-no-quotes",
    rights_note: "Cultural-collections metadata import. Image/media URLs are retained as metadata; media files are not stored.",
  };
}

function manifestRecord(job, started, status, rawOutputs, recordCount, errors) {
  return {
    run_id: runId,
    source_id: job.source_id,
    started_at: started,
    completed_at: new Date().toISOString(),
    status,
    access_route: "source-specific cultural collections API routes",
    raw_outputs: rawOutputs,
    processed_outputs: status === "success"
      ? [
          "data/knowledge-base/processed/source_documents.jsonl",
          "data/knowledge-base/processed/objects.jsonl",
          "data/knowledge-base/processed/collections.jsonl",
          "data/knowledge-base/processed/rights.jsonl",
        ]
      : [],
    record_count: recordCount,
    rights_review: "Registry metadata rights apply; item-level rights must be checked before image reuse or publication quoting.",
    errors,
  };
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

function absoluteUrl(value, base) {
  if (!value) return "";
  try {
    return new URL(value, base).toString();
  } catch {
    return "";
  }
}

function dedupe(rows, key) {
  const byKey = new Map();
  for (const row of rows) if (row[key]) byKey.set(row[key], row);
  return Array.from(byKey.values());
}

function slugish(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 140);
}

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}
