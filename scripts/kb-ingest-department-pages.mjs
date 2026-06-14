import path from "node:path";
import {
  appendText,
  auditsDir,
  cleanHtml,
  extractTitle,
  kbDir,
  loadRegistry,
  processedDir,
  rawDir,
  readJson,
  readJsonl,
  relative,
  slug,
  textDir,
  writeJson,
  writeJsonl,
  writeText,
} from "./kb-lib.mjs";

const targetConfig = await readJson(path.join(kbDir, "config", "department-pages.json"));
const registry = await loadRegistry();
const registryById = new Map(registry.sources.map((source) => [source.source_id, source]));
const runDate = new Date().toISOString().slice(0, 10);
const runId = `department-pages-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "20000", 10);
const limit = Number.parseInt(getArg("--limit") ?? String(targetConfig.targets.length), 10);
const discoverPerTarget = Number.parseInt(getArg("--discover-per-target") ?? "5", 10);
const discoverPerPageType = Number.parseInt(getArg("--discover-per-page-type") ?? "1", 10);
const sitemapUpgradeLimit = Number.parseInt(getArg("--sitemap-upgrade-limit") ?? "0", 10);

const pages = [];
const existingPages = await readJsonl(path.join(processedDir, "pages.jsonl"));
const sourceDocuments = await readJsonl(path.join(processedDir, "source_documents.jsonl"));
const rights = await readJsonl(path.join(processedDir, "rights.jsonl"));
const failures = [];
const existingPageIds = new Set(existingPages.map((page) => page.local_id));
const existingPageByUrl = new Map(existingPages.map((page) => [normalizeUrl(page.source_url), page]).filter(([url]) => Boolean(url)));

for (const target of targetConfig.targets.slice(0, limit)) {
  try {
    const result = await ingestTargetPage(target);
    if (discoverPerTarget > 0) {
      for (const discovered of discoverTargets(target, result.html).slice(0, discoverPerTarget)) {
        try {
          await ingestTargetPage(discovered);
        } catch (error) {
          await recordFailure(discovered, error, new Date().toISOString(), "discovered-page");
        }
      }
    }
  } catch (error) {
    await recordFailure(target, error, new Date().toISOString(), "configured-page");
  }
}

if (sitemapUpgradeLimit > 0) {
  for (const target of sitemapUpgradeTargets().slice(0, sitemapUpgradeLimit)) {
    try {
      await ingestTargetPage(target);
    } catch (error) {
      await recordFailure(target, error, new Date().toISOString(), "sitemap-metadata-upgrade");
    }
  }
}

const allPages = dedupe([...existingPages, ...pages], "local_id");
const departments = summarizeDepartments(allPages);
await writeJsonl(path.join(processedDir, "pages.jsonl"), allPages);
await writeJsonl(path.join(processedDir, "departments.jsonl"), departments);
await writeJsonl(path.join(processedDir, "source_documents.jsonl"), dedupe(sourceDocuments, "local_id"));
await writeJsonl(path.join(processedDir, "rights.jsonl"), dedupe(rights, "local_id"));

const report = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  target_count: Math.min(limit, targetConfig.targets.length),
  success_count: pages.length,
  failed_count: failures.length,
  page_count: allPages.length,
  department_count: departments.length,
  new_page_count: pages.length,
  pages,
  failures,
};
await writeJson(path.join(auditsDir, "department-pages-last-run.json"), report);
await appendText(path.join(auditsDir, "ingest-runs.jsonl"), `${JSON.stringify({
  run_id: runId,
  source_id: "university-department-web",
  started_at: pages[0]?.fetched_at ?? new Date().toISOString(),
  completed_at: report.generated_at,
  status: failures.length ? "partial" : "success",
  access_route: "data/knowledge-base/config/department-pages.json",
  raw_outputs: pages.map((page) => page.text_path),
  processed_outputs: [
    "data/knowledge-base/processed/pages.jsonl",
    "data/knowledge-base/processed/departments.jsonl",
    "data/knowledge-base/processed/source_documents.jsonl",
    "data/knowledge-base/processed/rights.jsonl",
  ],
  record_count: pages.length + departments.length,
  rights_review: "Public page text stored for local analysis only.",
  errors: failures.flatMap((failure) => failure.errors),
})}\n`);

console.log(`Department page ingest ${runId}: ${pages.length}/${Math.min(limit, targetConfig.targets.length)} pages succeeded.`);

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
        "accept": "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error(`Unsupported content type ${contentType}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function ingestTargetPage(target) {
  const source = registryById.get(target.source_id) ?? {};
  const urlKey = normalizeUrl(target.url);
  const existingPage = existingPageByUrl.get(urlKey);
  const localId = existingPage?.local_id ?? `${target.source_id}:${slug(`${target.school}-${target.department}-${target.page_type}-${target.url}`)}`;
  if (existingPage?.text_path || existingPageIds.has(localId) && !existingPage) {
    if (target.discovery_source_url) return { html: "", skipped: true };
    return { html: await fetchText(target.url), skipped: true };
  }
  const html = await fetchText(target.url);
  const text = cleanHtml(html);
  const title = extractTitle(html) || `${target.school} ${target.department}`;
  const targetSlug = slug(`${target.department}-${target.page_type}-${target.url}`);
  const textSlug = slug(`${target.school}-${target.department}-${target.page_type}-${target.url}`);
  const rawTargetDir = path.join(rawDir, "universities", target.source_id, runDate, runId, targetSlug);
  const rawPath = path.join(rawTargetDir, "response.html");
  const metadataPath = path.join(rawTargetDir, "metadata.json");
  const textPath = path.join(textDir, "department-pages", target.source_id, `${textSlug}.txt`);
  await writeText(rawPath, html);
  await writeText(textPath, text);
  const metadata = {
    run_id: runId,
    source_id: target.source_id,
    url: target.url,
    school: target.school,
    department: target.department,
    page_type: target.page_type,
    discovery_source_url: target.discovery_source_url ?? "",
    fetched_at: new Date().toISOString(),
    status: "success",
    raw_path: relative(rawPath),
    text_path: relative(textPath),
    text_chars: text.length,
  };
  await writeJson(metadataPath, metadata);
  const page = {
    local_id: localId,
    source_id: target.source_id,
    school: target.school || existingPage?.school || "",
    department: target.department || existingPage?.department || "",
    page_type: target.page_type,
    source_url: target.url,
    title,
    fetched_at: metadata.fetched_at,
    text_path: relative(textPath),
    text_chars: text.length,
    status: "success",
  };
  pages.push(page);
  existingPageIds.add(localId);
  existingPageByUrl.set(urlKey, page);
  sourceDocuments.push({
    local_id: localId,
    source_id: target.source_id,
    source_native_id: target.url,
    source_url: target.url,
    title,
    fetched_at: metadata.fetched_at,
    type: "department-page",
    department: target.department,
    text_path: relative(textPath),
    text_chars: text.length,
  });
  rights.push({
    local_id: localId,
    source_id: target.source_id,
    license: source.license ?? "Public web pages; copyright retained by institution",
    redistribution_status: source.redistribution_status ?? "local-analysis-only",
    full_text_allowed: false,
    metadata_allowed: true,
    quote_status: "needs-review",
    rights_note: "Extracted public page text is stored for local analysis only; do not redistribute page text without review.",
  });
  return { html, skipped: false };
}

async function recordFailure(target, error, started, routeKind) {
  const failure = {
    run_id: runId,
    source_id: target.source_id,
    started_at: started,
    completed_at: new Date().toISOString(),
    status: "failed",
    route_kind: routeKind,
    access_route: target.url,
    raw_outputs: [],
    processed_outputs: [],
    record_count: 0,
    rights_review: "Not reviewed because fetch failed.",
    errors: [error.message],
  };
  failures.push(failure);
  await appendText(path.join(auditsDir, "failed-routes.jsonl"), `${JSON.stringify(failure)}\n`);
}

function discoverTargets(target, html) {
  const links = [];
  const base = new URL(target.url);
  const seen = new Set([normalizeUrl(target.url)]);
  const byType = new Map();
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(String(html)))) {
    const href = match[1];
    const label = cleanHtml(match[2]);
    let url;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.origin !== base.origin) continue;
    if (isNonHtmlAsset(url.pathname)) continue;
    url.hash = "";
    const normalized = normalizeUrl(url.href);
    if (seen.has(normalized)) continue;
    const pageType = classifyPageType(`${url.pathname} ${label}`);
    if (!pageType) continue;
    seen.add(normalized);
    const typedLinks = byType.get(pageType) ?? [];
    typedLinks.push({
      ...target,
      url: normalized,
      page_type: pageType,
      discovery_source_url: target.url,
    });
    byType.set(pageType, typedLinks);
  }
  for (const pageType of ["department-about", "department-news", "department-events", "department-faculty", "department-programs"]) {
    const typedLinks = (byType.get(pageType) ?? []).sort((a, b) => a.url.localeCompare(b.url));
    links.push(...typedLinks.slice(0, discoverPerPageType));
  }
  return links.slice(0, discoverPerTarget);
}

function classifyPageType(value) {
  const text = String(value).toLowerCase();
  if (/\babout\b|mission|overview/.test(text)) return "department-about";
  if (/news|story|stories|article/.test(text)) return "department-news";
  if (/event|calendar|lecture|colloqu/.test(text)) return "department-events";
  if (/faculty|people|directory/.test(text)) return "department-faculty";
  if (/graduate|undergraduate|program|course|curriculum/.test(text)) return "department-programs";
  return "";
}

function isNonHtmlAsset(pathname) {
  return /\.(?:7z|avi|csv|doc|docx|gif|gz|ics|jpeg|jpg|json|mov|mp3|mp4|odp|ods|odt|pdf|png|ppt|pptx|rss|svg|tar|tsv|txt|webp|xls|xlsx|xml|zip)$/i.test(String(pathname));
}

function pageTypeRank(pageType) {
  return {
    "department-about": 0,
    "department-news": 1,
    "department-events": 2,
    "department-faculty": 3,
    "department-programs": 4,
  }[pageType] ?? 99;
}

function normalizeUrl(value) {
  if (!value) return "";
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.href.replace(/\/$/, "");
}

function sitemapUpgradeTargets() {
  const configuredSourceIds = new Set(targetConfig.targets.map((target) => target.source_id));
  return existingPages
    .filter((page) => configuredSourceIds.has(page.source_id))
    .filter((page) => !page.text_path && page.source_url)
    .filter((page) => String(page.page_type).endsWith("-sitemap-url"))
    .map((page) => ({
      source_id: page.source_id,
      school: page.school,
      department: page.department,
      page_type: String(page.page_type).replace(/-sitemap-url$/, ""),
      url: page.source_url,
      discovery_source_url: "metadata-only sitemap URL already stored in KB",
    }))
    .filter((target) => ["department-about", "department-news", "department-events", "department-faculty", "department-programs", "department"].includes(target.page_type))
    .sort((a, b) => pageTypeRank(a.page_type) - pageTypeRank(b.page_type) || a.url.localeCompare(b.url));
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
    current.first_seen_at = [current.first_seen_at, page.fetched_at].sort()[0];
    current.last_seen_at = [current.last_seen_at, page.fetched_at].sort().at(-1);
    byDepartment.set(key, current);
  }
  return Array.from(byDepartment.values()).sort((a, b) => a.local_id.localeCompare(b.local_id));
}

function dedupe(rows, key) {
  const byKey = new Map();
  for (const row of rows) byKey.set(row[key], row);
  return Array.from(byKey.values());
}
