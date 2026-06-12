import { SOURCES } from './registry.mjs';
import { openDb, log } from './db.mjs';
import { verifyDataset } from './socrata.mjs';

const db = openDb();
const existing = new Set(db.prepare('SELECT source FROM jobs').all().map((r) => r.source));

for (const source of SOURCES) {
  const v = await verifyDataset(source);
  if (!v.ok) {
    log(db, 'warn', source.key, `name mismatch or error for ${source.id}: got "${v.actualName ?? v.error}" expected "${source.name}" — seeding anyway, verify manually`);
  } else {
    log(db, 'info', source.key, `verified ${source.id} = "${v.actualName}"`);
  }
  if (!existing.has(source.key)) {
    db.prepare('INSERT INTO jobs (source, kind, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(source.key, 'fetch', source.priority, Date.now(), Date.now());
    log(db, 'info', source.key, 'enqueued');
  }
}
console.log(`\nQueue seeded: ${db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE status != 'done'").get().n} open jobs`);
