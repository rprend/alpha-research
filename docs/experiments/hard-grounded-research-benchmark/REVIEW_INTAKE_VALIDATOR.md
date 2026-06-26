# Hard Grounded Research Review Intake Validator

This generated validator defines the packet-level acceptance decision before reviewer returns can be applied. It does not contain returned labels and does not clear review, merge, gold, scale, or completion gates.

## Summary

- Intake validator ready: true
- Version: review-intake-validator-v1
- Packets: 40
- Accepted packets: 0
- Blocked packets: 40
- Present return files: 0
- Missing return files: 40
- Latest import ready: true
- Latest import findings: 0
- Completion claim allowed: false

## Commands

- Refresh dropoff manifest: `node scripts/hard-grounded-research-review-dropoff-manifest.mjs`
- Dry-run import: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns`
- Apply after all packets accepted: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns --apply`
- Refresh intake validator: `node scripts/hard-grounded-research-review-intake-validator.mjs`

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| dropoff_manifest_loaded | true | 40 dropoff packets |
| return_preflight_loaded | true | 0/40 returned files present |
| all_packets_have_intake_rows | true | 40/40 intake rows |
| apply_blocked_until_clean_dry_run | true | 0 accepted; 40 blocked; import_ready=true |
| completion_still_blocked | true | completion_claim_allowed=false |

## Intake Rows

| Return file | Scope | Category | Reviewer | Rows | Present | Status |
| --- | --- | --- | --- | --- | --- | --- |
| hgr_review_batch_03.reviewer_a.export.returned.jsonl | pilot_review | appended document lifecycle changes | reviewer_a | 3 | false | blocked_before_apply |
| hgr_review_batch_03.reviewer_b.export.returned.jsonl | pilot_review | appended document lifecycle changes | reviewer_b | 3 | false | blocked_before_apply |
| hgr_review_batch_07.reviewer_a.export.returned.jsonl | pilot_review | citation supports fact but not conclusion | reviewer_a | 3 | false | blocked_before_apply |
| hgr_review_batch_07.reviewer_b.export.returned.jsonl | pilot_review | citation supports fact but not conclusion | reviewer_b | 3 | false | blocked_before_apply |
| hgr_review_batch_10.reviewer_a.export.returned.jsonl | pilot_review | cross-document contradiction | reviewer_a | 3 | false | blocked_before_apply |
| hgr_review_batch_10.reviewer_b.export.returned.jsonl | pilot_review | cross-document contradiction | reviewer_b | 3 | false | blocked_before_apply |
| hgr_review_batch_08.reviewer_a.export.returned.jsonl | pilot_review | entity disambiguation | reviewer_a | 3 | false | blocked_before_apply |
| hgr_review_batch_08.reviewer_b.export.returned.jsonl | pilot_review | entity disambiguation | reviewer_b | 3 | false | blocked_before_apply |
| hgr_review_batch_06.reviewer_a.export.returned.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_a | 3 | false | blocked_before_apply |
| hgr_review_batch_06.reviewer_b.export.returned.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_b | 3 | false | blocked_before_apply |
| hgr_review_batch_01.reviewer_a.export.returned.jsonl | pilot_review | multi-hop synthesis | reviewer_a | 3 | false | blocked_before_apply |
| hgr_review_batch_01.reviewer_b.export.returned.jsonl | pilot_review | multi-hop synthesis | reviewer_b | 3 | false | blocked_before_apply |
| hgr_review_batch_05.reviewer_a.export.returned.jsonl | pilot_review | source authority conflicts | reviewer_a | 3 | false | blocked_before_apply |
| hgr_review_batch_05.reviewer_b.export.returned.jsonl | pilot_review | source authority conflicts | reviewer_b | 3 | false | blocked_before_apply |
| hgr_review_batch_02.reviewer_a.export.returned.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_a | 3 | false | blocked_before_apply |
| hgr_review_batch_02.reviewer_b.export.returned.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_b | 3 | false | blocked_before_apply |
| hgr_review_batch_04.reviewer_a.export.returned.jsonl | pilot_review | table + text reasoning | reviewer_a | 3 | false | blocked_before_apply |
| hgr_review_batch_04.reviewer_b.export.returned.jsonl | pilot_review | table + text reasoning | reviewer_b | 3 | false | blocked_before_apply |
| hgr_review_batch_09.reviewer_a.export.returned.jsonl | pilot_review | temporal questions: as of date X | reviewer_a | 3 | false | blocked_before_apply |
| hgr_review_batch_09.reviewer_b.export.returned.jsonl | pilot_review | temporal questions: as of date X | reviewer_b | 3 | false | blocked_before_apply |
| hgr_scale_batch_07.reviewer_a.export.returned.jsonl | expansion_review | appended document lifecycle changes | reviewer_a | 5 | false | blocked_before_apply |
| hgr_scale_batch_07.reviewer_b.export.returned.jsonl | expansion_review | appended document lifecycle changes | reviewer_b | 5 | false | blocked_before_apply |
| hgr_scale_batch_19.reviewer_a.export.returned.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_a | 5 | false | blocked_before_apply |
| hgr_scale_batch_19.reviewer_b.export.returned.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_b | 5 | false | blocked_before_apply |
| hgr_scale_batch_28.reviewer_a.export.returned.jsonl | expansion_review | cross-document contradiction | reviewer_a | 5 | false | blocked_before_apply |
| hgr_scale_batch_28.reviewer_b.export.returned.jsonl | expansion_review | cross-document contradiction | reviewer_b | 5 | false | blocked_before_apply |
| hgr_scale_batch_22.reviewer_a.export.returned.jsonl | expansion_review | entity disambiguation | reviewer_a | 5 | false | blocked_before_apply |
| hgr_scale_batch_22.reviewer_b.export.returned.jsonl | expansion_review | entity disambiguation | reviewer_b | 5 | false | blocked_before_apply |
| hgr_scale_batch_16.reviewer_a.export.returned.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_a | 5 | false | blocked_before_apply |
| hgr_scale_batch_16.reviewer_b.export.returned.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_b | 5 | false | blocked_before_apply |
| hgr_scale_batch_01.reviewer_a.export.returned.jsonl | expansion_review | multi-hop synthesis | reviewer_a | 5 | false | blocked_before_apply |
| hgr_scale_batch_01.reviewer_b.export.returned.jsonl | expansion_review | multi-hop synthesis | reviewer_b | 5 | false | blocked_before_apply |
| hgr_scale_batch_13.reviewer_a.export.returned.jsonl | expansion_review | source authority conflicts | reviewer_a | 5 | false | blocked_before_apply |
| hgr_scale_batch_13.reviewer_b.export.returned.jsonl | expansion_review | source authority conflicts | reviewer_b | 5 | false | blocked_before_apply |
| hgr_scale_batch_04.reviewer_a.export.returned.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_a | 5 | false | blocked_before_apply |
| hgr_scale_batch_04.reviewer_b.export.returned.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_b | 5 | false | blocked_before_apply |
| hgr_scale_batch_10.reviewer_a.export.returned.jsonl | expansion_review | table + text reasoning | reviewer_a | 5 | false | blocked_before_apply |
| hgr_scale_batch_10.reviewer_b.export.returned.jsonl | expansion_review | table + text reasoning | reviewer_b | 5 | false | blocked_before_apply |
| hgr_scale_batch_25.reviewer_a.export.returned.jsonl | expansion_review | temporal questions: as of date X | reviewer_a | 5 | false | blocked_before_apply |
| hgr_scale_batch_25.reviewer_b.export.returned.jsonl | expansion_review | temporal questions: as of date X | reviewer_b | 5 | false | blocked_before_apply |
