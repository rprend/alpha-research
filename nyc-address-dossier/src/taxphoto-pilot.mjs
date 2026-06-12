// Phase 1 PILOT: 1940 tax photos for a handful of lots, per the plan's sanctioned
// fallback ("per-image fetch for the pilot only"). HARD CAP of 10 lots per run —
// bulk access goes through the DORIS ask, full stop. Photos resolved via the
// open-source 1940s.nyc API (identifiers are BBL-derived: nynyma_rec0040_B_BLOCK_LOT);
// credit and links go to 1940s.nyc and the NYC Municipal Archives.
//
//   node --experimental-sqlite src/taxphoto-pilot.mjs 1019310010 1017240004 1008350041
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';

const CAP = 10;
const bbls = process.argv.slice(2).slice(0, CAP);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function identifierFor(bbl) {
  const s = String(bbl);
  return `nynyma_rec0040_${s[0]}_${s.slice(1, 6)}_${s.slice(6)}`;
}

async function main() {
  if (!bbls.length) { console.error('usage: taxphoto-pilot.mjs <bbl> [bbl...]  (max 10)'); process.exit(1); }
  const dir = path.join(config.rawDir, 'taxphotos_1940');
  fs.mkdirSync(dir, { recursive: true });
  const metaPath = path.join(dir, 'photos.jsonl');
  const existing = new Set(fs.existsSync(metaPath)
    ? fs.readFileSync(metaPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l).bbl) : []);

  for (const bbl of bbls) {
    if (existing.has(bbl)) { console.log(`${bbl}: already fetched`); continue; }
    const id = identifierFor(bbl);
    await sleep(3000); // polite to a personal project's infra
    const meta = await fetch(`https://api.1940s.nyc/photos/${id}`, {
      headers: { 'User-Agent': config.userAgent } });
    if (!meta.ok) { console.log(`${bbl}: no 1940 photo record (HTTP ${meta.status})`); continue; }
    const m = await meta.json();
    const jpgUrl = `https://photos.1940s.nyc/jpg/${id}.jpg`;
    await sleep(3000);
    const img = await fetch(jpgUrl, { headers: { 'User-Agent': config.userAgent } });
    if (!img.ok) { console.log(`${bbl}: image fetch failed (HTTP ${img.status})`); continue; }
    fs.writeFileSync(path.join(dir, `${id}.jpg`), Buffer.from(await img.arrayBuffer()));
    fs.appendFileSync(metaPath, JSON.stringify({
      bbl, identifier: id, address: m.address, borough: m.borough,
      photo_url: jpgUrl, page_url: `https://1940s.nyc/map/photo/${id}`,
      credit: '1940 NYC Municipal Archives tax photo, via 1940s.nyc (Julian Boilen)',
    }) + '\n');
    console.log(`${bbl}: ${m.address} -> ${id}.jpg`);
  }
  console.log('done. run materialize to fold into events.');
}

main().catch((e) => { console.error(e); process.exit(1); });
