# Review Packet

Generated: 2026-06-12T21:38:08.564Z

- Packet id: review_packet_20260612
- Rows: 4
- Decision template rows: 4
- Batch size: 250
- Batches: 1
- Packet CSV: `data/processed/review_packets/review_packet_20260612.csv`
- Decision template CSV: `data/processed/review_packets/review_packet_20260612-decision-template.csv`
- Batch manifest: `data/processed/review_packets/review_packet_20260612-batches.jsonl`

## Batches

| Seq | Batch | Rows | Labels | Decision template |
| ---: | --- | ---: | --- | --- |
| 1 | review_batch_0001 | 4 | vfx_animation|sketch_comedian|filmmaker | `data/processed/review_packets/review_packet_20260612-review_batch_0001-decision-template.csv` |

## Review Bands

- quality_audit: 3
- borderline: 1

## Suggested Decisions

- keep: 3
- maybe: 1

Import completed decisions by placing a filled decision CSV in `data/raw/review-decisions/` and running `node docs/experiments/tiktok-creative-creator-graph/scripts/apply-review-decisions.mjs`.
