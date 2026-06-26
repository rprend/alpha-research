# Hard Grounded Research Review Collection Tracker

This generated tracker converts missing reviewer-return files into an auditable collection queue. It does not synthesize labels, apply returns, merge reviews, promote gold, or clear paper-readiness gates.

## Summary

- Tracker ready: true
- Version: review-collection-tracker-v1
- Packets: 40
- First-wave rows: 160
- Missing packets: 40
- Returned packets: 0
- Pilot missing packets: 20
- Expansion missing packets: 20
- Execution-plan rows remaining: 600
- Completion claim allowed: false

## Commands

- Dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns`
- Apply after clean dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns --apply`
- Refresh tracker: `node scripts/hard-grounded-research-review-collection-tracker.mjs`

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| return_checklist_ready | true | 40 packets; 160 first-wave rows |
| execution_plan_ready | true | 600 total review rows remaining |
| tracker_covers_all_expected_packets | true | 40/40 packets tracked |
| missing_returns_explicit | true | 40/40 missing packets |
| quality_controls_attached | true | 5 QA rules attached to collection workflow |

## Priority Summary

| Priority | Packets | Rows | Missing | Returned |
| --- | --- | --- | --- | --- |
| pilot_gold_first | 20 | 60 | 20 | 0 |
| scale_first_wave | 20 | 100 | 20 | 0 |
| scale_followup | 0 | 0 | 0 | 0 |

## Blocking Review Gates

| Gate | Passed | Detail | Required action |
| --- | --- | --- | --- |
| review_preflight_ready | no | 0/60 complete review rows | Complete all reviewer workbook fields until strict review preflight succeeds. |
| review_merge_ready | no | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| gold_review_complete | no | 0/30 valid reviewed items | Complete double review, resolve disagreements, and promote reviewed gold. |
| expansion_review_preflight_ready | no | 0/540 complete expansion review rows | Complete all expansion reviewer workbook fields before using scaled candidates for paper claims. |
| expansion_review_merge_ready | no | 0/270 expansion merge-ready items | Resolve expansion reviewer disagreement before using scaled candidates for paper claims. |
| category_scale_ready | no | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |

## Next Collection Actions

| # | Action |
| --- | --- |
| 1 | Collect all pilot_gold_first packets before attempting pilot review preflight or gold promotion. |
| 2 | Collect scale_first_wave packets in category order to preserve balanced first-wave expansion coverage. |
| 3 | Run the dry-run importer after every packet drop; only apply after the dry run is clean. |
| 4 | Regenerate review preflight, review merge, expansion preflight, expansion merge, review progress, and release gate after applying real returns. |

## Packet Queue

| Return file | Priority | Scope | Category | Reviewer | Rows | Status |
| --- | --- | --- | --- | --- | --- | --- |
| hgr_review_batch_01.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | multi-hop synthesis | reviewer_a | 3 | missing_return |
| hgr_review_batch_01.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | multi-hop synthesis | reviewer_b | 3 | missing_return |
| hgr_review_batch_02.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | stale-vs-current document conflicts | reviewer_a | 3 | missing_return |
| hgr_review_batch_02.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | stale-vs-current document conflicts | reviewer_b | 3 | missing_return |
| hgr_review_batch_03.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | appended document lifecycle changes | reviewer_a | 3 | missing_return |
| hgr_review_batch_03.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | appended document lifecycle changes | reviewer_b | 3 | missing_return |
| hgr_review_batch_04.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | table + text reasoning | reviewer_a | 3 | missing_return |
| hgr_review_batch_04.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | table + text reasoning | reviewer_b | 3 | missing_return |
| hgr_review_batch_05.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | source authority conflicts | reviewer_a | 3 | missing_return |
| hgr_review_batch_05.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | source authority conflicts | reviewer_b | 3 | missing_return |
| hgr_review_batch_06.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | evidence insufficiency / abstention | reviewer_a | 3 | missing_return |
| hgr_review_batch_06.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | evidence insufficiency / abstention | reviewer_b | 3 | missing_return |
| hgr_review_batch_07.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | citation supports fact but not conclusion | reviewer_a | 3 | missing_return |
| hgr_review_batch_07.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | citation supports fact but not conclusion | reviewer_b | 3 | missing_return |
| hgr_review_batch_08.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | entity disambiguation | reviewer_a | 3 | missing_return |
| hgr_review_batch_08.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | entity disambiguation | reviewer_b | 3 | missing_return |
| hgr_review_batch_09.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | temporal questions: as of date X | reviewer_a | 3 | missing_return |
| hgr_review_batch_09.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | temporal questions: as of date X | reviewer_b | 3 | missing_return |
| hgr_review_batch_10.reviewer_a.export.returned.jsonl | pilot_gold_first | pilot_review | cross-document contradiction | reviewer_a | 3 | missing_return |
| hgr_review_batch_10.reviewer_b.export.returned.jsonl | pilot_gold_first | pilot_review | cross-document contradiction | reviewer_b | 3 | missing_return |
| hgr_scale_batch_07.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | appended document lifecycle changes | reviewer_a | 5 | missing_return |
| hgr_scale_batch_07.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | appended document lifecycle changes | reviewer_b | 5 | missing_return |
| hgr_scale_batch_19.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | citation supports fact but not conclusion | reviewer_a | 5 | missing_return |
| hgr_scale_batch_19.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | citation supports fact but not conclusion | reviewer_b | 5 | missing_return |
| hgr_scale_batch_28.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | cross-document contradiction | reviewer_a | 5 | missing_return |
| hgr_scale_batch_28.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | cross-document contradiction | reviewer_b | 5 | missing_return |
| hgr_scale_batch_22.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | entity disambiguation | reviewer_a | 5 | missing_return |
| hgr_scale_batch_22.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | entity disambiguation | reviewer_b | 5 | missing_return |
| hgr_scale_batch_16.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | evidence insufficiency / abstention | reviewer_a | 5 | missing_return |
| hgr_scale_batch_16.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | evidence insufficiency / abstention | reviewer_b | 5 | missing_return |
| hgr_scale_batch_01.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | multi-hop synthesis | reviewer_a | 5 | missing_return |
| hgr_scale_batch_01.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | multi-hop synthesis | reviewer_b | 5 | missing_return |
| hgr_scale_batch_13.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | source authority conflicts | reviewer_a | 5 | missing_return |
| hgr_scale_batch_13.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | source authority conflicts | reviewer_b | 5 | missing_return |
| hgr_scale_batch_04.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | stale-vs-current document conflicts | reviewer_a | 5 | missing_return |
| hgr_scale_batch_04.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | stale-vs-current document conflicts | reviewer_b | 5 | missing_return |
| hgr_scale_batch_10.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | table + text reasoning | reviewer_a | 5 | missing_return |
| hgr_scale_batch_10.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | table + text reasoning | reviewer_b | 5 | missing_return |
| hgr_scale_batch_25.reviewer_a.export.returned.jsonl | scale_first_wave | expansion_review | temporal questions: as of date X | reviewer_a | 5 | missing_return |
| hgr_scale_batch_25.reviewer_b.export.returned.jsonl | scale_first_wave | expansion_review | temporal questions: as of date X | reviewer_b | 5 | missing_return |
