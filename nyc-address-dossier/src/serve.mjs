// Milestone 0 map viewer server: read-only DuckDB API + static viewer page.
//   node --experimental-sqlite src/serve.mjs   ->  http://localhost:8011
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DuckDBInstance } from '@duckdb/node-api';
import { config } from './config.mjs';
import { parseAddress } from './lookup.mjs';
import { aerialUrls } from './aerials.mjs';

const PORT = Number(process.env.PORT || 8011);
const VIEWER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'viewer');

// One cached read-only connection; reopened when the materializer swaps the file.
let cached = null;
async function getDb() {
  const ino = fs.statSync(config.duckdbPath).ino;
  if (cached && cached.ino === ino) return cached.db;
  if (cached) { try { cached.db.closeSync(); cached.instance.closeSync?.(); } catch { /* old handle */ } }
  const instance = await DuckDBInstance.create(config.duckdbPath, { access_mode: 'READ_ONLY' });
  const db = await instance.connect();
  cached = { db, instance, ino };
  return db;
}

async function q(sql, params = []) {
  const db = await getDb();
  const prepared = await db.prepare(sql);
  params.forEach((p, i) => prepared.bindVarchar(i + 1, String(p)));
  const reader = await prepared.runAndReadAll();
  return reader.getRowObjects();
}

const json = (res, code, body) =>
  res.writeHead(code, { 'Content-Type': 'application/json' })
     .end(JSON.stringify(body, (k, v) => (typeof v === 'bigint' ? Number(v) : v)));

async function resolveAddr(query) {
  const parsed = parseAddress(query.get('addr'), query.get('boro'));
  if (!parsed) return [];
  const { house, street, boro } = parsed;
  let rows = await q(`SELECT DISTINCT p.bbl, p.lhnd || '-' || p.hhnd || ' ' || p.stname AS label,
      l.latitude, l.longitude
    FROM pad_addresses p LEFT JOIN lots l ON l.bbl = p.bbl
    WHERE p.boro = ? AND upper(p.stname) = ?
      AND TRY_CAST(? AS BIGINT) BETWEEN TRY_CAST(p.lhnd AS BIGINT) AND TRY_CAST(p.hhnd AS BIGINT)
    ORDER BY (TRY_CAST(? AS BIGINT) % 2) = (TRY_CAST(p.lhnd AS BIGINT) % 2) DESC
    LIMIT 5`, [boro, street, house, house]);
  if (rows.length === 0) {
    rows = await q(`SELECT bbl, address AS label, latitude, longitude FROM lots
      WHERE upper(trim(address)) = ? AND substr(bbl, 1, 1) = ? LIMIT 5`,
      [`${house} ${street}`, boro]);
  }
  return rows;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(path.join(VIEWER_DIR, 'index.html')));
    }
    if (url.pathname === '/api/resolve') {
      return json(res, 200, await resolveAddr(url.searchParams));
    }
    if (url.pathname === '/api/near') {
      const lat = url.searchParams.get('lat'), lon = url.searchParams.get('lon');
      const rows = await q(`SELECT bbl, address AS label, latitude, longitude,
          (latitude - TRY_CAST(? AS DOUBLE)) * (latitude - TRY_CAST(? AS DOUBLE))
            + (0.758 * (longitude - TRY_CAST(? AS DOUBLE))) * (0.758 * (longitude - TRY_CAST(? AS DOUBLE))) AS d2
        FROM lots
        WHERE latitude  BETWEEN TRY_CAST(? AS DOUBLE) - 0.002  AND TRY_CAST(? AS DOUBLE) + 0.002
          AND longitude BETWEEN TRY_CAST(? AS DOUBLE) - 0.0026 AND TRY_CAST(? AS DOUBLE) + 0.0026
        ORDER BY d2 LIMIT 1`, [lat, lat, lon, lon, lat, lat, lon, lon]);
      return json(res, 200, rows);
    }
    if (url.pathname === '/api/story') {
      const { buildStory } = await import('./story.mjs');
      return json(res, 200, await buildStory(url.searchParams.get('bbl')));
    }
    if (url.pathname === '/api/dossier') {
      const bbl = url.searchParams.get('bbl');
      const lot = await q(`SELECT * FROM lots WHERE bbl = ?`, [bbl]);
      const events = await q(`SELECT CAST(date_start AS VARCHAR) AS date, kind, source_id,
          CAST(payload AS VARCHAR) AS payload, confidence
        FROM events WHERE bbl = ? AND date_start IS NOT NULL
        ORDER BY date_start ASC LIMIT 3000`, [bbl]);
      const counts = await q(`SELECT kind, COUNT(*) AS n FROM events WHERE bbl = ? GROUP BY kind`, [bbl]);
      const aerials = lot[0] ? aerialUrls(lot[0].latitude, lot[0].longitude) : [];
      return json(res, 200, { bbl, lot: lot[0] ?? null, events, counts, aerials });
    }
    json(res, 404, { error: 'not found' });
  } catch (err) {
    json(res, 500, { error: String(err) });
  }
});

server.listen(PORT, () => console.log(`dossier viewer: http://localhost:${PORT}`));
