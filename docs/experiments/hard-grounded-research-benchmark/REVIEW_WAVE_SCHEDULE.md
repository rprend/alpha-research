# Hard Grounded Research Review Wave Schedule

This generated schedule converts missing returned-review files into an ordered collection plan. It does not synthesize labels, mark reviews complete, merge items, promote gold, or clear review gates.

## Summary

- Schedule ready: true
- Version: review-wave-schedule-v1
- Packets: 30
- Waves: 2
- First-wave rows: 124
- Scheduled missing packets: 30
- Returned pending import packets: 0
- Pilot packets: 10
- Expansion packets: 20
- Total review rows remaining: 600
- Completion claim allowed: false

## Commands

- Dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns`
- Apply after clean dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns --apply`
- Refresh schedule: `node scripts/hard-grounded-research-review-wave-schedule.mjs`

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| return_packets_loaded | true | 30/30 return packets scheduled |
| collection_tracker_aligned | true | 30/30 tracker packets aligned |
| pilot_first_wave_present | true | 10 pilot packets scheduled first |
| qa_policy_attached | true | 5 QA rules govern returned review rows |
| completion_still_blocked | true | completion_claim_allowed=false |

## Waves

| Priority | Order | Packets | Rows | Categories | Gate ids | Status |
| --- | --- | --- | --- | --- | --- | --- |
| pilot_gold_first | 1 | 10 | 24 | cross-document contradiction<br>evidence insufficiency / abstention<br>source authority conflicts<br>stale-vs-current document conflicts<br>temporal questions: as of date X | review_preflight_ready<br>review_merge_ready<br>gold_review_complete | awaiting_collection |
| scale_first_wave | 2 | 20 | 100 | appended document lifecycle changes<br>citation supports fact but not conclusion<br>cross-document contradiction<br>entity disambiguation<br>evidence insufficiency / abstention<br>multi-hop synthesis<br>source authority conflicts<br>stale-vs-current document conflicts<br>table + text reasoning<br>temporal questions: as of date X | expansion_review_preflight_ready<br>expansion_review_merge_ready<br>category_scale_ready | awaiting_collection |

## Packet Schedule

| Expected return file | Priority | Scope | Category | Reviewer | Rows | Status |
| --- | --- | --- | --- | --- | --- | --- |
| hgr_review_batch_10.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | cross-document contradiction | reviewer_a | 3 | scheduled_for_collection |
| hgr_review_batch_10.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | cross-document contradiction | reviewer_b | 3 | scheduled_for_collection |
| hgr_review_batch_06.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | evidence insufficiency / abstention | reviewer_a | 2 | scheduled_for_collection |
| hgr_review_batch_06.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | evidence insufficiency / abstention | reviewer_b | 2 | scheduled_for_collection |
| hgr_review_batch_05.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | source authority conflicts | reviewer_a | 2 | scheduled_for_collection |
| hgr_review_batch_05.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | source authority conflicts | reviewer_b | 2 | scheduled_for_collection |
| hgr_review_batch_02.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | stale-vs-current document conflicts | reviewer_a | 2 | scheduled_for_collection |
| hgr_review_batch_02.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | stale-vs-current document conflicts | reviewer_b | 2 | scheduled_for_collection |
| hgr_review_batch_09.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | temporal questions: as of date X | reviewer_a | 3 | scheduled_for_collection |
| hgr_review_batch_09.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | temporal questions: as of date X | reviewer_b | 3 | scheduled_for_collection |
| hgr_scale_batch_07.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | appended document lifecycle changes | reviewer_a | 5 | scheduled_for_collection |
| hgr_scale_batch_07.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | appended document lifecycle changes | reviewer_b | 5 | scheduled_for_collection |
| hgr_scale_batch_19.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | citation supports fact but not conclusion | reviewer_a | 5 | scheduled_for_collection |
| hgr_scale_batch_19.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | citation supports fact but not conclusion | reviewer_b | 5 | scheduled_for_collection |
| hgr_scale_batch_28.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | cross-document contradiction | reviewer_a | 5 | scheduled_for_collection |
| hgr_scale_batch_28.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | cross-document contradiction | reviewer_b | 5 | scheduled_for_collection |
| hgr_scale_batch_22.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | entity disambiguation | reviewer_a | 5 | scheduled_for_collection |
| hgr_scale_batch_22.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | entity disambiguation | reviewer_b | 5 | scheduled_for_collection |
| hgr_scale_batch_16.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | evidence insufficiency / abstention | reviewer_a | 5 | scheduled_for_collection |
| hgr_scale_batch_16.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | evidence insufficiency / abstention | reviewer_b | 5 | scheduled_for_collection |
| hgr_scale_batch_01.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | multi-hop synthesis | reviewer_a | 5 | scheduled_for_collection |
| hgr_scale_batch_01.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | multi-hop synthesis | reviewer_b | 5 | scheduled_for_collection |
| hgr_scale_batch_13.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | source authority conflicts | reviewer_a | 5 | scheduled_for_collection |
| hgr_scale_batch_13.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | source authority conflicts | reviewer_b | 5 | scheduled_for_collection |
| hgr_scale_batch_04.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | stale-vs-current document conflicts | reviewer_a | 5 | scheduled_for_collection |
| hgr_scale_batch_04.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | stale-vs-current document conflicts | reviewer_b | 5 | scheduled_for_collection |
| hgr_scale_batch_10.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | table + text reasoning | reviewer_a | 5 | scheduled_for_collection |
| hgr_scale_batch_10.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | table + text reasoning | reviewer_b | 5 | scheduled_for_collection |
| hgr_scale_batch_25.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | temporal questions: as of date X | reviewer_a | 5 | scheduled_for_collection |
| hgr_scale_batch_25.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | temporal questions: as of date X | reviewer_b | 5 | scheduled_for_collection |
