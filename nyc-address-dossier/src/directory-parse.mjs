// Phase 3: city-directory OCR parser (v1, rules-based).
// Input: an IA djvu.txt volume. Output: parsed entries (JSONL) + a parse/geocode report.
// Per the plan's gate, parsed entries do NOT enter `events` until precision >= 95% on
// hand-labeled gold pages — this script produces the measurable artifact for that gate.
//
//   node --experimental-sqlite src/directory-parse.mjs \
//     --file ~/.nyc-address-dossier/data/raw/ia_directories/brooklynnewyorkc1912broo.txt \
//     --year 1912 --boro 3 --slug brooklyn-1912
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { DuckDBInstance } from '@duckdb/node-api';
import { config } from './config.mjs';
import { normalizeStreet } from './lookup.mjs';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map((s) => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ')]; }));
const FILE = args.file, YEAR = args.year ?? '?', BORO = args.boro ?? '3', SLUG = args.slug ?? 'sample';

// Directory abbreviations -> PAD-style street names. OCR noise is left as-is;
// geocode rate measures the damage honestly.
const SUFFIX = { av: 'AVENUE', ave: 'AVENUE', st: 'STREET', pl: 'PLACE', rd: 'ROAD', la: 'LANE', ct: 'COURT', ter: 'TERRACE', pkwy: 'PARKWAY', blvd: 'BOULEVARD', sq: 'SQUARE' };
const MARKERS = new Set(['h', 'b', 'r']); // home / boards / rooms

// A surname header: short line, no leading dash, mostly uppercase letters.
function isSurnameHeader(line) {
  const t = line.trim();
  if (!t || t.length > 40 || /^[—–\-■]/.test(t)) return false;
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-Z]/g, '');
  return upper.length / letters.length > 0.7;
}

// Entry: "—Given [M] occupation h 123 Street av"
const ENTRY_RE = /^[—–\-■]+\s*(.+)$/;
const ADDR_RE = /\b([0-9OIl][0-9OIl'\-]{0,5})\s+([A-Za-z0-9][A-Za-z0-9 .']{2,40})\s*$/;

function cleanHouseNumber(s) {
  const t = s.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/[^0-9\-]/g, '');
  return /^\d/.test(t) ? t : null;
}

function parseEntry(rest, surname) {
  const addrMatch = rest.match(ADDR_RE);
  if (!addrMatch) return null;
  const house = cleanHouseNumber(addrMatch[1]);
  if (!house) return null;
  let street = addrMatch[2].trim().replace(/\s+/g, ' ');
  // expand trailing suffix abbreviation
  const parts = street.split(' ');
  const last = parts[parts.length - 1].toLowerCase().replace(/\./g, '');
  if (SUFFIX[last]) { parts[parts.length - 1] = SUFFIX[last]; street = parts.join(' '); }
  const head = rest.slice(0, addrMatch.index).trim().replace(/\s+/g, ' ');
  const tokens = head.split(' ').filter(Boolean);
  let marker = null;
  if (tokens.length && MARKERS.has(tokens[tokens.length - 1].toLowerCase().replace(/\./g, ''))) {
    marker = tokens.pop().toLowerCase().replace(/\./g, '');
  }
  // given name = leading capitalized tokens (up to 3); rest = occupation
  const given = [];
  while (tokens.length && given.length < 3 && /^[A-Z]/.test(tokens[0])) given.push(tokens.shift());
  if (given.length === 0) return null;
  return {
    surname, given: given.join(' '), occupation: tokens.join(' ') || null,
    marker, house, street_raw: street, street_norm: normalizeStreet(street),
  };
}

async function main() {
  if (!FILE || !fs.existsSync(FILE)) { console.error('missing --file'); process.exit(1); }
  const outDir = path.join(config.dataDir, 'derived');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `directory-${SLUG}.jsonl`);
  const out = fs.createWriteStream(outPath);

  let surname = null, lines = 0, headers = 0, entryLines = 0, parsed = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(FILE), crlfDelay: Infinity });
  for await (const raw of rl) {
    lines++;
    const line = raw.trim();
    if (!line) continue;
    if (isSurnameHeader(line)) { surname = line.replace(/[^A-Za-z' ]/g, '').trim(); headers++; continue; }
    const m = line.match(ENTRY_RE);
    if (!m || !surname) continue;
    entryLines++;
    const e = parseEntry(m[1], surname);
    if (e) { parsed++; out.write(JSON.stringify({ ...e, year: YEAR, boro: BORO, line: lines }) + '\n'); }
  }
  await new Promise((r) => out.end(r));

  // Geocode sample against PAD (read-only on the dossier db).
  const instance = await DuckDBInstance.create(config.duckdbPath, { access_mode: 'READ_ONLY' });
  const db = await instance.connect();
  await db.run(`CREATE TEMP TABLE entries AS SELECT * FROM read_json('${outPath.replace(/'/g, "''")}', format='newline_delimited', union_by_name=true)`);
  const geo = await (await db.run(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE bbl IS NOT NULL) AS geocoded
    FROM (
      SELECT e.*, (SELECT p.bbl FROM pad_addresses p
        WHERE p.boro = e.boro AND upper(trim(p.stname)) = e.street_norm
          AND TRY_CAST(e.house AS BIGINT) BETWEEN TRY_CAST(p.lhnd AS BIGINT) AND TRY_CAST(p.hhnd AS BIGINT)
        LIMIT 1) AS bbl
      FROM entries e)`)).getRows();
  const [total, geocoded] = geo[0].map(Number);
  db.closeSync();

  const report = `# Directory parse report — ${SLUG}

_Generated ${new Date().toISOString()} · volume: ${path.basename(FILE)} · year ${YEAR} · boro ${BORO}_

| metric | value |
|---|---|
| OCR lines | ${lines.toLocaleString()} |
| surname headers detected | ${headers.toLocaleString()} |
| entry lines (dash-led under a surname) | ${entryLines.toLocaleString()} |
| entries parsed (name + address) | ${parsed.toLocaleString()} (${(100 * parsed / Math.max(entryLines, 1)).toFixed(1)}% of entry lines) |
| geocoded vs PAD (modern street + house range) | ${geocoded.toLocaleString()} / ${total.toLocaleString()} (${(100 * geocoded / Math.max(total, 1)).toFixed(1)}%) |

Parsed entries: \`${outPath}\` (not loaded into events — plan gate: ≥95% precision on gold pages first).

Honest caveats: rules-based parse over raw IA OCR; heavy OCR noise (digit/letter confusion,
mangled street names) caps the geocode rate. The plan's upgrade path is a local-VLM re-OCR
pass on failing pages plus the era gazetteer for renamed streets — both measured against
hand-labeled gold pages before anything enters dossiers.
`;
  const reportPath = path.join(config.root, 'reports', `directory-parse-${SLUG}.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report);
  console.log(report);
  console.log(`report: ${reportPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
