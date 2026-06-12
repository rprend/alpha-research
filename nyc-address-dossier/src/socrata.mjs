import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { config } from './config.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastRequestAt = 0;
async function politeDelay() {
  const wait = lastRequestAt + config.minRequestIntervalMs + Math.random() * config.requestJitterMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

export function pageUrl(source, offset) {
  const params = new URLSearchParams();
  params.set('$limit', String(config.pageSize));
  params.set('$offset', String(offset));
  params.set('$order', ':id');
  if (source.select) params.set('$select', source.select);
  if (source.where) params.set('$where', source.where);
  return `${config.socrataHost}/resource/${source.id}.json?${params.toString()}`;
}

async function fetchPage(source, offset) {
  const url = pageUrl(source, offset);
  for (let attempt = 0; ; attempt++) {
    await politeDelay();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.requestTimeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': config.userAgent, 'Accept': 'application/json' },
        signal: ctrl.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after')) || 0;
        const delay = Math.max(retryAfter * 1000, Math.min(config.backoffBaseMs * 2 ** attempt, config.backoffCapMs));
        if (attempt + 1 >= config.maxAttempts) throw new Error(`HTTP ${res.status} after ${attempt + 1} attempts`);
        await sleep(delay + Math.random() * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} (terminal) for ${url}`);
      const text = await res.text();
      return JSON.parse(text);
    } catch (err) {
      if (err.name === 'AbortError' || err.cause?.code === 'ECONNRESET' || err.cause?.code === 'ENOTFOUND' || err.cause?.code === 'ETIMEDOUT' || err.message?.includes('fetch failed')) {
        if (attempt + 1 >= config.maxAttempts) throw err;
        await sleep(Math.min(config.backoffBaseMs * 2 ** attempt, config.backoffCapMs));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

// Fetch one page, persist it as a gzipped JSONL part file (atomic rename), return row count.
export async function fetchAndStorePage(source, offset) {
  const rows = await fetchPage(source, offset);
  if (rows.length > 0) {
    const dir = path.join(config.rawDir, source.key);
    fs.mkdirSync(dir, { recursive: true });
    const partName = `part-${String(offset).padStart(10, '0')}.jsonl.gz`;
    const finalPath = path.join(dir, partName);
    if (!fs.existsSync(finalPath)) {
      const tmpPath = finalPath + '.tmp';
      const jsonl = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
      fs.writeFileSync(tmpPath, zlib.gzipSync(Buffer.from(jsonl), { level: 6 }));
      fs.renameSync(tmpPath, finalPath);
    }
  }
  return rows.length;
}

// Blob datasets (e.g. PAD): single-file download with Range resume, then optional unzip.
export async function fetchBlob(source) {
  const { execFileSync } = await import('node:child_process');
  const dir = path.join(config.rawDir, source.key);
  fs.mkdirSync(dir, { recursive: true });
  const finalPath = path.join(dir, source.blobFile);
  const tmpPath = finalPath + '.partial';
  if (!fs.existsSync(finalPath)) {
    const have = fs.existsSync(tmpPath) ? fs.statSync(tmpPath).size : 0;
    await politeDelay();
    const res = await fetch(source.blobUrl, {
      headers: {
        'User-Agent': config.userAgent,
        ...(have > 0 ? { Range: `bytes=${have}-` } : {}),
      },
    });
    if (!(res.ok || res.status === 206)) throw new Error(`HTTP ${res.status} for blob ${source.blobUrl}`);
    const append = res.status === 206;
    const ws = fs.createWriteStream(tmpPath, { flags: append ? 'a' : 'w' });
    const { Readable } = await import('node:stream');
    const { pipeline } = await import('node:stream/promises');
    await pipeline(Readable.fromWeb(res.body), ws);
    fs.renameSync(tmpPath, finalPath);
  }
  if (source.unzip) {
    const exDir = path.join(dir, 'extracted');
    if (!fs.existsSync(exDir) || fs.readdirSync(exDir).length === 0) {
      fs.mkdirSync(exDir, { recursive: true });
      execFileSync('/usr/bin/unzip', ['-o', '-q', finalPath, '-d', exDir]);
    }
  }
  return fs.statSync(finalPath).size;
}

export async function verifyDataset(source) {
  await politeDelay();
  const res = await fetch(`${config.socrataHost}/api/views/${source.id}.json`, {
    headers: { 'User-Agent': config.userAgent },
  });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const meta = await res.json();
  return { ok: meta.name === source.name, actualName: meta.name, rowsUpdatedAt: meta.rowsUpdatedAt };
}
