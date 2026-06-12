// Phase 7: ask-the-address. Rule-based question answering over the dossier — deterministic,
// every answer cites event rows, refuses beyond the evidence (the plan's requirement).
//
//   node --experimental-sqlite src/ask.mjs "who owns 253 W 125 St in manhattan"
//   node --experimental-sqlite src/ask.mjs "when was 350 5 avenue built"
//   node --experimental-sqlite src/ask.mjs "what happened at 253 W 125 street in the 1990s"
import { DuckDBInstance } from '@duckdb/node-api';
import { config } from './config.mjs';
import { parseAddress, BORO } from './lookup.mjs';

const Q = process.argv.slice(2).join(' ');

function extractAddress(text) {
  const boroWord = Object.keys(BORO).find((b) => text.toLowerCase().includes(b)) ?? 'manhattan';
  const m = text.match(/(\d[\d-]*)\s+((?:[A-Za-z0-9]+\.?\s+){0,3}(?:st(?:reet)?|ave(?:nue)?|pl(?:ace)?|road|rd|blvd|boulevard|broadway|bowery|pkwy|parkway|drive|dr|court|ct|lane|la|terrace|sq(?:uare)?)\b\.?)/i);
  if (!m) return null;
  return { addr: `${m[1]} ${m[2]}`, boro: boroWord };
}

async function main() {
  if (!Q) { console.error('usage: ask.mjs "<question containing an address>"'); process.exit(1); }
  const found = extractAddress(Q);
  if (!found) { console.log(`I can't find an address in that question. Include one like "253 W 125 Street".`); return; }
  const parsed = parseAddress(found.addr, found.boro);
  const instance = await DuckDBInstance.create(config.duckdbPath, { access_mode: 'READ_ONLY' });
  const db = await instance.connect();
  const q = async (sql, params = []) => {
    const p = await db.prepare(sql);
    params.forEach((v, i) => p.bindVarchar(i + 1, String(v)));
    return (await p.runAndReadAll()).getRowObjects();
  };
  const hit = (await q(`SELECT bbl FROM pad_addresses
    WHERE boro = ? AND upper(stname) = ?
      AND TRY_CAST(? AS BIGINT) BETWEEN TRY_CAST(lhnd AS BIGINT) AND TRY_CAST(hhnd AS BIGINT)
    ORDER BY (TRY_CAST(? AS BIGINT) % 2) = (TRY_CAST(lhnd AS BIGINT) % 2) DESC LIMIT 1`,
    [parsed.boro, parsed.street, parsed.house, parsed.house]))[0];
  if (!hit) { console.log(`No BBL found for "${found.addr}" (${found.boro}).`); return; }
  const bbl = hit.bbl;
  const ql = Q.toLowerCase();
  const cite = (e) => `[${e.source_id}:${e.locator ?? e.date}]`;
  const rows = (sql, p) => q(sql, p);

  console.log(`(${found.addr.toUpperCase()}, ${found.boro} -> BBL ${bbl})\n`);

  const yearM = ql.match(/\b(18|19|20)\d{2}\b/);
  const decadeM = ql.match(/\b((?:18|19|20)\d0)s\b/);

  if (/\bbuilt\b|\bbuild\b|how old/.test(ql)) {
    const r = await rows(`SELECT CAST(payload AS VARCHAR) AS p, source_id, locator FROM events
      WHERE bbl = ? AND json_extract_string(payload, '$.type') = 'year_built' LIMIT 1`, [bbl]);
    if (r.length) console.log(`Built around ${JSON.parse(r[0].p).year} [${r[0].source_id}:${r[0].locator}].`);
    else console.log(`No construction date in the harvested record for this lot.`);
  } else if (/who own|owner|owned/.test(ql)) {
    const lot = (await rows(`SELECT ownername FROM lots WHERE bbl = ?`, [bbl]))[0];
    if (yearM) {
      const r = await rows(`SELECT CAST(date_start AS VARCHAR) AS date, kind, source_id, locator, CAST(payload AS VARCHAR) AS p
        FROM events WHERE bbl = ? AND kind = 'ownership' AND date_start <= ?
        ORDER BY date_start DESC LIMIT 3`, [bbl, `${yearM[0]}-12-31`]);
      if (r.length === 0) console.log(`No ownership record on or before ${yearM[0]} has been harvested for this lot (pre-1966 deeds are a later phase).`);
      else for (const e of r) {
        const p = JSON.parse(e.p);
        console.log(`As of ${e.date.slice(0, 10)}: ${p.party2 ?? p.type === 'sale' ? `sale recorded${p.price ? ` for $${Number(p.price).toLocaleString()}` : ''}` : JSON.stringify(p)} ${cite(e)}`);
      }
    } else if (lot?.ownername) {
      console.log(`Current owner per the tax roll: ${lot.ownername} [pluto:${bbl}].`);
    } else console.log(`No current owner recorded.`);
  } else if (/photo|picture|image/.test(ql)) {
    const r = await rows(`SELECT CAST(date_start AS VARCHAR) AS date, source_id, locator, CAST(payload AS VARCHAR) AS p
      FROM events WHERE bbl = ? AND kind = 'photo' ORDER BY date_start`, [bbl]);
    if (!r.length) console.log(`No archival photos assigned to this lot yet — the citywide floor is the aerial series (1924–2018) and, once DORIS access lands, the 1940 + 1980s tax photos.`);
    for (const e of r) { const p = JSON.parse(e.p); console.log(`${e.date.slice(0, 4)}: ${p.title ?? 'photo'} — ${p.photo_url} ${cite(e)}`); }
  } else if (/business|shop|store|restaurant/.test(ql)) {
    const r = await rows(`SELECT CAST(date_start AS VARCHAR) AS date, source_id, locator, CAST(payload AS VARCHAR) AS p
      FROM events WHERE bbl = ? AND kind = 'commerce' ORDER BY date_start`, [bbl]);
    if (!r.length) console.log(`No licensed businesses or inspections recorded at this lot in the harvested span (mostly 1990s-present).`);
    const seen = new Set();
    for (const e of r) {
      const p = JSON.parse(e.p);
      if (p.name && !seen.has(p.name)) { seen.add(p.name); console.log(`${e.date.slice(0, 10)}: ${p.name}${p.cuisine ? ` (${p.cuisine})` : ''}${p.category ? ` (${p.category})` : ''} ${cite(e)}`); }
    }
  } else if (decadeM || /what happened|history/.test(ql)) {
    const d0 = decadeM ? `${decadeM[1]}-01-01` : '1600-01-01';
    const d1 = decadeM ? `${Number(decadeM[1]) + 9}-12-31` : '2100-01-01';
    const r = await rows(`SELECT kind, COUNT(*) AS n, MIN(CAST(date_start AS VARCHAR)) AS first, MAX(CAST(date_start AS VARCHAR)) AS last
      FROM events WHERE bbl = ? AND date_start BETWEEN ? AND ? GROUP BY kind ORDER BY n DESC`, [bbl, d0, d1]);
    if (!r.length) { console.log(`Nothing in the harvested record for that period.`); }
    for (const e of r) console.log(`${e.kind}: ${Number(e.n).toLocaleString()} records (${e.first.slice(0, 10)} → ${e.last.slice(0, 10)})`);
    console.log(`\nFor the narrative: npm run story -- --bbl ${bbl}`);
  } else {
    console.log(`Question shapes I can answer (deterministically, with citations):
  when was <addr> built · who owns/owned <addr> [in YEAR] · photos of <addr>
  businesses at <addr> · what happened at <addr> in the <DECADE>s
Anything else needs the LLM layer (gated on local-model install).`);
  }
  db.closeSync();
}

main().catch((e) => { console.error(e); process.exit(1); });
