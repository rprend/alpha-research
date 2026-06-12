import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';
import { SOURCES, BLOCKED_ON_HUMAN } from './registry.mjs';

function dirSizeBytes(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const f of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, f));
    if (st.isFile()) total += st.size;
  }
  return total;
}

const gb = (b) => (b / 1024 ** 3).toFixed(2);

export function generateStatus(db) {
  const jobs = db.prepare(`
    SELECT j.source, j.status, j.attempts, j.last_error, j.priority,
           c.rows_fetched, c.parts, c.done, c.updated_at AS ckpt_at
    FROM jobs j LEFT JOIN checkpoints c ON c.source = j.source
    WHERE j.kind != 'ia_text'
    ORDER BY j.priority ASC`).all();
  const iaAgg = db.prepare(`SELECT status, COUNT(*) AS n FROM jobs WHERE kind = 'ia_text' GROUP BY status`).all();
  const events = db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 15').all();

  let totalBytes = 0, totalRows = 0;
  const lines = [];
  lines.push('# NYC Address Dossier — harvester status');
  lines.push('');
  lines.push(`_Generated ${new Date().toISOString()} — regenerated automatically by the supervisor._`);
  lines.push('');
  lines.push('| source | status | rows fetched | parts | size | last error |');
  lines.push('|---|---|---|---|---|---|');
  for (const j of jobs) {
    const src = SOURCES.find((s) => s.key === j.source);
    const bytes = dirSizeBytes(path.join(config.rawDir, j.source));
    totalBytes += bytes;
    totalRows += j.rows_fetched ?? 0;
    const statusIcon = j.status === 'done' ? '✅ done' : j.status === 'running' ? '⏳ running' : j.status === 'failed' ? '❌ failed' : j.status;
    lines.push(`| ${j.source} (${src?.id ?? '?'}) | ${statusIcon} | ${(j.rows_fetched ?? 0).toLocaleString()} | ${j.parts ?? 0} | ${gb(bytes)} GB | ${j.last_error ? j.last_error.slice(0, 60) : ''} |`);
  }
  lines.push('');
  if (iaAgg.length > 0) {
    const iaBytes = dirSizeBytes(path.join(config.rawDir, 'ia_directories'));
    lines.push(`**IA directory volumes (Phase 3):** ${iaAgg.map((r) => `${r.n} ${r.status}`).join(' · ')} · ${gb(iaBytes)} GB OCR text`);
    lines.push('');
  }
  lines.push(`**Totals:** ${totalRows.toLocaleString()} rows · ${gb(totalBytes)} GB raw (gzipped JSONL)`);
  lines.push('');
  lines.push('## Blocked on human (the supervisor never attempts these)');
  lines.push('');
  for (const item of BLOCKED_ON_HUMAN) lines.push(`- [ ] ${item}`);
  lines.push('');
  lines.push('## Recent events');
  lines.push('');
  for (const e of events) {
    lines.push(`- \`${new Date(e.ts).toISOString()}\` ${e.level.toUpperCase()} ${e.source ?? ''} — ${e.message}`);
  }
  lines.push('');
  fs.writeFileSync(config.statusPath, lines.join('\n'));
  return config.statusPath;
}

// Standalone: node --experimental-sqlite src/status.mjs
if (process.argv[1] && process.argv[1].endsWith('status.mjs')) {
  const { openDb } = await import('./db.mjs');
  const db = openDb();
  const p = generateStatus(db);
  console.log(`wrote ${p}`);
}
