// Phase 4 step 2: mention extraction over the harvested ChronAm pilot pool.
// snippet -> house-number candidate (regex, precision-first) -> PAD geocode (parity)
// -> local-LLM verification (llama3.2:3b, evidence-only) -> SIDE TABLE + human audit sheet.
// Mentions do NOT enter events until a human audit of this sheet shows >= 90% precision.
//
//   node --experimental-sqlite src/chronam-extract.mjs
import fs from 'node:fs';
import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { config } from './config.mjs';

const MODEL = process.env.DOSSIER_MODEL ?? 'llama3.2:3b';
const CAND_RE = /(\d{1,4})\s*(?:-\s*\d{1,4}\s*)?(?:West|W\.?)\s*,?\s*125th\s*(?:St(?:reet)?)?/gi;

async function llmVerify(snippet, house) {
  const prompt = `Newspaper OCR text (noisy):
"""${snippet}"""
Question: Does this text refer to something located at ${house} West 125th Street in New York City (a business, event, property, or person AT that address)? Reply with exactly YES or NO, then a dash and a reason under 10 words.`;
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0 } }),
  });
  if (!res.ok) return { verdict: 'ERROR', reason: `ollama ${res.status}` };
  const out = (await res.json()).response.trim();
  return { verdict: /^YES/i.test(out) ? 'YES' : /^NO/i.test(out) ? 'NO' : 'UNCLEAR', reason: out.slice(0, 120) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAGE_CAP = Number(process.env.CHRONAM_PAGES ?? 30);

// The search API's snippet is rarely the matching passage; fetch the page's real OCR
// via the fulltext_service URL exposed in the resource JSON. Cached to disk.
async function getWithRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90000);
      const res = await fetch(url, { headers: { 'User-Agent': config.userAgent }, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) { await sleep(15000 * (i + 1)); continue; }
      if (!res.ok) return null;
      return await res.text();
    } catch { await sleep(10000 * (i + 1)); }
  }
  return null;
}

async function fetchPageText(pageUrl, cacheDir) {
  const key = pageUrl.replace(/[^a-z0-9]+/gi, '_').slice(-80) + '.txt';
  const cachePath = path.join(cacheDir, key);
  if (fs.existsSync(cachePath)) return fs.readFileSync(cachePath, 'utf8');
  await sleep(3000);
  const meta = await getWithRetry(`${pageUrl}${pageUrl.includes('?') ? '&' : '?'}fo=json`);
  if (!meta) return null;
  let svc;
  try { svc = JSON.parse(meta).fulltext_service; } catch { return null; }
  if (!svc) return null;
  await sleep(3000);
  const body = await getWithRetry(svc);
  if (!body) return null;
  // word-coordinates-service returns JSON keyed by segment path, with full_text inside.
  let text = '';
  try {
    const j = JSON.parse(body);
    text = Object.values(j)[0]?.full_text ?? '';
  } catch { text = [...body.matchAll(/CONTENT="([^"]*)"/g)].map((m) => m[1]).join(' '); }
  text = text.replace(/\s+/g, ' ');
  if (!text) return null;
  fs.writeFileSync(cachePath, text);
  return text;
}

async function main() {
  const dir = path.join(config.rawDir, 'chronam_pilot');
  const cacheDir = path.join(dir, 'pagetext');
  fs.mkdirSync(cacheDir, { recursive: true });
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  const records = files.flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8')
    .trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));

  // candidates from real page OCR (capped politely; precision-first)
  const cands = [];
  let fetched = 0;
  for (const r of records) {
    if (fetched >= PAGE_CAP) break;
    const text = await fetchPageText(r.page_url, cacheDir);
    fetched++;
    if (!text) continue;
    const seen = new Set();
    for (const m of text.matchAll(CAND_RE)) {
      const house = m[1];
      if (Number(house) < 1 || Number(house) > 600 || seen.has(house)) continue;
      seen.add(house);
      const ctx = text.slice(Math.max(0, m.index - 180), m.index + 180).replace(/\s+/g, ' ');
      cands.push({ ...r, house, snippet: ctx });
    }
    process.stdout.write(seen.size ? String(seen.size) : '.');
  }
  console.log(`\n${fetched} pages OCR-fetched -> ${cands.length} house-number candidates`);

  // geocode
  const instance = await DuckDBInstance.create(config.duckdbPath, { access_mode: 'READ_ONLY' });
  const db = await instance.connect();
  const geo = async (house) => {
    const p = await db.prepare(`SELECT bbl FROM pad_addresses
      WHERE boro = '1' AND upper(stname) = 'WEST 125 STREET'
        AND TRY_CAST(? AS BIGINT) BETWEEN TRY_CAST(lhnd AS BIGINT) AND TRY_CAST(hhnd AS BIGINT)
      ORDER BY (TRY_CAST(? AS BIGINT) % 2) = (TRY_CAST(lhnd AS BIGINT) % 2) DESC LIMIT 1`);
    p.bindVarchar(1, house); p.bindVarchar(2, house);
    const rows = (await p.runAndReadAll()).getRows();
    return rows[0]?.[0] ?? null;
  };

  const out = [];
  for (const c of cands) {
    const bbl = await geo(c.house);
    const v = bbl ? await llmVerify(c.snippet, c.house) : { verdict: 'NO_GEOCODE', reason: 'no PAD match' };
    out.push({ date: c.date, paper: c.paper, page_url: c.page_url, house: c.house, bbl, ...v, snippet: c.snippet });
    process.stdout.write(v.verdict === 'YES' ? '+' : '.');
  }
  db.closeSync();
  console.log();

  const outPath = path.join(config.dataDir, 'derived', 'chronam-mentions.jsonl');
  fs.writeFileSync(outPath, out.map((o) => JSON.stringify(o)).join('\n') + '\n');

  const yes = out.filter((o) => o.verdict === 'YES');
  const sheet = `# ChronAm mention audit sheet — West 125th Street pilot

_Generated ${new Date().toISOString()} · model ${MODEL} · ${records.length} page hits, ${cands.length} candidates, ${yes.length} LLM-verified_

**Protocol:** a human marks each row ✓ (mention is real and at this address) or ✗.
Gate: >= 90% of LLM-YES rows marked ✓ before any mention enters dossier events.

| # | date | paper | candidate | BBL | LLM | human | snippet (truncated) |
|---|---|---|---|---|---|---|---|
${out.slice(0, 200).map((o, i) =>
  `| ${i + 1} | ${o.date} | ${(o.paper ?? '').slice(0, 28)} | ${o.house} W 125th | ${o.bbl ?? '—'} | ${o.verdict} |  | ${(o.snippet ?? '').slice(0, 110).replace(/\|/g, '/')} |`).join('\n')}

Candidates: \`${outPath}\` (side table — NOT in events).
LLM-YES rate: ${(100 * yes.length / Math.max(cands.length, 1)).toFixed(1)}% of candidates; geocode rate ${(100 * out.filter((o) => o.bbl).length / Math.max(cands.length, 1)).toFixed(1)}%.
`;
  const sheetPath = path.join(config.root, 'reports', 'chronam-audit-sheet.md');
  fs.writeFileSync(sheetPath, sheet);
  console.log(`candidates: ${cands.length} · geocoded: ${out.filter((o) => o.bbl).length} · LLM YES: ${yes.length}`);
  console.log(`audit sheet: ${sheetPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
