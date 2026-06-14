import fs from "node:fs/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const rootDir = process.cwd();
export const kbDir = path.join(rootDir, "data", "knowledge-base");
export const registryPath = path.join(kbDir, "source-registry.json");
export const rightsTaxonomyPath = path.join(kbDir, "rights-taxonomy.json");
export const sourceSchemaPath = path.join(kbDir, "schemas", "source-registry.schema.json");
export const ingestSchemaPath = path.join(kbDir, "schemas", "ingest-manifest.schema.json");
export const auditsDir = path.join(kbDir, "audits");
export const processedDir = path.join(kbDir, "processed");
export const rawDir = path.join(kbDir, "raw");
export const textDir = path.join(kbDir, "text");
export const indexesDir = path.join(kbDir, "indexes");

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeText(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, value);
}

export async function appendText(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, value);
}

export async function readJsonl(file) {
  if (!existsSync(file)) return [];
  const text = await fs.readFile(file, "utf8");
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

export async function writeJsonl(file, rows) {
  await writeText(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
}

export function toCsv(rows, columns) {
  const escape = (value) => {
    const text = value == null ? "" : Array.isArray(value) ? value.join("; ") : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${[columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n")}\n`;
}

export function cleanHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTitle(html) {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? cleanHtml(match[1]) : "";
}

export function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function loadRegistry() {
  return readJson(registryPath);
}

export async function loadSourceSchema() {
  return readJson(sourceSchemaPath);
}

export async function loadRightsTaxonomy() {
  return readJson(rightsTaxonomyPath);
}

export function listFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        visit(full);
      } else {
        files.push(full);
      }
    }
  };
  visit(dir);
  return files;
}

export function relative(file) {
  return path.relative(rootDir, file);
}

export function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = row[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export async function validateRegistry() {
  const registry = await loadRegistry();
  const schema = await loadSourceSchema();
  const rights = await loadRightsTaxonomy();
  const allowedRights = new Set(rights.redistribution_statuses.map((entry) => entry.id));
  const allowedSchemaRights = new Set(schema.allowed_redistribution_statuses);
  const allowedIngestStatuses = new Set(schema.allowed_ingest_statuses);
  const errors = [];

  if (!Array.isArray(registry.sources)) {
    errors.push("source-registry.json must contain a sources array.");
    return { registry, errors };
  }

  const ids = new Set();
  for (const [index, source] of registry.sources.entries()) {
    const label = source.source_id ?? `source at index ${index}`;
    for (const field of schema.required_fields) {
      if (!(field in source)) {
        errors.push(`${label}: missing required field ${field}`);
      }
    }
    for (const field of schema.array_fields) {
      if (!Array.isArray(source[field])) {
        errors.push(`${label}: ${field} must be an array`);
      }
    }
    for (const field of schema.date_fields) {
      if (source[field] && !/^\d{4}-\d{2}-\d{2}$/.test(source[field])) {
        errors.push(`${label}: ${field} must be YYYY-MM-DD`);
      }
    }
    if (ids.has(source.source_id)) {
      errors.push(`${label}: duplicate source_id`);
    }
    ids.add(source.source_id);
    if (!allowedRights.has(source.redistribution_status)) {
      errors.push(`${label}: redistribution_status is not in rights-taxonomy.json`);
    }
    if (!allowedSchemaRights.has(source.redistribution_status)) {
      errors.push(`${label}: redistribution_status is not allowed by source registry schema`);
    }
    if (!allowedIngestStatuses.has(source.ingest_status)) {
      errors.push(`${label}: ingest_status is not allowed by source registry schema`);
    }
    if (source.metadata_allowed !== true && source.full_text_allowed !== true && source.ingest_status !== "blocked") {
      errors.push(`${label}: non-blocked source should allow at least metadata or full text`);
    }
  }

  return { registry, errors };
}

export function tableAvailability() {
  const expected = [
    "works.parquet",
    "authors.parquet",
    "institutions.parquet",
    "venues.parquet",
    "departments.parquet",
    "collections.parquet",
    "objects.parquet",
    "pages.parquet",
    "citations.parquet",
    "topics.parquet",
    "source_documents.parquet",
    "rights.parquet",
  ];
  return expected.map((file) => {
    const full = path.join(processedDir, file);
    return {
      file,
      path: relative(full),
      exists: existsSync(full),
      bytes: existsSync(full) ? statSync(full).size : 0,
    };
  });
}

export function processedStagingAvailability() {
  const expected = [
    "works.jsonl",
    "authors.jsonl",
    "institutions.jsonl",
    "venues.jsonl",
    "collections.jsonl",
    "objects.jsonl",
    "pages.jsonl",
    "departments.jsonl",
    "citations.jsonl",
    "topics.jsonl",
    "source_documents.jsonl",
    "rights.jsonl",
  ];
  return expected.map((file) => {
    const full = path.join(processedDir, file);
    return {
      file,
      path: relative(full),
      exists: existsSync(full),
      bytes: existsSync(full) ? statSync(full).size : 0,
    };
  });
}

export function analyticalAvailability() {
  const expected = [
    "works.csv",
    "works.parquet",
    "objects.csv",
    "objects.parquet",
    "pages.csv",
    "pages.parquet",
    "departments.csv",
    "departments.parquet",
    "authors.csv",
    "authors.parquet",
    "institutions.csv",
    "institutions.parquet",
    "venues.csv",
    "venues.parquet",
    "collections.csv",
    "collections.parquet",
    "citations.csv",
    "citations.parquet",
    "topics.csv",
    "topics.parquet",
    "source_documents.csv",
    "source_documents.parquet",
    "rights.csv",
    "rights.parquet",
    "knowledge-base.sqlite",
  ];
  return expected.map((file) => {
    const full = path.join(processedDir, file);
    return {
      file,
      path: relative(full),
      exists: existsSync(full),
      bytes: existsSync(full) ? statSync(full).size : 0,
    };
  });
}

export function sourceFreshness(sources, now = new Date()) {
  const staleAfterDays = {
    monthly: 45,
    quarterly: 120,
    annual: 430,
    "manual-review": 365,
    "on-demand": 365,
  };
  return sources.map((source) => {
    const checked = new Date(`${source.last_checked_at}T00:00:00Z`);
    const ageDays = Number.isFinite(checked.getTime())
      ? Math.floor((now.getTime() - checked.getTime()) / 86_400_000)
      : null;
    const threshold = staleAfterDays[source.update_cadence] ?? 120;
    return {
      source_id: source.source_id,
      update_cadence: source.update_cadence,
      last_checked_at: source.last_checked_at,
      age_days: ageDays,
      stale: ageDays == null ? true : ageDays > threshold,
    };
  });
}

export function firstJson(pathname) {
  if (!existsSync(pathname)) return null;
  try {
    return JSON.parse(readdirSync(pathname));
  } catch {
    return null;
  }
}
