# Hard Grounded Research Review Return Checklist

This generated checklist converts the first-wave review handoff into exact returned-packet work units. It does not contain human labels, apply returned labels, merge reviews, promote gold, or clear paper-scale review blockers.

## Summary

- Review return checklist ready: true
- Version: review-return-checklist-v1
- Packets: 40
- Expected rows: 160
- Present packets: 0
- Missing packets: 40
- Pilot packets/rows: 20/60
- Expansion packets/rows: 20/100
- Completion claim allowed: false

## Commands

- Dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns`
- Apply after clean dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns --apply`

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| handoff_ready | true | 40 export files; 160 rows |
| return_contract_ready | true | 40 files; findings=0 |
| preflight_ready | true | 0/40 returned files present |
| packet_count_matches_contract | true | 40/40 packets |
| packet_rows_match_contract | true | 160/160 rows |

## Scope Summary

| Scope | Packets | Rows | Present | Missing |
| --- | --- | --- | --- | --- |
| pilot_review | 20 | 60 | 0 | 20 |
| expansion_review | 20 | 100 | 0 | 20 |

## Return Packet Checklist

| Return file | Scope | Category | Reviewer | Rows | Wave | Status |
| --- | --- | --- | --- | --- | --- | --- |
| hgr_review_batch_01.reviewer_a.export.returned.jsonl | pilot_review | multi-hop synthesis | reviewer_a | 3 | unassigned | awaiting_reviewer_return |
| hgr_review_batch_01.reviewer_b.export.returned.jsonl | pilot_review | multi-hop synthesis | reviewer_b | 3 | unassigned | awaiting_reviewer_return |
| hgr_review_batch_02.reviewer_a.export.returned.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_a | 3 | pilot_triage_wave_1<br>pilot_triage_wave_2 | awaiting_reviewer_return |
| hgr_review_batch_02.reviewer_b.export.returned.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_b | 3 | pilot_triage_wave_1<br>pilot_triage_wave_2 | awaiting_reviewer_return |
| hgr_review_batch_03.reviewer_a.export.returned.jsonl | pilot_review | appended document lifecycle changes | reviewer_a | 3 | unassigned | awaiting_reviewer_return |
| hgr_review_batch_03.reviewer_b.export.returned.jsonl | pilot_review | appended document lifecycle changes | reviewer_b | 3 | unassigned | awaiting_reviewer_return |
| hgr_review_batch_04.reviewer_a.export.returned.jsonl | pilot_review | table + text reasoning | reviewer_a | 3 | unassigned | awaiting_reviewer_return |
| hgr_review_batch_04.reviewer_b.export.returned.jsonl | pilot_review | table + text reasoning | reviewer_b | 3 | unassigned | awaiting_reviewer_return |
| hgr_review_batch_05.reviewer_a.export.returned.jsonl | pilot_review | source authority conflicts | reviewer_a | 3 | pilot_triage_wave_2 | awaiting_reviewer_return |
| hgr_review_batch_05.reviewer_b.export.returned.jsonl | pilot_review | source authority conflicts | reviewer_b | 3 | pilot_triage_wave_2 | awaiting_reviewer_return |
| hgr_review_batch_06.reviewer_a.export.returned.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_a | 3 | pilot_triage_wave_1<br>pilot_triage_wave_2 | awaiting_reviewer_return |
| hgr_review_batch_06.reviewer_b.export.returned.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_b | 3 | pilot_triage_wave_1<br>pilot_triage_wave_2 | awaiting_reviewer_return |
| hgr_review_batch_07.reviewer_a.export.returned.jsonl | pilot_review | citation supports fact but not conclusion | reviewer_a | 3 | unassigned | awaiting_reviewer_return |
| hgr_review_batch_07.reviewer_b.export.returned.jsonl | pilot_review | citation supports fact but not conclusion | reviewer_b | 3 | unassigned | awaiting_reviewer_return |
| hgr_review_batch_08.reviewer_a.export.returned.jsonl | pilot_review | entity disambiguation | reviewer_a | 3 | unassigned | awaiting_reviewer_return |
| hgr_review_batch_08.reviewer_b.export.returned.jsonl | pilot_review | entity disambiguation | reviewer_b | 3 | unassigned | awaiting_reviewer_return |
| hgr_review_batch_09.reviewer_a.export.returned.jsonl | pilot_review | temporal questions: as of date X | reviewer_a | 3 | pilot_triage_wave_1<br>pilot_triage_wave_2 | awaiting_reviewer_return |
| hgr_review_batch_09.reviewer_b.export.returned.jsonl | pilot_review | temporal questions: as of date X | reviewer_b | 3 | pilot_triage_wave_1<br>pilot_triage_wave_2 | awaiting_reviewer_return |
| hgr_review_batch_10.reviewer_a.export.returned.jsonl | pilot_review | cross-document contradiction | reviewer_a | 3 | pilot_triage_wave_1 | awaiting_reviewer_return |
| hgr_review_batch_10.reviewer_b.export.returned.jsonl | pilot_review | cross-document contradiction | reviewer_b | 3 | pilot_triage_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_07.reviewer_a.export.returned.jsonl | expansion_review | appended document lifecycle changes | reviewer_a | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_07.reviewer_b.export.returned.jsonl | expansion_review | appended document lifecycle changes | reviewer_b | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_19.reviewer_a.export.returned.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_a | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_19.reviewer_b.export.returned.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_b | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_28.reviewer_a.export.returned.jsonl | expansion_review | cross-document contradiction | reviewer_a | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_28.reviewer_b.export.returned.jsonl | expansion_review | cross-document contradiction | reviewer_b | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_22.reviewer_a.export.returned.jsonl | expansion_review | entity disambiguation | reviewer_a | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_22.reviewer_b.export.returned.jsonl | expansion_review | entity disambiguation | reviewer_b | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_16.reviewer_a.export.returned.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_a | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_16.reviewer_b.export.returned.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_b | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_01.reviewer_a.export.returned.jsonl | expansion_review | multi-hop synthesis | reviewer_a | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_01.reviewer_b.export.returned.jsonl | expansion_review | multi-hop synthesis | reviewer_b | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_13.reviewer_a.export.returned.jsonl | expansion_review | source authority conflicts | reviewer_a | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_13.reviewer_b.export.returned.jsonl | expansion_review | source authority conflicts | reviewer_b | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_04.reviewer_a.export.returned.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_a | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_04.reviewer_b.export.returned.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_b | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_10.reviewer_a.export.returned.jsonl | expansion_review | table + text reasoning | reviewer_a | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_10.reviewer_b.export.returned.jsonl | expansion_review | table + text reasoning | reviewer_b | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_25.reviewer_a.export.returned.jsonl | expansion_review | temporal questions: as of date X | reviewer_a | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
| hgr_scale_batch_25.reviewer_b.export.returned.jsonl | expansion_review | temporal questions: as of date X | reviewer_b | 5 | expansion_balance_wave_1 | awaiting_reviewer_return |
