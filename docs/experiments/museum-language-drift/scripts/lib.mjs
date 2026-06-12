import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const experimentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeText(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, value);
}

export function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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

export function countTerms(text, families) {
  const lower = text.toLowerCase();
  const rows = [];
  for (const [family, terms] of Object.entries(families)) {
    let count = 0;
    const matchedTerms = [];
    for (const term of terms) {
      const pattern = new RegExp(`\\b${escapeRegExp(term.toLowerCase())}\\b`, "g");
      const matches = lower.match(pattern) ?? [];
      if (matches.length) matchedTerms.push(term);
      count += matches.length;
    }
    rows.push({ family, count, matchedTerms });
  }
  return rows;
}

export function snippets(text, terms, radius = 120) {
  const lower = text.toLowerCase();
  const out = [];
  for (const term of terms) {
    const index = lower.indexOf(term.toLowerCase());
    if (index === -1) continue;
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + term.length + radius);
    out.push(text.slice(start, end).replace(/\s+/g, " ").trim());
  }
  return [...new Set(out)].slice(0, 5);
}

export function toCsv(rows, columns) {
  const escape = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${[columns.join(","), ...rows.map((row) => columns.map((col) => escape(row[col])).join(","))].join("\n")}\n`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
