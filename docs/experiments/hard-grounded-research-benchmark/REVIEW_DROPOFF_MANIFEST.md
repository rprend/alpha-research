# Hard Grounded Research Review Dropoff Manifest

This generated manifest defines exactly what reviewers should return and how maintainers validate each drop-off before import. It does not contain returned labels and does not clear review, merge, gold, scale, or completion gates.

## Summary

- Manifest ready: true
- Version: review-dropoff-manifest-v1
- Packets: 40
- Export hashes: 40
- Expected rows: 160
- Pilot packets: 20
- Expansion packets: 20
- Scheduled missing packets: 40
- Completion claim allowed: false

## Commands

- Dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns`
- Apply after clean dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns --apply`
- Refresh manifest: `node scripts/hard-grounded-research-review-dropoff-manifest.mjs`

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| schedule_loaded | true | 40 scheduled packets |
| contract_loaded | true | 40 contract files |
| all_packets_have_hashes | true | 40/40 export files hashed |
| dropoff_paths_match_contract | true | docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns |
| completion_still_blocked | true | completion_claim_allowed=false |

## Dropoff Packets

| Return file | Priority | Scope | Category | Reviewer | Rows | Export sha256 |
| --- | --- | --- | --- | --- | --- | --- |
| hgr_review_batch_03.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | appended document lifecycle changes | reviewer_a | 3 | 17bee09434aa |
| hgr_review_batch_03.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | appended document lifecycle changes | reviewer_b | 3 | a0b434342acd |
| hgr_review_batch_07.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | citation supports fact but not conclusion | reviewer_a | 3 | 671c904302fd |
| hgr_review_batch_07.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | citation supports fact but not conclusion | reviewer_b | 3 | bb3ec8424c6c |
| hgr_review_batch_10.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | cross-document contradiction | reviewer_a | 3 | 9ca68c932c0f |
| hgr_review_batch_10.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | cross-document contradiction | reviewer_b | 3 | 1b0d805d2876 |
| hgr_review_batch_08.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | entity disambiguation | reviewer_a | 3 | 2125e16d85c2 |
| hgr_review_batch_08.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | entity disambiguation | reviewer_b | 3 | 6a5c189df86c |
| hgr_review_batch_06.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | evidence insufficiency / abstention | reviewer_a | 3 | 68b332e24511 |
| hgr_review_batch_06.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | evidence insufficiency / abstention | reviewer_b | 3 | 8de6f93306bf |
| hgr_review_batch_01.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | multi-hop synthesis | reviewer_a | 3 | e3a6704586a7 |
| hgr_review_batch_01.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | multi-hop synthesis | reviewer_b | 3 | 16cf1ca5500f |
| hgr_review_batch_05.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | source authority conflicts | reviewer_a | 3 | 1b7bfc1caadb |
| hgr_review_batch_05.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | source authority conflicts | reviewer_b | 3 | 760f0dd5f182 |
| hgr_review_batch_02.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | stale-vs-current document conflicts | reviewer_a | 3 | 945c0365c639 |
| hgr_review_batch_02.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | stale-vs-current document conflicts | reviewer_b | 3 | 7aa85d32594b |
| hgr_review_batch_04.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | table + text reasoning | reviewer_a | 3 | 9ad5d6260208 |
| hgr_review_batch_04.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | table + text reasoning | reviewer_b | 3 | b5e04b54d4d5 |
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
