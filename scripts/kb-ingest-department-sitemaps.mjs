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
  writeText,
} from "./kb-lib.mjs";

const targetConfig = await readJson(path.join(kbDir, "config", "department-pages.json"));
const registry = await loadRegistry();
const registryById = new Map(registry.sources.map((source) => [source.source_id, source]));
const runDate = new Date().toISOString().slice(0, 10);
const runId = `department-sitemaps-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "20000", 10);
const limit = Number.parseInt(getArg("--limit") ?? String(targetConfig.targets.length), 10);
const perSitemapLimit = Number.parseInt(getArg("--per-sitemap-limit") ?? "20", 10);
const refreshDepartmentsOnly = process.argv.includes("--refresh-departments-only");

const existingPages = await readJsonl(path.join(processedDir, "pages.jsonl"));
const existingSourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const existingRights = await readJsonl(path.join(processedDir, "rights.jsonl"));
if (refreshDepartmentsOnly) {
  const departments = summarizeDepartments(existingPages);
  await writeJsonl(path.join(processedDir, "departments.jsonl"), departments);
  console.log(`Refreshed ${departments.length} department summaries from existing page rows.`);
  process.exit(0);
}

const existingPageIds = new Set(existingPages.map((page) => page.local_id));
const existingDocumentIds = new Set(existingSourceDocuments.map((doc) => doc.local_id));
const pages = [...existingPages];
const sourceDocuments = [...existingSourceDocuments];
const rights = [...existingRights];
const sitemapTargets = buildSitemapTargets(targetConfig.targets.slice(0, limit));
const sitemapReports = [];
const failures = [];

for (const target of sitemapTargets) {
  const startedAt = new Date().toISOString();
  try {
    const xml = await fetchText(target.sitemap_url);
    const rawDirForTarget = path.join(rawDir, "universities", target.source_id, runDate, runId, slug(`${target.school}-${target.department}-${target.sitemap_url}`));
    const rawPath = path.join(rawDirForTarget, "sitemap.xml");
    const metadataPath = path.join(rawDirForTarget, "metadata.json");
    await writeText(rawPath, xml);
    const urls = sitemapUrls(xml)
      .filter((url) => isRelevantDepartmentUrl(url, target))
      .slice(0, perSitemapLimit);
    const added = [];
    for (const url of urls) {
      const page = sitemapPageRecord(target, url, startedAt);
      if (!existingPageIds.has(page.local_id)) {
        pages.push(page);
        existingPageIds.add(page.local_id);
        added.push(page);
      }
      if (!existingDocumentIds.has(page.local_id)) {
        sourceDocuments.push(sourceDocumentForPage(page));
        existingDocumentIds.add(page.local_id);
      }
      rights.push(rightsForPage(page, registryById.get(target.source_id)));
    }
    const metadata = {
      run_id: runId,
      source_id: target.source_id,
      sitemap_url: target.sitemap_url,
      school: target.school,
      department: target.department,
      fetched_at: startedAt,
      status: "success",
      raw_path: relative(rawPath),
      discovered_url_count: urls.length,
      added_page_count: added.length,
    };
    await writeJson(metadataPath, metadata);
    sitemapReports.push(metadata);
  } catch (error) {
    const failure = {
      run_id: runId,
      source_id: target.source_id,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: "failed",
      route_kind: "department-sitemap",
      access_route: target.sitemap_url,
      raw_outputs: [],
      processed_outputs: [],
      record_count: 0,
      rights_review: "Not reviewed because sitemap fetch failed.",
      errors: [error.message],
      target_school: target.school,
      target_department: target.department,
      target_page_type: "department-sitemap",
    };
    failures.push(failure);
    await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${JSON.stringify(failure)}\n`);
  }
}

await writeJsonl(path.join(processedDir, "pages.jsonl"), dedupe(pages, "local_id"));
await writeJsonl(path.join(processedDir, "departments.jsonl"), summarizeDepartments(dedupe(pages, "local_id")));
await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));

const report = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  sitemap_target_count: sitemapTargets.length,
  success_count: sitemapReports.length,
  failed_count: failures.length,
  discovered_url_count: sitemapReports.reduce((sum, entry) => sum + entry.discovered_url_count, 0),
  added_page_count: sitemapReports.reduce((sum, entry) => sum + entry.added_page_count, 0),
  sitemaps: sitemapReports,
  failures,
};

await writeJson(path.join(auditsDir, "department-sitemaps-last-run.json"), report);
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${JSON.stringify({
  run_id: runId,
  source_id: "university-department-web",
  started_at: sitemapReports[0]?.fetched_at ?? new Date().toISOString(),
  completed_at: report.generated_at,
  status: failures.length ? "partial" : "success",
  access_route: "public department sitemap.xml routes",
  raw_outputs: sitemapReports.map((entry) => entry.raw_path),
  processed_outputs: [
    "data/knowledge-base/processed/pages.jsonl",
    "data/knowledge-base/processed/departments.jsonl",
    "data/knowledge-base/processed/source_documents.jsonl",
    "data/knowledge-base/processed/rights.jsonl",
  ],
  record_count: report.added_page_count,
  rights_review: "Sitemap URL metadata only; page text is not stored by this ingest.",
  errors: failures.flatMap((failure) => failure.errors),
})}\n`);

console.log(`Department sitemap ingest ${runId}: ${report.success_count}/${report.sitemap_target_count} sitemaps succeeded; ${report.added_page_count} URL metadata rows added.`);

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
        "accept": "application/xml,text/xml,text/plain,*/*",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function buildSitemapTargets(targets) {
  const seen = new Set();
  const rows = [];
  for (const target of targets) {
    const url = new URL(target.url);
    const sitemapUrl = new URL("/sitemap.xml", url.origin).href;
    const key = `${target.source_id}:${target.school}:${target.department}:${sitemapUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      ...target,
      sitemap_url: sitemapUrl,
    });
  }
  return rows;
}

function sitemapUrls(xml) {
  const urls = [];
  const pattern = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match;
  while ((match = pattern.exec(String(xml)))) {
    try {
      const url = new URL(decodeEntities(match[1].trim()));
      url.hash = "";
      urls.push(url.href);
    } catch {
      continue;
    }
  }
  return [...new Set(urls)].sort((a, b) => a.localeCompare(b));
}

function isRelevantDepartmentUrl(url, target) {
  const text = `${url} ${target.department}`.toLowerCase();
  const departmentTerms = target.department.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3);
  const hasDepartmentTerm = departmentTerms.some((term) => text.includes(term));
  const hasHumanitiesRoute = /english|history|philosophy|classics|comparative|literature|art|archaeology|humanities|faculty|people|news|event|program|graduate|undergraduate/.test(text);
  return hasDepartmentTerm || hasHumanitiesRoute;
}

function sitemapPageRecord(target, url, fetchedAt) {
  const pageType = classifySitemapPageType(url);
  return {
    local_id: `${target.source_id}:${slug(`${target.school}-${target.department}-${pageType}-${url}`)}`,
    source_id: target.source_id,
    school: target.school,
    department: target.department,
    page_type: pageType,
    source_url: url,
    title: titleFromUrl(url),
    fetched_at: fetchedAt,
    text_path: "",
    text_chars: 0,
    status: "sitemap-only",
  };
}

function sourceDocumentForPage(page) {
  return {
    local_id: page.local_id,
    source_id: page.source_id,
    source_native_id: page.source_url,
    source_url: page.source_url,
    title: page.title,
    fetched_at: page.fetched_at,
    type: "department-sitemap-url",
    department: page.department,
    text_path: "",
    text_chars: 0,
  };
}

function rightsForPage(page, source = {}) {
  return {
    local_id: page.local_id,
    source_id: page.source_id,
    license: source.license ?? "Public web sitemap URL metadata; copyright retained by institution",
    redistribution_status: "metadata-only",
    full_text_allowed: false,
    metadata_allowed: true,
    quote_status: "metadata-only",
    rights_note: "Only sitemap URL metadata is stored; this ingest does not store page text.",
  };
}

function classifySitemapPageType(url) {
  const text = String(url).toLowerCase();
  if (/news|story|stories|article/.test(text)) return "department-news-sitemap-url";
  if (/event|calendar|lecture|colloqu/.test(text)) return "department-events-sitemap-url";
  if (/faculty|people|directory/.test(text)) return "department-faculty-sitemap-url";
  if (/graduate|undergraduate|program|course|curriculum/.test(text)) return "department-programs-sitemap-url";
  if (/about|mission|overview/.test(text)) return "department-about-sitemap-url";
  return "department-sitemap-url";
}

function titleFromUrl(url) {
  const parsed = new URL(url);
  const last = parsed.pathname.split("/").filter(Boolean).at(-1) ?? parsed.hostname;
  return last
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || parsed.hostname;
}

function summarizeDepartments(pages) {
  const byDepartment = new Map();
  for (const page of pages) {
    const key = `${page.source_id}:${slug(`${page.school}-${page.department}`)}`;
    const current = byDepartment.get(key) ?? {
      local_id: key,
      source_id: page.source_id,
      school: page.school,
      department: page.department,
      homepage_url: page.source_url,
      page_count: 0,
      first_seen_at: page.fetched_at,
      last_seen_at: page.fetched_at,
    };
    current.page_count += 1;
    if (page.status === "success" && current.homepage_url.includes("sitemap")) current.homepage_url = page.source_url;
    current.first_seen_at = [current.first_seen_at, page.fetched_at].sort()[0];
    current.last_seen_at = [current.last_seen_at, page.fetched_at].sort().at(-1);
    byDepartment.set(key, current);
  }
  return Array.from(byDepartment.values()).sort((a, b) => a.local_id.localeCompare(b.local_id));
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function dedupe(rows, key) {
  const byKey = new Map();
  for (const row of rows) byKey.set(row[key], row);
  return Array.from(byKey.values());
}
