# Hard Grounded Research Review Dropoff Manifest

This generated manifest defines exactly what reviewers should return and how maintainers validate each drop-off before import. It does not contain returned labels and does not clear review, merge, gold, scale, or completion gates.

## Summary

- Manifest ready: true
- Version: review-dropoff-manifest-v1
- Packets: 30
- Export hashes: 30
- Expected rows: 124
- Pilot packets: 10
- Expansion packets: 20
- Scheduled missing packets: 30
- Completion claim allowed: false

## Commands

- Dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns`
- Apply after clean dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns --apply`
- Refresh manifest: `node scripts/hard-grounded-research-review-dropoff-manifest.mjs`

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| schedule_loaded | true | 30 scheduled packets |
| contract_loaded | true | 30 contract files |
| all_packets_have_hashes | true | 30/30 export files hashed |
| dropoff_paths_match_contract | true | docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns |
| completion_still_blocked | true | completion_claim_allowed=false |

## Dropoff Packets

| Return file | Priority | Scope | Category | Reviewer | Rows | Export sha256 |
| --- | --- | --- | --- | --- | --- | --- |
| hgr_review_batch_10.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | cross-document contradiction | reviewer_a | 3 | 9ca68c932c0f |
| hgr_review_batch_10.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | cross-document contradiction | reviewer_b | 3 | 1b0d805d2876 |
| hgr_review_batch_06.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | evidence insufficiency / abstention | reviewer_a | 2 | f49d88d562ff |
| hgr_review_batch_06.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | evidence insufficiency / abstention | reviewer_b | 2 | dccb48ca6d49 |
| hgr_review_batch_05.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | source authority conflicts | reviewer_a | 2 | 0c99b3a78a47 |
| hgr_review_batch_05.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | source authority conflicts | reviewer_b | 2 | 7c896303b761 |
| hgr_review_batch_02.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | stale-vs-current document conflicts | reviewer_a | 2 | b01aa22592be |
| hgr_review_batch_02.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | stale-vs-current document conflicts | reviewer_b | 2 | e0a535be0943 |
| hgr_review_batch_09.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | temporal questions: as of date X | reviewer_a | 3 | a3f4a88de959 |
| hgr_review_batch_09.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | temporal questions: as of date X | reviewer_b | 3 | 604f923fd042 |
| hgr_scale_batch_07.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | appended document lifecycle changes | reviewer_a | 5 | ffcc31949234 |
| hgr_scale_batch_07.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | appended document lifecycle changes | reviewer_b | 5 | 136a885e81dc |
| hgr_scale_batch_19.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | citation supports fact but not conclusion | reviewer_a | 5 | 2a050625001b |
| hgr_scale_batch_19.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | citation supports fact but not conclusion | reviewer_b | 5 | 0a9d4aeb7647 |
| hgr_scale_batch_28.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | cross-document contradiction | reviewer_a | 5 | ffb87dc00692 |
| hgr_scale_batch_28.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | cross-document contradiction | reviewer_b | 5 | feaa35bc6179 |
| hgr_scale_batch_22.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | entity disambiguation | reviewer_a | 5 | b55f2c7938e2 |
| hgr_scale_batch_22.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | entity disambiguation | reviewer_b | 5 | 054d2ca97310 |
| hgr_scale_batch_16.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | evidence insufficiency / abstention | reviewer_a | 5 | b94d613d8e7c |
| hgr_scale_batch_16.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | evidence insufficiency / abstention | reviewer_b | 5 | 2d827fe30f5c |
| hgr_scale_batch_01.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | multi-hop synthesis | reviewer_a | 5 | 9036cf0b8066 |
| hgr_scale_batch_01.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | multi-hop synthesis | reviewer_b | 5 | 7116e99a99e8 |
| hgr_scale_batch_13.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | source authority conflicts | reviewer_a | 5 | 49e9ba9c2c94 |
| hgr_scale_batch_13.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | source authority conflicts | reviewer_b | 5 | a2e0a99721f4 |
| hgr_scale_batch_04.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | stale-vs-current document conflicts | reviewer_a | 5 | ea4a84a761d8 |
| hgr_scale_batch_04.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | stale-vs-current document conflicts | reviewer_b | 5 | de2e601c92d9 |
| hgr_scale_batch_10.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | table + text reasoning | reviewer_a | 5 | 2719d4081cff |
| hgr_scale_batch_10.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | table + text reasoning | reviewer_b | 5 | 6e8e1a7f45fd |
| hgr_scale_batch_25.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | temporal questions: as of date X | reviewer_a | 5 | 47d8c71c3e07 |
| hgr_scale_batch_25.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | temporal questions: as of date X | reviewer_b | 5 | 99388512bd81 |
