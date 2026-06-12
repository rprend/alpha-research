# Review Packet

Generated: 2026-06-12T22:01:01.640Z

- Packet id: review_packet_20260612
- Rows: 24
- Decision template rows: 24
- Batch size: 250
- Batches: 1
- Packet CSV: `data/processed/review_packets/review_packet_20260612.csv`
- Decision template CSV: `data/processed/review_packets/review_packet_20260612-decision-template.csv`
- Batch manifest: `data/processed/review_packets/review_packet_20260612-batches.jsonl`

## Batches

| Seq | Batch | Rows | Labels | Decision template |
| ---: | --- | ---: | --- | --- |
| 1 | review_batch_0001 | 24 | editor|director|behind_the_scenes_creator|film_educator|sketch_comedian|vfx_animation|unclear|filmmaker|cinematographer | `data/processed/review_packets/review_packet_20260612-review_batch_0001-decision-template.csv` |

## Review Bands

- borderline: 21
- quality_audit: 3

## Suggested Decisions

- maybe: 21
- keep: 3

Import completed decisions by placing a filled decision CSV in `data/raw/review-decisions/` and running `node docs/experiments/tiktok-creative-creator-graph/scripts/apply-review-decisions.mjs`.
