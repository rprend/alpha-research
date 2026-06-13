# Cultural Observatory / Humanities Literature Radar

This experiment implements the first data backbone for a public research program about cultural, intellectual, literary, institutional, and scholarly change over time.

The near-term output is a broad literature-radar corpus and field-map artifact. The larger product goal is a publication pipeline for essays such as:

- what changed in a corpus over time
- the map of a scholarly field
- the moving canon
- AI-assisted research agendas from a source-grounded scout

## Current V1 Scope

- Backfill window: 2020-01-01 through the run date.
- Trend emphasis: 2024-present.
- Initial sources: OpenAlex, Crossref, arXiv, NBER metadata pages, and a public department-page crawl manifest.
- Output folder: `docs/experiments/humanities-literature-radar/reports/`
- Raw source folder: `docs/experiments/humanities-literature-radar/data/raw/`
- Processed folder: `docs/experiments/humanities-literature-radar/data/processed/`

The first implementation is intentionally runnable without secrets or paid APIs. Larger source expansions should preserve the same manifests and processed schema.

## Runbook

Fetch a bounded API smoke corpus:

```bash
node docs/experiments/humanities-literature-radar/scripts/run-pipeline.mjs --profile=smoke
```

The unified runner fetches sources, normalizes works, builds the report, and writes readiness artifacts.

Or run sources individually:

```bash
node docs/experiments/humanities-literature-radar/scripts/fetch-openalex.mjs --limit=120
node docs/experiments/humanities-literature-radar/scripts/fetch-crossref.mjs --limit=120
node docs/experiments/humanities-literature-radar/scripts/fetch-doaj.mjs --limit=120
node docs/experiments/humanities-literature-radar/scripts/fetch-doaj-oai.mjs --from=2020-01-01 --until=2026-06-12 --max-pages=100 --resume=true
node docs/experiments/humanities-literature-radar/scripts/fetch-osf-preprints.mjs --limit=120
node docs/experiments/humanities-literature-radar/scripts/fetch-hcommons.mjs --limit=120
node docs/experiments/humanities-literature-radar/scripts/fetch-arxiv.mjs --limit=80
node docs/experiments/humanities-literature-radar/scripts/fetch-nber.mjs --limit=80
```

Normalize and report:

```bash
node docs/experiments/humanities-literature-radar/scripts/normalize-works.mjs
node docs/experiments/humanities-literature-radar/scripts/build-report.mjs
node docs/experiments/humanities-literature-radar/scripts/build-publication-handoff.mjs
node docs/experiments/humanities-literature-radar/scripts/check-readiness.mjs
```

Build a recurring monitor artifact from the current processed corpus:

```bash
node docs/experiments/humanities-literature-radar/scripts/build-monitor-run.mjs --run-date=2026-06-12
```

For later runs, pass the previous processed corpus as `--prior-works=<path>` so the monitor separates newly discovered old records from genuinely new publications against a real baseline.

Build the Alpha Research dataset bundle and control-plane registration payload:

```bash
node docs/experiments/humanities-literature-radar/scripts/build-dataset-bundle.mjs
```

The bundle is written to `dataset-bundle/` and is shaped for `/data/datasets/humanities-literature-radar/`. The registration payload is written to `registration/control-plane-registration.json`.

The scripts write:

- `reports/pipeline-run.json`
- `data/interim/normalized-works.jsonl`
- `data/processed/works.json`
- `data/processed/works.csv`
- `data/processed/topics.json`
- `data/processed/representative-works.csv`
- `data/processed/quantitative-humanities-opportunities.csv`
- `reports/source-inventory.md`
- `reports/source-inventory.csv`
- `reports/doaj-oai-backfill-route.json`
- `reports/broad-backfill-comparison.md`
- `reports/broad-backfill-comparison.json`
- `reports/report.html`
- `reports/result.json`
- `reports/work.md`
- `reports/public-draft.md`
- `reports/publication-handoff.md`
- `reports/publication-handoff.json`
- `reports/readiness.md`
- `reports/readiness.json`
- `runs/YYYY-MM-DD/manifest.json`
- `runs/YYYY-MM-DD/new-works.csv`
- `runs/YYYY-MM-DD/new-works.json`
- `runs/YYYY-MM-DD/changed-sources.csv`
- `runs/YYYY-MM-DD/report.html`
- `runs/YYYY-MM-DD/result.json`
- `runs/YYYY-MM-DD/work.md`
- `dataset-bundle/manifest.json`
- `dataset-bundle/dataset_briefing.md`
- `dataset-bundle/dataset_profile.json`
- `dataset-bundle/schema.json`
- `dataset-bundle/sample_rows.json`
- `registration/control-plane-registration.json`

## Recurring Monitor

The monitor is configured in `config/monitor.yml`.

The first bootstrap run is `runs/2026-06-12/`. It originally compared the pre-backfill processed corpus against an empty baseline and classified 1,951 records as absent from baseline:

- 1,155 genuinely new publications in the configured current window
- 796 newly discovered old records
- 6 source rows in the coverage-change table

The current broad-backfill monitor comparison uses `data/interim/baselines/works-before-doaj-oai-100-page-2026-06-12.json` as the prior processed corpus and records the 100-page DOAJ OAI expansion:

- 7,362 current deduped works
- 2,929 records absent from the 25-page baseline
- 2,514 genuinely new publications
- 415 newly discovered old records

After the next broad backfill, run the monitor with a prior processed corpus path. Monitor claims should keep the `changed-sources.csv` table attached because source count changes can reflect crawler limits, API coverage, or indexing lag rather than intellectual trends.

## Broad Backfill Route

The broad-backfill upgrade uses the official DOAJ article OAI-PMH route with a local checkpoint:

```bash
node docs/experiments/humanities-literature-radar/scripts/fetch-doaj-oai.mjs --from=2020-01-01 --until=2026-06-12 --max-pages=100 --resume=true
```

The raw OAI harvest is stored under:

```text
data/raw/doaj-oai/YYYY-MM-DD/
```

The current committed run is a 100-page broad backfill, not the full DOAJ harvest. It preserves 30,000 raw OAI records, writes `data/raw/doaj-oai/YYYY-MM-DD/checkpoint.json` for resume/audit, promotes only records with at least one humanities/method relevance signal into the processed works table, and records the comparison in `reports/broad-backfill-comparison.md`.

## Dataset Registration

The stable dataset id is `humanities-literature-radar`.

The local dataset bundle mirrors the planned remote mount:

```text
/data/datasets/humanities-literature-radar/
  manifest.json
  dataset_briefing.md
  dataset_profile.json
  schema.json
  sample_rows.json
  processed/
  reports/
  runs/
```

Upload the local bundle to the shared Modal dataset volume with:

```bash
python scripts/sync_modal_dataset.py --dataset-id humanities-literature-radar --source docs/experiments/humanities-literature-radar/dataset-bundle --contents --force
```

Then create/update the control-plane dataset using `registration/control-plane-registration.json`:

- `dataset` payload: create/update `/datasets`
- `profile` payload: attach `/datasets/humanities-literature-radar/profile`

Dashboard verification should show the dataset detail briefing text from `briefingMarkdown`, and the profile endpoint should return schema and sample rows.

The refreshed 7,362-work bundle was remote-verified by Alpha Research run `1bed0948-e36b-4eb9-a0d6-918f2937d0b2`. The remote agent inspected the mounted dataset under `/data/datasets/humanities-literature-radar/`, recomputed 7,362 total works, 5,025 works dated 2024-present, 1,997 quantitative/computational candidates, and 5,418 DOAJ OAI records, then returned valid `report.html`, `result.json`, and `work.md` artifacts.

## Article Standard

Every public essay produced from this experiment should include:

- one sentence thesis
- corpus note
- method note
- 2 to 5 central findings
- 1 to 3 charts or tables
- representative records or excerpts
- limitations
- what to study next

Claims in public drafts must point back to `result.json`, charts, tables, or source records.
