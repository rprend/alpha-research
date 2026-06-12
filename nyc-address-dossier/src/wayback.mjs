// Phase 6: Wayback Machine layer. Given a domain + its address, pull the CDX snapshot
// history (collapsed to one per year) and store it as raw rows keyed to the BBL; the
// materializer maps them to 'mention'/web_snapshot events.
//
//   node --experimental-sqlite src/wayback.mjs apollotheater.org "253 W 125 STREET" manhattan
//
// Scaling note: the name->domain resolution step is curated/manual by design — guessing
// domains from business names is precision-poison. Add targets one by one or from a
// vetted list; the harvester never crawls for domains.
import fs from 'node:fs';
import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { config } from './config.mjs';
import { parseAddress } from './lookup.mjs';

const [domain, addr, boroArg] = process.argv.slice(2);

async function main() {
  if (!domain || !addr) { console.error('usage: wayback.mjs <domain> "<house> <street>" [borough]'); process.exit(1); }
  // Resolve the address to a BBL (read-only against the dossier db).
  const parsed = parseAddress(addr, boroArg);
  if (!parsed) { console.error('unparseable address'); process.exit(1); }
  const instance = await DuckDBInstance.create(config.duckdbPath, { access_mode: 'READ_ONLY' });
  const db = await instance.connect();
  const prepared = await db.prepare(`SELECT bbl FROM pad_addresses
    WHERE boro = ? AND upper(stname) = ?
      AND TRY_CAST(? AS BIGINT) BETWEEN TRY_CAST(lhnd AS BIGINT) AND TRY_CAST(hhnd AS BIGINT)
      AND (TRY_CAST(? AS BIGINT) % 2) = (TRY_CAST(lhnd AS BIGINT) % 2)  -- house-number parity (street side)
    LIMIT 1`);
  [parsed.boro, parsed.street, parsed.house, parsed.house].forEach((p, i) => prepared.bindVarchar(i + 1, p));
  const rows = (await prepared.runAndReadAll()).getRows();
  db.closeSync();
  if (!rows.length) { console.error(`no BBL for "${addr}"`); process.exit(1); }
  const bbl = rows[0][0];
  console.log(`${addr} -> BBL ${bbl}`);

  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}`
    + `&output=json&fl=timestamp,original,statuscode&filter=statuscode:200&collapse=timestamp:4`;
  let data;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(cdxUrl, { headers: { 'User-Agent': config.userAgent } });
    if (res.ok) { data = await res.json(); break; }
    if (attempt >= 4) throw new Error(`CDX HTTP ${res.status} after ${attempt} attempts`);
    console.log(`CDX HTTP ${res.status}, retrying in ${10 * attempt}s...`);
    await new Promise((r) => setTimeout(r, 10000 * attempt));
  }
  const snaps = data.slice(1); // first row is the header
  const dir = path.join(config.rawDir, 'wayback');
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${domain.replace(/[^a-z0-9.-]/gi, '_')}.jsonl`);
  const lines = snaps.map(([ts, original]) => JSON.stringify({
    bbl, domain, address_raw: addr.toUpperCase(),
    year: ts.slice(0, 4), timestamp: ts,
    snapshot_url: `https://web.archive.org/web/${ts}/${original}`,
  }));
  fs.writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`${snaps.length} yearly snapshots (${snaps[0]?.[0]?.slice(0, 4)}–${snaps.at(-1)?.[0]?.slice(0, 4)}) -> ${outPath}`);
  console.log('run materialize to fold into events');
}

main().catch((e) => { console.error(e); process.exit(1); });
