# NYC Address Dossier — harvester

Implementation of [the plan](../docs/research-plans/nyc-address-dossier-plan.md), Phase 0 + §4.0:
an autonomous, laptop-scale harvester that downloads NYC's structured per-address record
(15 datasets: PLUTO, PAD, ACRIS, DOB, HPD, DOF sales, licenses, inspections, 311) and
materializes per-BBL dossier timelines.

## Commands

```bash
npm run seed          # verify dataset IDs against the live catalog, enqueue jobs
npm run supervisor    # run the harvester loop in the foreground (singleton-locked)
npm run status        # regenerate status.md from the queue DB
npm run materialize   # (re)build data/dossier.duckdb from landed sources
npm run dossier -- "350 5 AVENUE" manhattan    # address -> BBL -> cited timeline
npm run dossier -- --bbl 1008350041
npm run serve            # map viewer at http://localhost:8011 (search or click any lot)
bin/install-launchd.sh   # persist across reboots as a launchd agent
```

## How autonomy works

- One supervisor (PID lock in `data/supervisor.lock`), one SQLite job queue (`data/harvester.db`),
  one dataset per job, checkpoint after every 50k-row page. `kill -9` safe; resumes where it stopped.
- Politeness: single request in flight, ~1.2–1.6s spacing, exponential backoff on 429/5xx,
  identifying User-Agent. All Phase 0 sources are free public endpoints — no API keys, no paid calls.
- Disk watermarks: fetching pauses below 100 GB free, halts below 40 GB.
- `status.md` is the dashboard: per-source progress, totals, recent events, and the
  **blocked-on-human list** (DORIS outreach, OMH email, microfilm days…) the harvester never attempts.
- Exit semantics: queue drained → exit 0 (launchd does not respawn until reboot/manual kickstart);
  crash → launchd respawns after ≥60s.

## Layout

```
src/registry.mjs     source registry (IDs verified 2026-06-12) + blocked-on-human list
src/supervisor.mjs   main loop: claim job -> fetch pages -> checkpoint -> complete
src/socrata.mjs      paged SODA fetcher (JSONL.gz parts) + blob fetcher (PAD zip)
src/db.mjs           queue schema + claim/heartbeat/backoff
src/materialize.mjs  DuckDB build: raw_* tables -> canonical events (§2.2 schema) + lots + pad_addresses
src/dossier.mjs      address/BBL -> timeline CLI
src/status.mjs       status.md generator
data/                raw parts, queue DB, duckdb, logs (gitignored)
```

## Phase progress beyond the Phase 0 spine

- **Phase 1 (photos):** OldNYC ingest DONE — 33.8k geocoded NYPL photos assigned to nearest
  lots (confidence 0.6, ~90m search box). Tax photos blocked on DORIS outreach
  (draft: ../docs/outreach/doris-tax-photos-draft.md).
- **Phase 3 step 1 (directory text):** ia_inventory job queries IA for NYPL-scanned NYC
  city directories and spawns one ia_text download job per volume (existing djvu OCR text,
  gzipped to data/raw/ia_directories/). Parsing is the next milestone — gold pages first.
- **Milestone 0 viewer:** `npm run serve` — MapLibre map + dossier panel; search via PAD,
  click-a-lot via nearest-centroid; photos render inline.

House rule: **no paid API runs without explicit per-run approval** — everything here runs
on free endpoints and local compute only.
