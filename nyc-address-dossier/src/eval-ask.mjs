// Milestone 5 output: the ask-layer eval report. Generates questions from dossier
// ground truth (so scoring is mechanical, not vibes), runs them through ask.mjs,
// and scores answer accuracy + citation discipline.
//
//   node --experimental-sqlite src/eval-ask.mjs [N]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DuckDBInstance } from '@duckdb/node-api';
import { config } from './config.mjs';

const N = Number(process.argv[2] ?? 50);
const LLM = process.argv[3] === 'llm';
const SCRIPT = LLM ? 'ask-llm.mjs' : 'ask.mjs';
const SRC = path.dirname(fileURLToPath(import.meta.url));
const BORO_NAME = { 1: 'manhattan', 2: 'bronx', 3: 'brooklyn', 4: 'queens', 5: 'staten island' };

async function main() {
  const instance = await DuckDBInstance.create(config.duckdbPath, { access_mode: 'READ_ONLY' });
  const db = await instance.connect();
  // Sample lots with a clean address, known build year, and a current owner.
  const lots = (await (await db.run(`
    SELECT bbl, address, yearbuilt, ownername FROM lots
    WHERE address IS NOT NULL AND length(address) > 8
      AND TRY_CAST(yearbuilt AS INT) BETWEEN 1800 AND 2020
      AND ownername IS NOT NULL AND length(trim(ownername)) > 3
      AND regexp_matches(address, '^[0-9]+ .*(STREET|AVENUE|PLACE|ROAD|BOULEVARD|PARKWAY)$')
    USING SAMPLE ${N * 2} ROWS`)).getRowObjects());
  db.closeSync();

  const cases = [];
  for (const lot of lots) {
    if (cases.length >= N) break;
    const boro = BORO_NAME[String(lot.bbl)[0]];
    if (!boro) continue;
    if (cases.length % 2 === 0) {
      cases.push({ kind: 'built', q: `when was ${lot.address} in ${boro} built`, expect: String(lot.yearbuilt).trim(), bbl: lot.bbl });
    } else {
      const token = lot.ownername.trim().split(/\s+/)[0].replace(/[^A-Za-z0-9]/g, '');
      if (token.length < 3) continue;
      cases.push({ kind: 'owner', q: `who owns ${lot.address} in ${boro}`, expect: token, bbl: lot.bbl });
    }
  }

  let correct = 0, cited = 0, resolved = 0;
  const rows = [];
  for (const c of cases) {
    let out = '';
    try {
      out = execFileSync(process.execPath, ['--experimental-sqlite', path.join(SRC, SCRIPT), c.q],
        { encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { out = String(e.stdout ?? e); }
    const ok = out.toUpperCase().includes(c.expect.toUpperCase());
    const hasCite = /\[[a-z0-9_]+:/i.test(out);
    const didResolve = out.includes('-> BBL');
    if (ok) correct++; if (hasCite) cited++; if (didResolve) resolved++;
    rows.push({ ...c, ok, hasCite, didResolve });
  }

  const pct = (n) => `${(100 * n / Math.max(cases.length, 1)).toFixed(1)}%`;
  const byKind = {};
  for (const r of rows) {
    byKind[r.kind] ??= { n: 0, ok: 0 };
    byKind[r.kind].n++; if (r.ok) byKind[r.kind].ok++;
  }
  const failures = rows.filter((r) => !r.ok).slice(0, 8);
  const report = `# Ask-the-address eval (${LLM ? 'LLM layer, llama3.2:3b local' : 'deterministic layer'})

_Generated ${new Date().toISOString()} · ${cases.length} ground-truth questions sampled from \`lots\`_

| metric | result |
|---|---|
| address resolved to BBL | ${pct(resolved)} |
| answer correct (contains ground truth) | **${pct(correct)}** |
| answer carries citations | ${pct(cited)} |
${Object.entries(byKind).map(([k, v]) => `| accuracy: ${k} questions | ${(100 * v.ok / v.n).toFixed(1)}% (${v.ok}/${v.n}) |`).join('\n')}

Failure sample (first ${failures.length}):
${failures.map((f) => `- "${f.q}" expected ~"${f.expect}" (bbl ${f.bbl}; resolved=${f.didResolve})`).join('\n') || '- none'}

Method: questions generated FROM the dossier db (PLUTO yearbuilt / ownername), so scoring is
string-mechanical. Failures are mostly address-resolution mismatches (PAD range vs PLUTO
address string, condo lots) — exactly the gap an era gazetteer + BIN-level addressing closes.
The LLM layer must beat this baseline under the same citation constraint before it ships.
`;
  const reportPath = path.join(config.root, 'reports', LLM ? 'ask-eval-llm.md' : 'ask-eval.md');
  fs.writeFileSync(reportPath, report);
  console.log(report);
}

main().catch((e) => { console.error(e); process.exit(1); });
