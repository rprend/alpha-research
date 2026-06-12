import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Data + runtime live OUTSIDE ~/Documents: launchd agents are TCC-blocked from
// protected locations (Documents/Desktop/Downloads), so the harvester homes in ~.
const HOME_DIR = process.env.NYC_DOSSIER_HOME || path.join(os.homedir(), '.nyc-address-dossier');

export const config = {
  root: ROOT,
  homeDir: HOME_DIR,
  dataDir: path.join(HOME_DIR, 'data'),
  rawDir: path.join(HOME_DIR, 'data', 'raw'),
  dbPath: path.join(HOME_DIR, 'data', 'harvester.db'),
  duckdbPath: path.join(HOME_DIR, 'data', 'dossier.duckdb'),
  statusPath: path.join(HOME_DIR, 'status.md'),
  lockPath: path.join(HOME_DIR, 'data', 'supervisor.lock'),
  logPath: path.join(HOME_DIR, 'data', 'supervisor.log'),

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
