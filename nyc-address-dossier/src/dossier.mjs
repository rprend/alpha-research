// Dossier v0 lookup CLI: address -> BBL -> cited event timeline.
//   node --experimental-sqlite src/dossier.mjs "350 5 AVENUE" manhattan
//   node --experimental-sqlite src/dossier.mjs --bbl 1008350041
import { DuckDBInstance } from '@duckdb/node-api';
import { config } from './config.mjs';

const BORO = { manhattan: '1', mn: '1', bronx: '2', bx: '2', brooklyn: '3', bk: '3', queens: '4', qn: '4', 'staten island': '5', si: '5' };
const ORDINALS = { first: '1', second: '2', third: '3', fourth: '4', fifth: '5', sixth: '6', seventh: '7', eighth: '8', ninth: '9', tenth: '10', eleventh: '11', twelfth: '12' };

function normalizeStreet(s) {
  let t = s.toUpperCase().trim()
    .replace(/\b(\d+)(ST|ND|RD|TH)\b/g, '$1')
    .replace(/\bAVE\.?\b/g, 'AVENUE').replace(/\bST\.?\b/g, 'STREET')
    .replace(/\bBLVD\.?\b/g, 'BOULEVARD').replace(/\bRD\.?\b/g, 'ROAD')
    .replace(/\bPL\.?\b/g, 'PLACE').replace(/\bPKWY\.?\b/g, 'PARKWAY')
    .replace(/\bE\.?\b/g, 'EAST').replace(/\bW\.?\b/g, 'WEST')
    .replace(/\s+/g, ' ');
  for (const [word, num] of Object.entries(ORDINALS)) {
    t = t.replace(new RegExp(`\\b${word.toUpperCase()}\\b`, 'g'), num);
  }
  return t;
}

async function main() {
  const args = process.argv.slice(2);
  const instance = await DuckDBInstance.create(config.duckdbPath);
  const db = await instance.connect();
  const q = async (sql, params = []) => {
    const prepared = await db.prepare(sql);
    params.forEach((p, i) => prepared.bindVarchar(i + 1, p));
    return (await prepared.run()).getRows();
  };

  let bbls = [];
  if (args[0] === '--bbl') {
    bbls = [[args[1], '(direct BBL)']];
  } else {
    const addr = args[0] ?? '';
    const boroArg = (args[1] ?? 'manhattan').toLowerCase();
    const boro = BORO[boroArg] ?? '1';
    const m = addr.match(/^\s*([\d-]+)\s+(.+)$/);
    if (!m) { console.error('usage: dossier.mjs "<house> <street>" [borough] | --bbl <bbl>'); process.exit(1); }
    const house = m[1];
    const street = normalizeStreet(m[2]);
    // PAD range match first, PLUTO exact-string fallback.
    try {
      bbls = await q(`SELECT DISTINCT bbl, lhnd || '-' || hhnd || ' ' || stname
        FROM pad_addresses
        WHERE boro = ? AND upper(trim(stname)) = ?
          AND TRY_CAST(? AS BIGINT) BETWEEN TRY_CAST(lhnd AS BIGINT) AND TRY_CAST(hhnd AS BIGINT)
        LIMIT 5`, [boro, street, house]);
    } catch { /* pad not landed yet */ }
    if (bbls.length === 0) {
      try {
        bbls = await q(`SELECT bbl, address FROM lots
          WHERE upper(trim(address)) = ? AND substr(bbl, 1, 1) = ? LIMIT 5`,
          [`${house} ${street}`, boro]);
      } catch { /* pluto not landed yet */ }
    }
    if (bbls.length === 0) { console.log(`No BBL found for "${house} ${street}" (boro ${boro}). Sources may still be downloading.`); process.exit(0); }
  }

  for (const [bbl, label] of bbls) {
    console.log(`\n━━━ BBL ${bbl}  ${label ?? ''} ━━━`);
    try {
      const lot = await q(`SELECT address, yearbuilt, bldgclass, unitsres, ownername FROM lots WHERE bbl = ?`, [bbl]);
      if (lot.length) {
        const [address, yearbuilt, bldgclass, unitsres, ownername] = lot[0];
        console.log(`${address} · built ${yearbuilt} · class ${bldgclass} · ${unitsres} res units · owner (PLUTO): ${ownername}`);
      }
    } catch { /* lots table absent until pluto lands */ }
    const events = await q(`SELECT date_start, kind, source_id, CAST(payload AS VARCHAR)
      FROM events WHERE bbl = ? AND date_start IS NOT NULL
      ORDER BY date_start ASC`, [bbl]);
    if (events.length === 0) { console.log('  (no events yet — harvest still in progress)'); continue; }
    for (const [date, kind, source, payload] of events) {
      const p = JSON.parse(payload);
      const desc = Object.entries(p).filter(([k]) => k !== 'type')
        .map(([k, v]) => `${k}=${String(v).slice(0, 60)}`).join(' ');
      console.log(`  ${String(date).slice(0, 10)}  [${kind}/${p.type ?? '?'}] ${desc}  ←${source}`);
    }
    console.log(`  ${events.length} events total`);
  }
  db.closeSync();
}

main().catch((e) => { console.error(e); process.exit(1); });
