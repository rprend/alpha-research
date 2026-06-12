import fs from 'node:fs';
import { config } from './config.mjs';
import { SOURCES } from './registry.mjs';
import { openDb, log, claimNextJob, heartbeat, completeJob, failJob, getCheckpoint, saveCheckpoint } from './db.mjs';
import { fetchAndStorePage, fetchBlob } from './socrata.mjs';
import { generateStatus } from './status.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- singleton lock -------------------------------------------------------
function acquireLock() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (fs.existsSync(config.lockPath)) {
    const pid = Number(fs.readFileSync(config.lockPath, 'utf8').trim());
    if (pid && isAlive(pid)) return false;
    fs.rmSync(config.lockPath); // stale lock
  }
  fs.writeFileSync(config.lockPath, String(process.pid));
  return true;
}
function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function releaseLock() {
  try {
    if (Number(fs.readFileSync(config.lockPath, 'utf8').trim()) === process.pid) fs.rmSync(config.lockPath);
  } catch { /* already gone */ }
}

// ---- disk watermarks ------------------------------------------------------
async function freeBytes() {
  const s = await fs.promises.statfs(config.dataDir);
  return s.bavail * s.bsize;
}

// ---- main loop ------------------------------------------------------------
let shuttingDown = false;
process.on('SIGINT', () => { shuttingDown = true; });
process.on('SIGTERM', () => { shuttingDown = true; });

async function runFetchJob(db, job) {
  if (job.kind === 'ia_inventory') {
    const { runInventory } = await import('./ia.mjs');
    await runInventory(db, log);
    completeJob(db, job.job_id);
    generateStatus(db);
    return;
  }
  if (job.kind === 'ia_text') {
    const { fetchIAText } = await import('./ia.mjs');
    const identifier = job.source.slice('ia_text:'.length);
    const r = await fetchIAText(identifier);
    if (r.missing) {
      failJob(db, job, 'no djvu.txt on item', { terminal: true });
      log(db, 'warn', job.source, 'no OCR text available — marked failed (terminal)');
    } else {
      completeJob(db, job.job_id);
      if (!r.cached) log(db, 'info', job.source, `COMPLETE: ${(r.bytes / 1024 ** 2).toFixed(1)} MB OCR text`);
    }
    return;
  }
  const source = SOURCES.find((s) => s.key === job.source);
  if (!source) { failJob(db, job, `unknown source ${job.source}`, { terminal: true }); return; }
  if (source.type === 'blob') {
    const bytes = await fetchBlob(source);
    completeJob(db, job.job_id);
    saveCheckpoint(db, source.key, { next_offset: 0, rows_fetched: 0, parts: 1, done: true });
    log(db, 'info', source.key, `COMPLETE: blob ${(bytes / 1024 ** 2).toFixed(1)} MB downloaded + extracted`);
    generateStatus(db);
    return;
  }
  const ckpt = getCheckpoint(db, source.key);
  if (ckpt.done) { completeJob(db, job.job_id); return; }

  let offset = ckpt.next_offset;
  let rows = ckpt.rows_fetched;
  let parts = ckpt.parts;
  let lastBeat = Date.now();
  log(db, 'info', source.key, `fetch resuming at offset ${offset.toLocaleString()}`);

  while (!shuttingDown) {
    if ((await freeBytes()) < config.pauseFetchBelowBytes) {
      log(db, 'warn', source.key, 'disk below pause watermark; sleeping 10 min');
      await sleep(10 * 60 * 1000);
      continue;
    }
    const count = await fetchAndStorePage(source, offset);
    if (count > 0) { parts += 1; rows += count; offset += count; }
    saveCheckpoint(db, source.key, { next_offset: offset, rows_fetched: rows, parts, done: count < config.pageSize });
    if (Date.now() - lastBeat > config.heartbeatMs) { heartbeat(db, job.job_id); lastBeat = Date.now(); }
    if (count < config.pageSize) {
      completeJob(db, job.job_id);
      log(db, 'info', source.key, `COMPLETE: ${rows.toLocaleString()} rows in ${parts} parts`);
      generateStatus(db);
      return;
    }
  }
  // graceful shutdown mid-dataset: leave job queued, checkpoint already saved
  db.prepare(`UPDATE jobs SET status = 'queued', updated_at = ? WHERE job_id = ?`).run(Date.now(), job.job_id);
  log(db, 'info', source.key, `paused at offset ${offset.toLocaleString()} (shutdown)`);
}

async function main() {
  if (!acquireLock()) {
    console.log('another supervisor is running; exiting cleanly');
    process.exit(0);
  }
  const db = openDb();
  log(db, 'info', null, `supervisor started (pid ${process.pid})`);
  let lastStatus = 0;
  try {
    while (!shuttingDown) {
      if ((await freeBytes()) < config.haltBelowBytes) {
        log(db, 'error', null, 'disk below HALT watermark; supervisor stopping');
        break;
      }
      const job = claimNextJob(db);
      if (!job) {
        log(db, 'info', null, 'queue drained — rebuilding dossier.duckdb before exit');
        try {
          const { execFileSync } = await import('node:child_process');
          const materializePath = new URL('./materialize.mjs', import.meta.url).pathname;
          execFileSync(process.execPath, ['--experimental-sqlite', materializePath], { stdio: 'inherit', timeout: 4 * 60 * 60 * 1000 });
          log(db, 'info', null, 'dossier materialization complete');
        } catch (err) {
          log(db, 'error', null, `materialization failed: ${err}`);
        }
        generateStatus(db);
        log(db, 'info', null, 'queue drained — all eligible jobs done. Exiting.');
        break;
      }
      try {
        await runFetchJob(db, job);
      } catch (err) {
        failJob(db, job, err);
        log(db, 'error', job.source, `job error: ${err}`);
        await sleep(5000);
      }
      if (Date.now() - lastStatus > 10 * 60 * 1000) { generateStatus(db); lastStatus = Date.now(); }
    }
  } finally {
    generateStatus(db);
    log(db, 'info', null, 'supervisor exiting');
    releaseLock();
  }
}

main();
