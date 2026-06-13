# Review Packet

Generated: 2026-06-13T06:07:53.856Z

- Packet id: review_packet_20260613
- Rows: 250
- Decision template rows: 250
- Batch size: 250
- Batches: 1
- Packet CSV: `data/processed/review_packets/review_packet_20260613.csv`
- Decision template CSV: `data/processed/review_packets/review_packet_20260613-decision-template.csv`
- Batch manifest: `data/processed/review_packets/review_packet_20260613-batches.jsonl`

## Batches

| Seq | Batch | Rows | Labels | Decision template |
| ---: | --- | ---: | --- | --- |
| 1 | review_batch_0001 | 250 | sketch_comedian|filmmaker|cinematographer|vfx_animation|editor|film_educator|behind_the_scenes_creator|standup_comedian|director|actor_performer | `data/processed/review_packets/review_packet_20260613-review_batch_0001-decision-template.csv` |

## Review Bands

- benchmark_check: 5
- borderline: 133
- quality_audit: 112

## Suggested Decisions

- excellent_benchmark: 5
- maybe: 133
- keep: 112

Import completed decisions by placing a filled decision CSV in `data/raw/review-decisions/` and running `node docs/experiments/tiktok-creative-creator-graph/scripts/apply-review-decisions.mjs`.
