import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const experimentDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const defaultQueries = [
  "ai humanities",
  "digital humanities",
  "computational humanities",
  "cultural analytics",
  "distant reading",
  "stylometry",
  "reception history",
  "canon formation",
  "translation studies",
  "environmental humanities",
  "public history",
  "intellectual history",
  "book history",
  "archival studies",
  "museum studies",
  "classics",
  "literary studies",
  "philosophy",
  "religious studies",
  "history of ideas",
  "economic history culture",
];

export const taxonomy = {
  disciplines: [
    "literature",
    "history",
    "philosophy",
    "classics",
    "religious studies",
    "art history",
    "cultural studies",
    "digital humanities",
    "linguistics",
    "anthropology",
    "sociology",
    "economics",
    "political science",
  ],
  methods: [
    "close reading",
    "archival history",
    "philology",
    "intellectual history",
    "reception history",
    "canon",
    "translation",
    "cultural analytics",
    "stylometry",
    "network",
    "topic model",
    "gis",
    "spatial",
    "large language model",
    "llm",
    "bibliometric",
    "corpus",
  ],
  quantitativeSignals: [
    "dataset",
    "corpus",
    "network",
    "citation",
    "topic model",
    "embedding",
    "classification",
    "regression",
    "time series",
    "spatial",
    "metadata",
    "large language model",
    "llm",
    "computational",
    "quantitative",
  ],
};

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    args[key] = rest.length ? rest.join("=") : "true";
  }
  return args;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeText(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, value);
}

export async function appendJsonl(file, rows) {
  await ensureDir(path.dirname(file));
  const text = rows.map((row) => JSON.stringify(row)).join("\n");
  await fs.appendFile(file, text ? `${text}\n` : "");
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(dir, predicate = () => true) {
  const out = [];
  if (!(await pathExists(dir))) return out;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFiles(full, predicate)));
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out.sort();
}

export function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(rows, columns) {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(","));
  return `${[header, ...body].join("\n")}\n`;
}

export function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function stripTags(value) {
  return normalizeWhitespace(String(value ?? "").replace(/<[^>]+>/g, " "));
}

export function decodeXml(value) {
  return String(value ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

export function classifyWork(work) {
  const haystack = `${work.title ?? ""} ${work.abstract ?? ""} ${(work.concepts ?? []).join(" ")}`.toLowerCase();
  const labels = {
    disciplines: taxonomy.disciplines.filter((label) => haystack.includes(label)),
    methods: taxonomy.methods.filter((label) => haystack.includes(label)),
    quantitativeSignals: taxonomy.quantitativeSignals.filter((label) => haystack.includes(label)),
  };
  if (haystack.includes("distant reading")) labels.methods.push("distant reading");
  if (haystack.includes("digital humanities")) labels.disciplines.push("digital humanities");
  labels.disciplines = [...new Set(labels.disciplines)];
  labels.methods = [...new Set(labels.methods)];
  labels.quantitativeSignals = [...new Set(labels.quantitativeSignals)];
  return labels;
}

export function stableWorkId(work) {
  if (work.doi) return `doi:${work.doi.toLowerCase()}`;
  if (work.url) return `url:${work.url.toLowerCase()}`;
  return `title:${normalizeWhitespace(work.title).toLowerCase()}|${work.year ?? ""}`;
}

export async function writeManifest({ source, runDate, startedAt, finishedAt, requests, recordCount, errors }) {
  const manifestPath = path.join(experimentDir, "data", "raw", source, runDate, "manifest.json");
  await writeJson(manifestPath, {
    source,
    runDate,
    startedAt,
    finishedAt,
    recordCount,
    requestCount: requests.length,
    requests,
    errors,
  });
  return manifestPath;
}
