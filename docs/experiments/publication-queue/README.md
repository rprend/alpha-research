# Cultural Observatory Publication Queue

This folder turns experiment artifacts into an editorial queue for Archive Signals / The Cultural Observatory.

It reads experiment `result.json`, `readiness.json`, and `public-draft.md` files, then emits a ranked queue of:

- ready for editorial review
- not ready for publication
- blocked or source-constrained

The queue is not a replacement for source review. It is an operating artifact for deciding what to draft, audit, expand, or publish next.

## Runbook

```bash
node docs/experiments/publication-queue/scripts/build-queue.mjs
```

Outputs:

- `reports/publication-queue.json`
- `reports/publication-queue.csv`
- `reports/publication-queue.md`
- `reports/editorial-calendar.md`

## Publication Rule

Only items with `ready-for-editorial-review` should be considered for public drafting. Items marked `not-ready-for-publication` can be written up only as methods notes or source-access reports.
