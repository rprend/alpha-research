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

export function toCsv(rows, columns) {
  const escape = (value) => {
    const text = value == null ? "" : Array.isArray(value) ? value.join("; ") : String(value);
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
