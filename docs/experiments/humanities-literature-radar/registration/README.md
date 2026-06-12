# Humanities Literature Radar Registration

This folder contains the control-plane registration payload for the `humanities-literature-radar` dataset.

## Dataset Bundle

Build the local bundle:

```bash
node docs/experiments/humanities-literature-radar/scripts/build-dataset-bundle.mjs
```

Upload the bundle to the shared dataset volume:

```bash
python scripts/sync_modal_dataset.py --dataset-id humanities-literature-radar --source docs/experiments/humanities-literature-radar/dataset-bundle --contents --force
```

The intended remote mount is `/data/datasets/humanities-literature-radar/`.

## Control Plane Payload

- Create/update dataset with `dataset` from `control-plane-registration.json`.
- Attach profile with `profile` from `control-plane-registration.json` at `/datasets/humanities-literature-radar/profile`.
- Verify dashboard dataset detail renders `briefingMarkdown` and the profile endpoint returns schema and sample rows.

Apply the CLI registration payload with:

```bash
node docs/experiments/humanities-literature-radar/scripts/register-control-plane-dataset.mjs
```

Promote the prebuilt, already-synced dataset row to ready with:

```bash
set -a; source ~/.codex/secrets.env; set +a
node docs/experiments/humanities-literature-radar/scripts/promote-prebuilt-dataset.mjs
```

The latest verification is written to `control-plane-verification.json`.

Current verified state:

- Modal bundle synced to `agent-dataset:/datasets/humanities-literature-radar/`
- Control-plane dataset row exists for `humanities-literature-radar`
- Dataset row is `status=ready`, `deploymentStatus=ready`
- Manifest path is `/data/datasets/humanities-literature-radar/manifest.json`
- Dataset profile is attached with briefing markdown, 26 schema fields, and 10 sample rows
- Dashboard URL: `https://dashboard.alpharesearch.nyc/datasets/humanities-literature-radar`
- Ready promotion uses `POST /api/admin/datasets/prebuilt-ready`, authenticated with `ALPHA_RESEARCH_ADMIN_TOKEN`.

## Remote Smoke Run

The dataset-ready acceptance check is complete.

- Successful run: `d866dce5-a99b-459f-a932-a0aff4fec638`
- Run URL: `https://dashboard.alpharesearch.nyc/runs/d866dce5-a99b-459f-a932-a0aff4fec638`
- Status: `ready`
- Finished: `2026-06-12T20:18:37.276Z`
- Evidence file: `remote-smoke-run.json`

The remote agent mounted and inspected:

- `/data/datasets/humanities-literature-radar/manifest.json`
- `/data/datasets/humanities-literature-radar/dataset_briefing.md`
- `/data/datasets/humanities-literature-radar/processed/works.json`
- `/data/datasets/humanities-literature-radar/processed/topics.json`
- `/data/datasets/humanities-literature-radar/processed/representative-works.csv`

It produced the required artifact bundle:

- `report.html`: `42841af0-097f-4e19-b5ce-8d467ddaa0f5`
- `result.json`: `f53e38e9-0be0-4a5a-9f7c-d59e88d2ac0b`
- `work.md`: `7cca0016-dd1d-40ba-8885-2f4acfae8739`

`result.json` included the required generic research fields: `answer`, `claims`, `evidence`, `confidence`, `limitations`, and `sourceDatasetIds`. The run returned 3 claims, 10 evidence records, and `sourceDatasetIds=["humanities-literature-radar"]`.

The smoke answer found 1,951 works, 1,155 works dated 2024-present, 593 quantitative/computational humanities candidates, 98 AI/LLM works dated 2024-present, and 379 quantitative/computational works dated 2024-present.

Prior failed run `d7b685ae-e6f2-4942-a18e-73103edec4ff` proved the dataset mount was readable but failed artifact validation because `result.json` omitted the generic required fields. The successful run fixed the prompt and artifact schema.
