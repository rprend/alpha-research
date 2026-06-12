// Phase 4 pilot: Chronicling America mention harvest for the pilot corridor (125th St).
// Search-API based (no bulk batches needed at pilot scale); results land in a SIDE table
// (raw file), NOT in events — plan gate: mention precision >= 90% on an audit sample first.
//
//   node src/chronam-pilot.mjs            (defaults: "West 125th Street", 5 pages)
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';

const PHRASE = process.argv[2] ?? 'West 125th Street';
const MAX_PAGES = Number(process.argv[3] ?? 5);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dir = path.join(config.rawDir, 'chronam_pilot');
  fs.mkdirSync(dir, { recursive: true });
  const slug = PHRASE.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const outPath = path.join(dir, `${slug}.jsonl`);
  const out = fs.createWriteStream(outPath);
  let total = 0, fetched = 0;
  const byDecade = {};
  // LOC migrated Chronicling America to the loc.gov JSON API (legacy endpoint now 308/404s).
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({ q: `"${PHRASE}"`, fo: 'json', c: '50', sp: String(page) });
    const res = await fetch(
      `https://www.loc.gov/collections/chronicling-america/?${params}&fa=location_state:new+york`,
      { headers: { 'User-Agent': config.userAgent } });
    if (!res.ok) throw new Error(`ChronAm HTTP ${res.status}`);
    const j = await res.json();
    total = j.pagination?.of ?? 0;
    for (const it of j.results ?? []) {
      const rec = {
        phrase: PHRASE, lccn: it.number_lccn?.[0], paper: it.partof_title?.[0],
        date: it.date, page: it.number_page?.[0],
        page_url: it.id,
        snippet: (Array.isArray(it.description) ? it.description.join(' ') : it.description ?? '')
          .replace(/\s+/g, ' ').slice(0, 400),
      };
      out.write(JSON.stringify(rec) + '\n');
      fetched++;
      const dec = String(it.date ?? '').slice(0, 3) + '0s';
      byDecade[dec] = (byDecade[dec] ?? 0) + 1;
    }
    if ((j.results ?? []).length < 50) break;
    await sleep(3000); // polite
  }
  await new Promise((r) => out.end(r));

  const report = `# ChronAm pilot harvest — "${PHRASE}"

_Generated ${new Date().toISOString()}_

- Total matching pages in Chronicling America (NY papers): **${Number(total).toLocaleString()}**
- Fetched this run: ${fetched} page hits -> \`${outPath}\`
- By decade: ${Object.entries(byDecade).sort().map(([d, n]) => `${d}: ${n}`).join(' · ')}

These are page-level hits with OCR snippets — a mention CANDIDATE pool. Per the plan's
Phase 4 gate they stay out of dossier events until an audited extraction pass reaches
>= 90% precision (address-string -> era-gazetteer geocode + local-LLM verification).
The totalItems count is the scaling signal: the full corridor harvest is ~${Number(total).toLocaleString()}
pages via this API at ~3s spacing, or the bulk OCR batches for whole-city work.
`;
  const reportPath = path.join(config.root, 'reports', `chronam-pilot-${slug}.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report);
  console.log(report);
}

main().catch((e) => { console.error(e); process.exit(1); });
