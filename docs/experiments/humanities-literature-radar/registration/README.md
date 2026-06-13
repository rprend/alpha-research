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

## Remote Smoke Proof

The refreshed broad-backfill bundle is verified by Alpha Research run `1bed0948-e36b-4eb9-a0d6-918f2937d0b2`.

Remote proof:

- mounted dataset path: `/data/datasets/humanities-literature-radar/`
- status: `ready`
- total works recomputed from `processed/works.json`: 7,362
- works dated 2024-present: 5,025
- quantitative/computational humanities candidates: 1,997
- DOAJ OAI records: 5,418
- required artifacts returned: `report.html`, `result.json`, `work.md`

The machine-readable proof is stored in `remote-smoke-run.json`.
