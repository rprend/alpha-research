// Gazetteer workstream (§6) artifact #1: rank the street names from a parsed directory
// volume that fail modern-PAD geocoding, by entry volume. This is the prioritized
// worklist for the era alias table — fix the top names first, win the most entries.
//
//   node --experimental-sqlite src/gazetteer-worklist.mjs brooklyn-1912 3
import fs from 'node:fs';
import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { config } from './config.mjs';

const SLUG = process.argv[2] ?? 'brooklyn-1912';
const BORO = process.argv[3] ?? '3';

async function main() {
  const entriesPath = path.join(config.dataDir, 'derived', `directory-${SLUG}.jsonl`);
  const instance = await DuckDBInstance.create(config.duckdbPath, { access_mode: 'READ_ONLY' });
  const db = await instance.connect();
  await db.run(`CREATE TEMP TABLE entries AS
    SELECT * FROM read_json('${entriesPath.replace(/'/g, "''")}', format='newline_delimited', union_by_name=true)`);
  const rows = (await (await db.run(`
    WITH agg AS (
      SELECT street_norm, COUNT(*) AS n,
        EXISTS (SELECT 1 FROM pad_addresses p WHERE p.boro = '${BORO}' AND upper(p.stname) = entries.street_norm) AS in_pad
      FROM entries GROUP BY street_norm
    )
    SELECT street_norm, n FROM agg WHERE NOT in_pad ORDER BY n DESC LIMIT 40`)).getRowObjects());
  const matched = (await (await db.run(`
    WITH agg AS (
      SELECT street_norm, COUNT(*) AS n,
        EXISTS (SELECT 1 FROM pad_addresses p WHERE p.boro = '${BORO}' AND upper(p.stname) = entries.street_norm) AS in_pad
      FROM entries GROUP BY street_norm)
    SELECT SUM(n) FILTER (in_pad) AS hit, SUM(n) AS total FROM agg`)).getRows())[0].map(Number);
  db.closeSync();

  const report = `# Gazetteer worklist — ${SLUG} (boro ${BORO})

_Generated ${new Date().toISOString()}_

Street-name match coverage: **${matched[0].toLocaleString()} / ${matched[1].toLocaleString()} entries (${(100 * matched[0] / matched[1]).toFixed(1)}%)** have a street name that exists in modern PAD.
The rest fail for two distinct reasons — OCR damage (fix: re-OCR/fuzzy match) vs genuine
historical renames (fix: era alias table). Top unmatched street strings by entry volume:

| entries | street string (normalized) |
|---|---|
${rows.map((r) => `| ${Number(r.n).toLocaleString()} | ${r.street_norm} |`).join('\n')}

Next actions: (1) alias entries for recognizable renames go into a curated
\`gazetteer/aliases-${BORO}.json\`; (2) high-volume OCR garbage motivates the local-VLM
re-OCR pass on those pages; (3) re-run the parse report after each fix and watch the
geocode rate climb. This ranking IS the prioritization — top 10 rows cover the bulk.
`;
  const reportPath = path.join(config.root, 'reports', `gazetteer-worklist-${SLUG}.md`);
  fs.writeFileSync(reportPath, report);
  console.log(report.split('\n').slice(0, 22).join('\n'));
  console.log(`\nreport: ${reportPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
