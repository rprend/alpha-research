import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';

export function openDb() {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new DatabaseSync(config.dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS jobs (
      job_id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'fetch',
      priority INTEGER NOT NULL DEFAULT 100,
      status TEXT NOT NULL DEFAULT 'queued',  -- queued | running | done | failed | paused
      attempts INTEGER NOT NULL DEFAULT 0,
      not_before INTEGER NOT NULL DEFAULT 0,  -- epoch ms
      last_error TEXT,
      heartbeat INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checkpoints (
      source TEXT PRIMARY KEY,
      next_offset INTEGER NOT NULL DEFAULT 0,
      rows_fetched INTEGER NOT NULL DEFAULT 0,
      parts INTEGER NOT NULL DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      level TEXT NOT NULL,
      source TEXT,
      message TEXT NOT NULL
    );
  `);
  return db;
}

export function log(db, level, source, message) {
  db.prepare('INSERT INTO events (ts, level, source, message) VALUES (?, ?, ?, ?)')
    .run(Date.now(), level, source ?? null, String(message).slice(0, 2000));
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${source ?? '-'} ${message}`;
  console.log(line);
}

export function getCheckpoint(db, source) {
  let row = db.prepare('SELECT * FROM checkpoints WHERE source = ?').get(source);
  if (!row) {
    db.prepare('INSERT INTO checkpoints (source, updated_at) VALUES (?, ?)').run(source, Date.now());
    row = db.prepare('SELECT * FROM checkpoints WHERE source = ?').get(source);
  }
  return row;
}

export function saveCheckpoint(db, source, { next_offset, rows_fetched, parts, done }) {
  db.prepare(`UPDATE checkpoints
    SET next_offset = ?, rows_fetched = ?, parts = ?, done = ?, updated_at = ?
    WHERE source = ?`)
    .run(next_offset, rows_fetched, parts, done ? 1 : 0, Date.now(), source);
}

export function claimNextJob(db) {
  const now = Date.now();
  // Reclaim stale running jobs (dead supervisor) after 5 minutes without heartbeat.
  db.prepare(`UPDATE jobs SET status = 'queued'
    WHERE status = 'running' AND heartbeat < ?`).run(now - 5 * 60 * 1000);
  const job = db.prepare(`SELECT * FROM jobs
    WHERE status = 'queued' AND not_before <= ?
    ORDER BY priority ASC, job_id ASC LIMIT 1`).get(now);
  if (!job) return null;
  db.prepare(`UPDATE jobs SET status = 'running', heartbeat = ?, updated_at = ? WHERE job_id = ?`)
    .run(now, now, job.job_id);
  return job;
}

export function heartbeat(db, jobId) {
  db.prepare('UPDATE jobs SET heartbeat = ?, updated_at = ? WHERE job_id = ?')
    .run(Date.now(), Date.now(), jobId);
}

export function completeJob(db, jobId) {
  db.prepare(`UPDATE jobs SET status = 'done', updated_at = ? WHERE job_id = ?`)
    .run(Date.now(), jobId);
}

export function failJob(db, job, err, { terminal = false } = {}) {
  const attempts = job.attempts + 1;
  const cfgCap = 8;
  if (terminal || attempts >= cfgCap) {
    db.prepare(`UPDATE jobs SET status = 'failed', attempts = ?, last_error = ?, updated_at = ? WHERE job_id = ?`)
      .run(attempts, String(err).slice(0, 2000), Date.now(), job.job_id);
  } else {
    const delay = Math.min(5000 * 2 ** attempts, 15 * 60 * 1000);
    db.prepare(`UPDATE jobs SET status = 'queued', attempts = ?, last_error = ?, not_before = ?, updated_at = ? WHERE job_id = ?`)
      .run(attempts, String(err).slice(0, 2000), Date.now() + delay, Date.now(), job.job_id);
  }
}
