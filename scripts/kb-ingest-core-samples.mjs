import path from "node:path";
import {
  appendText,
  auditsDir,
  loadRegistry,
  processedDir,
  rawDir,
  relative,
  writeJson,
  writeText,
} from "./kb-lib.mjs";

const runDate = new Date().toISOString().slice(0, 10);
const runId = `core-samples-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const limit = Number.parseInt(getArg("--limit") ?? "25", 10);
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "20000", 10);
const registry = await loadRegistry();
const registryById = new Map(registry.sources.map((source) => [source.source_id, source]));

const ingests = [
  {
    source_id: "openalex-humanities",
    access_route: `https://api.openalex.org/works?search=${encodeURIComponent("digital humanities")}&per-page=${limit}`,
    normalize: normalizeOpenAlexWorks,
  },
  {
    source_id: "crossref-humanities",
    access_route: `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent("digital humanities")}&rows=${limit}`,
    normalize: normalizeCrossrefWorks,
  },
  {
    source_id: "wikidata-cultural-entities",
    access_route: wikidataSparqlUrl(limit),
    normalize: normalizeWikidataEntities,
  },
  {
    source_id: "library-of-congress",
    access_route: `https://www.loc.gov/books/?fo=json&c=${limit}&fa=subject:${encodeURIComponent("literature")}`,
    normalize: normalizeLocItems,
  },
  {
    source_id: "met-collection-api",
    access_route: "https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting",
    normalize: normalizeMetSearch,
  },
  {
    source_id: "cleveland-museum-open-access",
    access_route: `https://openaccess-api.clevelandart.org/api/artworks/?limit=${limit}&has_image=1`,
    normalize: normalizeClevelandArtworks,
  },
];

const runRecords = [];
const sourceDocuments = [];
const works = [];
const objects = [];
const rights = [];

for (const ingest of ingests) {
  ingest.registry = registryById.get(ingest.source_id) ?? {};
  const started = new Date().toISOString();
  const sourceDir = path.join(rawDir, ingest.source_id, runDate, runId);
  const rawPath = path.join(sourceDir, "response.json");
  try {
    const payload = await fetchJson(ingest.access_route);
    await writeJson(rawPath, payload);
    const normalized = ingest.normalize(payload, ingest);
    sourceDocuments.push(...normalized.source_documents);
    works.push(...normalized.works);
    objects.push(...normalized.objects);
    rights.push(...normalized.rights);
    const record = {
      run_id: runId,
      source_id: ingest.source_id,
      started_at: started,
      completed_at: new Date().toISOString(),
      status: "success",
      access_route: ingest.access_route,
      raw_outputs: [relative(rawPath)],
      processed_outputs: [
        "data/knowledge-base/processed/source_documents.jsonl",
        "data/knowledge-base/processed/works.jsonl",
        "data/knowledge-base/processed/objects.jsonl",
        "data/knowledge-base/processed/rights.jsonl",
      ],
      record_count: normalized.source_documents.length + normalized.works.length + normalized.objects.length,
      rights_review: "Source registry rights fields apply; inspect item-level rights before publication claims.",
      errors: [],
    };
    runRecords.push(record);
    await writeJson(path.join(sourceDir, "manifest.json"), record);
  } catch (error) {
    const record = {
      run_id: runId,
      source_id: ingest.source_id,
      started_at: started,
      completed_at: new Date().toISOString(),
      status: "failed",
      access_route: ingest.access_route,
      raw_outputs: [],
      processed_outputs: [],
      record_count: 0,
      rights_review: "Not reviewed because fetch failed.",
      errors: [error.message],
    };
    runRecords.push(record);
    await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${JSON.stringify(record)}\n`);
  }
}

await writeText(path.join(processedDir, "source_documents.jsonl"), toJsonl(sourceDocuments));
await writeText(path.join(processedDir, "works.jsonl"), toJsonl(works));
await writeText(path.join(processedDir, "objects.jsonl"), toJsonl(objects));
await writeText(path.join(processedDir, "rights.jsonl"), toJsonl(rights));
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${runRecords.map((record) => JSON.stringify(record)).join("\n")}\n`);
await writeJson(path.join(auditsDir, "core-samples-last-run.json"), {
  run_id: runId,
  generated_at: new Date().toISOString(),
  source_count: ingests.length,
  success_count: runRecords.filter((record) => record.status === "success").length,
  failed_count: runRecords.filter((record) => record.status === "failed").length,
  source_document_count: sourceDocuments.length,
  work_count: works.length,
  object_count: objects.length,
  rights_count: rights.length,
  records: runRecords,
});

console.log(`KB core sample ingest ${runId}: ${runRecords.filter((record) => record.status === "success").length}/${ingests.length} sources succeeded.`);

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "alpha-research-local-humanities-kb/0.1 mailto:research@alpharesearch.nyc",
        "accept": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function baseDoc(source, nativeId, title, url, extra = {}) {
  return {
    local_id: `${source.source_id}:${nativeId || slugish(title || url)}`,
    source_id: source.source_id,
    source_native_id: nativeId || "",
    source_url: url || source.access_route,
    title: title || "",
    fetched_at: new Date().toISOString(),
    ...extra,
  };
}

function normalizeOpenAlexWorks(payload, source) {
  const rows = payload.results ?? [];
  const works = rows.map((row) => baseDoc(source, row.id, row.title, row.id, {
    type: "scholarly-work",
    publication_year: row.publication_year ?? null,
    venue: row.primary_location?.source?.display_name ?? "",
    doi: row.doi ?? "",
    open_access: row.open_access?.is_oa ?? null,
  }));
  return withRights(source, { source_documents: works, works, objects: [] });
}

function normalizeCrossrefWorks(payload, source) {
  const rows = payload.message?.items ?? [];
  const works = rows.map((row) => baseDoc(source, row.DOI, first(row.title), row.URL, {
    type: "scholarly-work",
    publication_year: row.issued?.["date-parts"]?.[0]?.[0] ?? null,
    venue: first(row["container-title"]),
    doi: row.DOI ?? "",
    publisher: row.publisher ?? "",
  }));
  return withRights(source, { source_documents: works, works, objects: [] });
}

function normalizeWikidataEntities(payload, source) {
  const rows = payload.results?.bindings ?? [];
  const docs = rows.map((row) => baseDoc(source, row.entity?.value?.split("/").at(-1), row.entityLabel?.value, row.entity?.value, {
    type: "linked-open-data-entity",
    description: row.entityDescription?.value ?? "",
    entity_uri: row.entity?.value ?? "",
  }));
  return withRights(source, { source_documents: docs, works: [], objects: [] });
}

function normalizeLocItems(payload, source) {
  const rows = payload.results ?? [];
  const docs = rows.map((row) => baseDoc(source, row.id, row.title, row.url, {
    type: "loc-item",
    date: Array.isArray(row.date) ? row.date.join("; ") : row.date ?? "",
    subjects: Array.isArray(row.subject) ? row.subject.slice(0, 12) : [],
    rights: row.rights ?? "",
  }));
  return withRights(source, { source_documents: docs, works: [], objects: docs });
}

function normalizeMetSearch(payload, source) {
  const ids = (payload.objectIDs ?? []).slice(0, limit);
  const docs = ids.map((id) => baseDoc(source, id, `Met object ${id}`, `https://www.metmuseum.org/art/collection/search/${id}`, {
    type: "museum-object-stub",
  }));
  return withRights(source, { source_documents: docs, works: [], objects: docs });
}

function normalizeClevelandArtworks(payload, source) {
  const rows = payload.data ?? [];
  const docs = rows.map((row) => baseDoc(source, row.id, row.title, row.url, {
    type: "museum-object",
    creation_date: row.creation_date ?? "",
    department: row.department ?? "",
    culture: row.culture?.join?.("; ") ?? row.culture ?? "",
    share_license_status: row.share_license_status ?? "",
  }));
  return withRights(source, { source_documents: docs, works: [], objects: docs });
}

function withRights(source, normalized) {
  return {
    ...normalized,
    rights: normalized.source_documents.map((doc) => ({
      local_id: doc.local_id,
      source_id: source.source_id,
      license: source.registry?.license ?? "",
      redistribution_status: source.registry?.redistribution_status ?? "",
      full_text_allowed: source.registry?.full_text_allowed ?? false,
      metadata_allowed: source.registry?.metadata_allowed ?? true,
      rights_note: "Inherited from source registry; inspect item-level rights before publication claims.",
    })),
  };
}

function wikidataSparqlUrl(resultLimit) {
  const query = `
SELECT ?entity ?entityLabel ?entityDescription WHERE {
  ?entity wdt:P31 wd:Q5;
          wdt:P106/wdt:P279* wd:Q36180.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${resultLimit}`;
  return `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
}

function first(value) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function toJsonl(rows) {
  return rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
}

function slugish(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
