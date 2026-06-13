# Review Packet

Generated: 2026-06-13T06:33:23.994Z

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
| 1 | review_batch_0001 | 250 | sketch_comedian|filmmaker|cinematographer|vfx_animation|reject|film_educator|standup_comedian|director|editor|actor_performer|behind_the_scenes_creator | `data/processed/review_packets/review_packet_20260613-review_batch_0001-decision-template.csv` |

## Review Bands

- benchmark_check: 5
- rejection_check: 2
- borderline: 81
- quality_audit: 162

## Suggested Decisions

- excellent_benchmark: 5
- repost_or_aggregator: 2
- maybe: 81
- keep: 162

Import completed decisions by placing a filled decision CSV in `data/raw/review-decisions/` and running `node docs/experiments/tiktok-creative-creator-graph/scripts/apply-review-decisions.mjs`.
