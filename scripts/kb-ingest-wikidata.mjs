import path from "node:path";
import {
  appendText,
  auditsDir,
  loadRegistry,
  processedDir,
  rawDir,
  readJsonl,
  relative,
  writeJson,
  writeJsonl,
} from "./kb-lib.mjs";

const runDate = new Date().toISOString().slice(0, 10);
const runId = `wikidata-cultural-entities-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const perQuery = Number.parseInt(getArg("--per-query") ?? "75", 10);
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "45000", 10);
const sourceId = "wikidata-cultural-entities";
const registry = await loadRegistry();
const source = registry.sources.find((entry) => entry.source_id === sourceId);
if (!source) throw new Error(`Missing source registry entry: ${sourceId}`);

const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const runRecords = [];
const imported = [];

const jobs = [
  personJob("authors", ["Q36180", "Q49757", "Q6625963", "Q214917", "Q482980"], ["writer", "poet", "novelist", "playwright", "author"]),
  personJob("artists", ["Q1028181", "Q1281618", "Q36834", "Q3391743"], ["painter", "sculptor", "composer", "visual artist"]),
  personJob("philosophers", ["Q4964182", "Q5891", "Q15980158"], ["philosopher", "philosopher of science", "ethicist"]),
  instanceJob("works", ["Q7725634", "Q571", "Q47461344", "Q5185279", "Q25379", "Q3305213", "Q2188189"], "cultural work"),
  instanceJob("movements", ["Q2198855", "Q968159", "Q3533467"], "movement or school"),
  instanceJob("genres", ["Q483394", "Q223393", "Q188451"], "genre"),
  instanceJob("institutions", ["Q3918", "Q7075", "Q43229", "Q166118"], "cultural institution"),
  instanceJob("journals", ["Q5633421"], "scholarly journal"),
  instanceJob("concepts", ["Q151885", "Q11862829", "Q309"], "humanities concept"),
];

for (const [index, job] of jobs.entries()) {
  const started = new Date().toISOString();
  const sourceDir = path.join(rawDir, sourceId, runDate, runId);
  const rawPath = path.join(sourceDir, `${String(index + 1).padStart(2, "0")}-${job.slug}.json`);
  try {
    const payload = await fetchSparql(job.query);
    await writeJson(rawPath, payload);
    const rows = normalizeWikidata(payload, job);
    imported.push(...rows);
    const record = manifestRecord(job, started, "success", [relative(rawPath)], rows.length, []);
    runRecords.push(record);
  } catch (error) {
    const record = manifestRecord(job, started, "failed", [], 0, [error.message]);
    runRecords.push(record);
    await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${JSON.stringify(record)}\n`);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const normalized = dedupe(imported, "local_id");
sourceDocuments.push(...normalized);
rights.push(...normalized.map((row) => rightsRow(row, source)));

await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${runRecords.map((record) => JSON.stringify(record)).join("\n")}\n`);

const summary = {
  run_id: runId,
  source_id: sourceId,
  generated_at: new Date().toISOString(),
  per_query: perQuery,
  source_count: jobs.length,
  success_count: runRecords.filter((record) => record.status === "success").length,
  failed_count: runRecords.filter((record) => record.status === "failed").length,
  record_count: normalized.length,
  records_by_category: countBy(normalized, "wikidata_category"),
  records: runRecords,
};

await writeJson(path.join(rawDir, sourceId, runDate, runId, "manifest.json"), summary);
await writeJson(path.join(auditsDir, "wikidata-cultural-entities-last-run.json"), summary);

console.log(`KB Wikidata ingest ${runId}: ${normalized.length} cultural entities imported across ${summary.success_count}/${jobs.length} successful queries.`);

function personJob(slugName, occupationIds, labels) {
  return {
    slug: slugName,
    category: slugName,
    route: "https://query.wikidata.org/sparql",
    query: `
SELECT ?entity ?entityLabel ?entityDescription ?birth ?death ?countryLabel ?movementLabel WHERE {
  ?entity wdt:P31 wd:Q5;
          wdt:P106 ?occupation.
  VALUES ?occupation { ${occupationIds.map((id) => `wd:${id}`).join(" ")} }
  OPTIONAL { ?entity wdt:P569 ?birth. }
  OPTIONAL { ?entity wdt:P570 ?death. }
  OPTIONAL { ?entity wdt:P27 ?country. }
  OPTIONAL { ?entity wdt:P135 ?movement. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${perQuery}`,
    labels,
  };
}

function instanceJob(slugName, instanceIds, label) {
  return {
    slug: slugName,
    category: slugName,
    route: "https://query.wikidata.org/sparql",
    query: `
SELECT ?entity ?entityLabel ?entityDescription ?inception ?countryLabel WHERE {
  ?entity wdt:P31 ?instance.
  VALUES ?instance { ${instanceIds.map((id) => `wd:${id}`).join(" ")} }
  OPTIONAL { ?entity wdt:P571 ?inception. }
  OPTIONAL { ?entity wdt:P495 ?country. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${perQuery}`,
    labels: [label],
  };
}

async function fetchSparql(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "alpha-research-local-humanities-kb/0.1 mailto:research@alpharesearch.nyc",
        accept: "application/sparql-results+json",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWikidata(payload, job) {
  return (payload.results?.bindings ?? []).map((row) => {
    const qid = qidFromUri(value(row.entity));
    const title = value(row.entityLabel) || qid;
    const description = value(row.entityDescription);
    const birth = year(value(row.birth));
    const death = year(value(row.death));
    const inception = year(value(row.inception));
    const country = value(row.countryLabel);
    const movement = value(row.movementLabel);
    return {
      local_id: `${sourceId}:${qid}`,
      source_id: sourceId,
      source_native_id: qid,
      source_url: value(row.entity),
      title,
      fetched_at: new Date().toISOString(),
      type: "linked-open-data-entity",
      wikidata_category: job.category,
      description,
      entity_uri: value(row.entity),
      publication_year: inception || birth || "",
      venue: "Wikidata",
      country,
      movement,
      birth_year: birth,
      death_year: death,
      tags: job.labels.join("; "),
    };
  }).filter((row) => row.source_native_id && row.title);
}

function rightsRow(row, registrySource) {
  return {
    local_id: row.local_id,
    source_id: sourceId,
    license: registrySource.license ?? "CC0",
    redistribution_status: registrySource.redistribution_status ?? "derived-metadata-ok",
    full_text_allowed: false,
    metadata_allowed: true,
    quote_status: "metadata-only-no-quotes",
    rights_note: "Wikidata linked-open-data metadata imported under registry rights; no full text stored.",
  };
}

function manifestRecord(job, started, status, rawOutputs, recordCount, errors) {
  return {
    run_id: runId,
    source_id: sourceId,
    route_slug: job.slug,
    started_at: started,
    completed_at: new Date().toISOString(),
    status,
    access_route: job.route,
    raw_outputs: rawOutputs,
    processed_outputs: status === "success"
      ? ["data/knowledge-base/processed/source_documents.jsonl", "data/knowledge-base/processed/rights.jsonl"]
      : [],
    record_count: recordCount,
    rights_review: "Wikidata metadata is treated as CC0 linked open data.",
    errors,
  };
}

function value(binding) {
  return binding?.value ?? "";
}

function qidFromUri(uri) {
  return String(uri).split("/").at(-1) ?? "";
}

function year(date) {
  const match = String(date).match(/^-?\d{1,4}/);
  return match ? match[0] : "";
}

function dedupe(rows, key) {
  const byKey = new Map();
  for (const row of rows) if (row[key]) byKey.set(row[key], row);
  return Array.from(byKey.values());
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = row[key] || "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}
