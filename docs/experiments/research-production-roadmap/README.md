# Cultural Observatory Research Production Roadmap

This folder tracks the work that remains after Season One publication packaging.

The Season One posts are ready for final editorial review, but the broader plan also requires larger backfills, recurring monitors, and second-layer source corpora. This roadmap keeps those requirements explicit so the publication pipeline does not mistake audited pilot posts for full-scale research completion.

## Runbook

```bash
node docs/experiments/research-production-roadmap/scripts/check-roadmap.mjs --strict
```

Outputs:

- `reports/roadmap-readiness.json`
- `reports/roadmap-readiness.md`

## Status Vocabulary

- `planned`: scoped but not implemented.
- `source-probed`: source route exists and has at least one reproducible probe.
- `pipeline-ready`: scripts/configs can build the corpus or monitor.
- `artifact-ready`: reports, processed outputs, and evidence audits exist.
- `publication-ready`: public post or package has passed evidence audit.
- `blocked`: source terms, access, licensing, or technical route prevents progress.

## Current Focus

The next implementation phase should prioritize:

1. Second-layer source corpora for longitudinal posts.
2. Broad backfills for bounded corpora where source access permits.
3. Recurring monitors for corpora that already have baselines.
4. Dataset registration and remote-run proof for any corpus promoted into Alpha Research.
