import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  root: ROOT,
  dataDir: path.join(ROOT, 'data'),
  rawDir: path.join(ROOT, 'data', 'raw'),
  dbPath: path.join(ROOT, 'data', 'harvester.db'),
  duckdbPath: path.join(ROOT, 'data', 'dossier.duckdb'),
  statusPath: path.join(ROOT, 'status.md'),
  lockPath: path.join(ROOT, 'data', 'supervisor.lock'),
  logPath: path.join(ROOT, 'data', 'supervisor.log'),

  socrataHost: 'https://data.cityofnewyork.us',
  userAgent: 'nyc-address-dossier-research/0.1 (personal research project; contact: rprendergast1121@gmail.com)',
  pageSize: 50000,
  // Politeness: one request in flight, spaced out. All Phase 0 sources share one host.
  minRequestIntervalMs: 1200,
  requestJitterMs: 400,
  requestTimeoutMs: 180000,
  maxAttempts: 8,
  backoffBaseMs: 5000,
  backoffCapMs: 15 * 60 * 1000,

  // Disk watermarks (bytes free on the data volume)
  pauseFetchBelowBytes: 100 * 1024 ** 3,
  haltBelowBytes: 40 * 1024 ** 3,

  heartbeatMs: 30000,
};
