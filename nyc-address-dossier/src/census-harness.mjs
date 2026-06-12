// Phase 2: census roster extraction harness — MOCK MODE ONLY until the gold gate passes.
// House rule: build the harness with canned responses first; no model spend without a
// hand-labeled gold set (two annotators, adjudicated, kappa reported) and explicit approval.
//
//   node --experimental-sqlite src/census-harness.mjs --mock          run mock extraction on fixtures
//   node --experimental-sqlite src/census-harness.mjs --eval          score extracted vs gold
//
// The extraction contract (what a local VLM must produce per ED page image):
//   { page_id, rows: [{ line, name, relation, age, occupation, address }] }
// Gold files use the same schema in gold/<page_id>.json; extracted in extracted/<page_id>.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'census');
const dirs = { fixtures: path.join(HARNESS_DIR, 'fixtures'), gold: path.join(HARNESS_DIR, 'gold'), extracted: path.join(HARNESS_DIR, 'extracted') };

function mockExtract(fixture) {
  // Canned extractor: in real mode this is a local-VLM call on the page image.
  // The mock deliberately drops one row and garbles one name so --eval shows non-trivial scores.
  const rows = fixture.rows.slice(0, -1).map((r, i) => i === 1 ? { ...r, name: r.name.replace(/a/g, 'o') } : r);
  return { page_id: fixture.page_id, rows, extractor: 'mock-v0' };
}

function nameKey(s) { return s.toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim(); }

function evaluate(goldDoc, extDoc) {
  const gold = new Set(goldDoc.rows.map((r) => nameKey(r.name)));
  const ext = new Set(extDoc.rows.map((r) => nameKey(r.name)));
  const tp = [...ext].filter((n) => gold.has(n)).length;
  return {
    page_id: goldDoc.page_id,
    gold_rows: gold.size, extracted_rows: ext.size, matched: tp,
    name_recall: tp / Math.max(gold.size, 1),
    name_precision: tp / Math.max(ext.size, 1),
  };
}

const mode = process.argv[2];
for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });

if (mode === '--mock') {
  const fixtures = fs.readdirSync(dirs.fixtures).filter((f) => f.endsWith('.json'));
  if (!fixtures.length) { console.log('no fixtures — see census/README.md'); process.exit(1); }
  for (const f of fixtures) {
    const fixture = JSON.parse(fs.readFileSync(path.join(dirs.fixtures, f), 'utf8'));
    const out = mockExtract(fixture);
    fs.writeFileSync(path.join(dirs.extracted, f), JSON.stringify(out, null, 1));
    console.log(`mock-extracted ${fixture.page_id}: ${out.rows.length} rows`);
  }
} else if (mode === '--eval') {
  const reports = [];
  for (const f of fs.readdirSync(dirs.gold).filter((f) => f.endsWith('.json'))) {
    const extPath = path.join(dirs.extracted, f);
    if (!fs.existsSync(extPath)) { console.log(`SKIP ${f}: no extraction`); continue; }
    const r = evaluate(JSON.parse(fs.readFileSync(path.join(dirs.gold, f), 'utf8')),
                       JSON.parse(fs.readFileSync(extPath, 'utf8')));
    reports.push(r);
    console.log(`${r.page_id}: recall ${(r.name_recall * 100).toFixed(1)}% precision ${(r.name_precision * 100).toFixed(1)}% (${r.matched}/${r.gold_rows})`);
  }
  if (reports.length) {
    const recall = reports.reduce((s, r) => s + r.name_recall, 0) / reports.length;
    console.log(`\nMEAN name-recall ${(recall * 100).toFixed(1)}% across ${reports.length} pages — plan gate: >= 95% before scaling beyond pilot.`);
  }
} else {
  console.log('usage: census-harness.mjs --mock | --eval');
}
