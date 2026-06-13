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
const runId = `web-metadata-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const limit = Number.parseInt(getArg("--limit") ?? "10", 10);
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "20000", 10);
const registry = await loadRegistry();
const registryById = new Map(registry.sources.map((source) => [source.source_id, source]));

const ingests = [
  {
    source_id: "doaj-humanities",
    access_route: `https://doaj.org/api/search/articles/${encodeURIComponent("digital humanities")}?page=1&pageSize=${limit}`,
    format: "json",
    normalize: normalizeDoajArticles,
  },
  {
    source_id: "internet-archive-metadata",
    access_route: `https://archive.org/advancedsearch.php?q=${encodeURIComponent("subject:(humanities) AND mediatype:(texts)")}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=collection&fl[]=licenseurl&rows=${limit}&page=1&output=json`,
    format: "json",
    normalize: normalizeInternetArchive,
  },
  {
    source_id: "nber-culture-history",
    access_route: `https://www.nber.org/api/v1/working_page_listing/contentType/working_paper/_/_/search?search=${encodeURIComponent("culture history")}&page=1&perPage=${limit}`,
    format: "json",
    normalize: normalizeNber,
  },
  {
    source_id: "wayback-machine-cdx",
    access_route: `https://web.archive.org/cdx?url=${encodeURIComponent("english.yale.edu/*")}&from=2020&to=2026&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&limit=${limit}`,
    format: "json",
    normalize: normalizeWayback,
  },
  {
    source_id: "public-books",
    access_route: "https://www.publicbooks.org/feed/",
    format: "text",
    normalize: normalizeRssLike("public-books"),
  },
  {
    source_id: "lareviewofbooks",
    access_route: "https://lareviewofbooks.org/feed/",
    format: "text",
    normalize: normalizeRssLike("lareviewofbooks"),
  },
  {
    source_id: "journal-digital-humanities-quarterly",
    access_route: "https://www.digitalhumanities.org/dhq/vol/18/4/index.html",
    format: "text",
    normalize: normalizeDhqIndex,
  },
];

const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const works = await readJsonl(path.join(processedDir, "works.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const runRecords = [];

for (const ingest of ingests) {
  ingest.registry = registryById.get(ingest.source_id) ?? {};
  const started = new Date().toISOString();
  const sourceDir = path.join(rawDir, ingest.source_id, runDate, runId);
  const rawPath = path.join(sourceDir, ingest.format === "json" ? "response.json" : "response.txt");
  try {
    const payload = ingest.format === "json" ? await fetchJson(ingest.access_route) : await fetchText(ingest.access_route);
    if (ingest.format === "json") await writeJson(rawPath, payload);
    else await import("./kb-lib.mjs").then(({ writeText }) => writeText(rawPath, payload));
    const normalized = ingest.normalize(payload, ingest).slice(0, limit);
    sourceDocuments.push(...normalized);
    works.push(...normalized.filter((row) => ["scholarly-work", "article", "working-paper", "public-review-article"].includes(row.type)));
    rights.push(...normalized.map((row) => rightsRow(row, ingest)));
    const record = manifestRecord({
      ingest,
      started,
      status: "success",
      rawPath,
      recordCount: normalized.length,
      errors: [],
    });
    runRecords.push(record);
    await writeJson(path.join(sourceDir, "manifest.json"), record);
  } catch (error) {
    const record = manifestRecord({
      ingest,
      started,
      status: "failed",
      rawPath: null,
      recordCount: 0,
      errors: [error.message],
    });
    runRecords.push(record);
    await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${JSON.stringify(record)}\n`);
  }
}

await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "works.jsonl"), dedupe(works, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${runRecords.map((record) => JSON.stringify(record)).join("\n")}\n`);
await writeJson(path.join(auditsDir, "web-metadata-last-run.json"), {
  run_id: runId,
  generated_at: new Date().toISOString(),
  source_count: ingests.length,
  success_count: runRecords.filter((record) => record.status === "success").length,
  failed_count: runRecords.filter((record) => record.status === "failed").length,
  records: runRecords,
});

console.log(`KB web metadata ingest ${runId}: ${runRecords.filter((record) => record.status === "success").length}/${ingests.length} sources succeeded.`);

function getArg(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

async function fetchJson(url) {
  const text = await fetchText(url, "application/json");
  return JSON.parse(text);
}

async function fetchText(url, accept = "text/html,application/xml,text/xml,application/json") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "alpha-research-local-humanities-kb/0.1 mailto:research@alpharesearch.nyc",
        accept,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function baseDoc(source, nativeId, title, url, extra = {}) {
  return {
    local_id: `${source.source_id}:${slugish(nativeId || title || url)}`,
    source_id: source.source_id,
    source_native_id: nativeId || "",
    source_url: url || source.access_route,
    title: title || "",
    fetched_at: new Date().toISOString(),
    ...extra,
  };
}

function normalizeDoajArticles(payload, source) {
  const rows = payload.results ?? [];
  return rows.map((row) => {
    const bib = row.bibjson ?? {};
    return baseDoc(source, row.id, bib.title, first(bib.link)?.url, {
      type: "article",
      publication_year: bib.year ?? "",
      venue: bib.journal?.title ?? "",
      doi: bib.identifier?.find?.((id) => id.type === "doi")?.id ?? "",
      publisher: bib.journal?.publisher ?? "",
      description: bib.abstract ?? "",
    });
  });
}

function normalizeInternetArchive(payload, source) {
  const rows = payload.response?.docs ?? [];
  return rows.map((row) => baseDoc(source, row.identifier, row.title, `https://archive.org/details/${row.identifier}`, {
    type: "archive-text-metadata",
    publication_year: row.date ?? "",
    venue: asText(row.collection),
    creator: asText(row.creator),
    licenseurl: asText(row.licenseurl),
  }));
}

function normalizeNber(payload, source) {
  const rows = payload.results ?? payload.data ?? payload.items ?? [];
  return rows.map((row) => baseDoc(source, row.id ?? row.nid ?? row.url ?? row.title, cleanHtml(row.title ?? row.name ?? ""), absoluteUrl(row.url ?? row.path), {
    type: "working-paper",
    publication_year: row.year ?? row.date ?? "",
    venue: "NBER",
    description: cleanHtml(row.abstract ?? row.search_api_excerpt ?? ""),
  })).filter((row) => row.title || row.source_url);
}

function normalizeWayback(payload, source) {
  const rows = Array.isArray(payload) ? payload.slice(1) : [];
  return rows.map((row) => {
    const [timestamp, original, statuscode, mimetype, digest] = row;
    return baseDoc(source, `${original}-${timestamp}`, `${original} @ ${timestamp}`, `https://web.archive.org/web/${timestamp}/${original}`, {
      type: "web-archive-cdx",
      date: timestamp,
      statuscode,
      mimetype,
      digest,
    });
  });
}

function normalizeRssLike(sourceId) {
  return (text, source) => {
    const items = [...String(text).matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0, limit);
    return items.map((match, index) => {
      const item = match[0];
      const title = cleanXmlTag(item, "title");
      const link = cleanXmlTag(item, "link");
      const pubDate = cleanXmlTag(item, "pubDate");
      const description = cleanHtml(cleanXmlTag(item, "description"));
      return baseDoc(source, link || `${sourceId}-${index}`, title, link, {
        type: "public-review-article",
        publication_year: pubDate,
        venue: source.registry?.name ?? sourceId,
        description,
      });
    });
  };
}

function normalizeDhqIndex(text, source) {
  const matches = [...String(text).matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ href: match[1], title: cleanHtml(match[2]) }))
    .filter((entry) => entry.title.length > 8 && !entry.href.includes("#"));
  return matches.slice(0, limit).map((entry) => baseDoc(source, entry.href, entry.title, new URL(entry.href, source.access_route).toString(), {
    type: "article",
    venue: "Digital Humanities Quarterly",
  }));
}

function rightsRow(row, source) {
  return {
    local_id: row.local_id,
    source_id: source.source_id,
    license: source.registry?.license ?? "",
    redistribution_status: source.registry?.redistribution_status ?? "",
    full_text_allowed: false,
    metadata_allowed: source.registry?.metadata_allowed ?? true,
    quote_status: source.registry?.redistribution_status === "local-analysis-only" ? "needs-review" : "metadata-only-no-quotes",
    rights_note: "Metadata imported for local KB routing; inspect source terms before quoting or redistributing text.",
  };
}

function manifestRecord({ ingest, started, status, rawPath, recordCount, errors }) {
  return {
    run_id: runId,
    source_id: ingest.source_id,
    started_at: started,
    completed_at: new Date().toISOString(),
    status,
    access_route: ingest.access_route,
    raw_outputs: rawPath ? [relative(rawPath)] : [],
    processed_outputs: status === "success" ? [
      "data/knowledge-base/processed/source_documents.jsonl",
      "data/knowledge-base/processed/works.jsonl",
      "data/knowledge-base/processed/rights.jsonl",
    ] : [],
    record_count: recordCount,
    rights_review: status === "success" ? "Source registry rights fields apply; metadata only unless otherwise stated." : "Not reviewed because fetch failed.",
    errors,
  };
}

function first(value) {
  return Array.isArray(value) ? value[0] ?? {} : value ?? {};
}

function asText(value) {
  return Array.isArray(value) ? value.join("; ") : value ?? "";
}

function absoluteUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, "https://www.nber.org").toString();
  } catch {
    return "";
  }
}

function cleanXmlTag(item, tag) {
  const match = String(item).match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanHtml(match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "")) : "";
}

function dedupe(rows, key) {
  const byKey = new Map();
  for (const row of rows) byKey.set(row[key], row);
  return Array.from(byKey.values());
}

function slugish(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}
