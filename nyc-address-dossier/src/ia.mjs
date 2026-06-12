// Internet Archive acquisition (Phase 3 step 1): inventory the NYPL-scanned NYC city
// directories, then download each volume's existing OCR text (djvu.txt). Free, polite,
// and the cheap-first strategy from the plan: parse IA's own OCR before any re-OCR.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { config } from './config.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IA_SPACING_MS = 4000; // be extra gentle with archive.org
let lastIaRequest = 0;
async function iaDelay() {
  const wait = lastIaRequest + IA_SPACING_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastIaRequest = Date.now();
}

const INVENTORY_QUERY =
  'collection:(newyorkpubliclibrary) AND mediatype:(texts) AND ' +
  '(title:("city directory") OR title:(Trow) OR title:(Doggett) OR title:(Longworth) OR title:(Phillips))';

export async function runInventory(db, log) {
  const params = new URLSearchParams({
    q: INVENTORY_QUERY,
    output: 'json',
    rows: '3000',
    page: '1',
  });
  for (const f of ['identifier', 'title', 'year', 'imagecount']) params.append('fl[]', f);
  await iaDelay();
  const res = await fetch(`https://archive.org/advancedsearch.php?${params}`, {
    headers: { 'User-Agent': config.userAgent },
  });
  if (!res.ok) throw new Error(`IA advancedsearch HTTP ${res.status}`);
  const json = await res.json();
  const docs = json?.response?.docs ?? [];
  const dir = path.join(config.rawDir, 'ia_inventory');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'inventory.json'), JSON.stringify(docs, null, 1));

  // Keep volumes that look like NYC general directories; spawn one ia_text job each.
  const keep = docs.filter((d) =>
    /director/i.test(d.title ?? '') && /new.?york|brooklyn/i.test(JSON.stringify(d.title ?? '')));
  let added = 0;
  const ins = db.prepare(`INSERT OR IGNORE INTO jobs (source, kind, priority, created_at, updated_at)
    VALUES (?, 'ia_text', 60, ?, ?)`);
  for (const d of keep) {
    const r = ins.run(`ia_text:${d.identifier}`, Date.now(), Date.now());
    added += r.changes;
  }
  log(db, 'info', 'ia_inventory',
    `inventory: ${docs.length} candidates, ${keep.length} kept, ${added} new ia_text jobs spawned`);
  return { found: docs.length, kept: keep.length, added };
}

export async function fetchIAText(identifier) {
  const dir = path.join(config.rawDir, 'ia_directories');
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${identifier}.txt.gz`);
  if (fs.existsSync(outPath)) return { bytes: fs.statSync(outPath).size, cached: true };
  await iaDelay();
  const url = `https://archive.org/download/${identifier}/${identifier}_djvu.txt`;
  const res = await fetch(url, { headers: { 'User-Agent': config.userAgent }, redirect: 'follow' });
  if (res.status === 404) return { missing: true }; // some items have no OCR text — terminal, not retryable
  if (!res.ok) throw new Error(`IA HTTP ${res.status} for ${identifier}`);
  const text = Buffer.from(await res.arrayBuffer());
  const tmp = outPath + '.tmp';
  fs.writeFileSync(tmp, zlib.gzipSync(text, { level: 6 }));
  fs.renameSync(tmp, outPath);
  return { bytes: text.length };
}
