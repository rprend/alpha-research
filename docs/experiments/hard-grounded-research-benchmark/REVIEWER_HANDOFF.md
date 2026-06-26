# Hard Grounded Research Reviewer Handoff

This generated packet is the reviewer-facing handoff contract for the current first-wave annotation export. It does not contain completed labels and does not clear gold review blockers.

## Summary

- Handoff ready: true
- Editable path: `reviewer_fields`
- Export files: 40
- Export rows: 160
- Pilot export rows: 60
- Expansion export rows: 100
- Urgent/high pilot items represented in triage: 23
- Remaining pilot review rows: 60
- Remaining expansion review rows: 540
- Return readiness: true
- Expected returned files: 40
- Expected returned rows: 160

## Reviewer Field Contract

Reviewers may edit only `reviewer_fields`.

Required reviewer fields: `final_label`, `final_answer`, `required_citation_ids`, `insufficient_or_conflicting_evidence`, `notes`, `reviewer_confidence`.

Expansion-only fields: `category_fit`, `generation_defect`.

Reviewers must not edit: `item_id`, `category`, `challenge_type`, `question`, `candidate_answer`, `evidence_units`, `required_dimensions`, `rubric`, `quality_findings`.

## Review Waves

| Wave | Scope | Assignments | Rows or items | Categories |
| --- | --- | --- | --- | --- |
| pilot_triage_wave_1 | pilot_review | 6 | 6 | cross-document contradiction<br>evidence insufficiency / abstention<br>stale-vs-current document conflicts<br>temporal questions: as of date X |
| pilot_triage_wave_2 | pilot_review | 6 | 6 | evidence insufficiency / abstention<br>source authority conflicts<br>stale-vs-current document conflicts<br>temporal questions: as of date X |
| expansion_balance_wave_1 | expansion_review | 10 | 100 | appended document lifecycle changes<br>citation supports fact but not conclusion<br>cross-document contradiction<br>entity disambiguation<br>evidence insufficiency / abstention<br>multi-hop synthesis<br>source authority conflicts<br>stale-vs-current document conflicts<br>table + text reasoning<br>temporal questions: as of date X |

## Acceptance Gates

| Gate | Passed | Detail |
| --- | --- | --- |
| reviewer_fields_only | yes | Returned packets may edit only reviewer_fields. |
| export_complete | yes | 160 rows across 40 export files. |
| import_smoke_clean | yes | 160 fixture rows checked; findings=0. |
| import_path_ready | yes | 160/160 rows importable; applied=false. |
| return_readiness_present | yes | 40 expected returned files; 160 expected rows. |
| human_labels_not_started | yes | 0/60 pilot rows complete; 0/540 expansion rows complete. |

## Return Readiness Checklist

| Step | Requirement |
| --- | --- |
| 1 | Return one JSONL file for each exported JSONL file. |
| 2 | Preserve item_id, source_workbook_id, export_scope, evidence_units, rubric, and quality_findings exactly. |
| 3 | Fill every required reviewer field on every row. |
| 4 | Use category_fit and generation_defect only for expansion_review packets. |
| 5 | Run the annotation import dry-run before applying returned packets. |

Dry-run command: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=<returned-reviewer-packet-dir>`

Apply command: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=<returned-reviewer-packet-dir> --apply`

## Import And Merge Commands

| Purpose | Command |
| --- | --- |
| Dry-run returned reviewer packets without modifying workbooks | `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke --allow-fixture` |
| Apply real returned reviewer packets after dry-run passes | `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=<returned-reviewer-packet-dir> --apply` |
| Check pilot review completeness after imports | `node scripts/hard-grounded-research-review-preflight.mjs` |
| Check expansion review completeness after imports | `node scripts/hard-grounded-research-expansion-review-preflight.mjs` |
| Merge pilot review labels after preflight is clean | `node scripts/hard-grounded-research-review-merge.mjs` |
| Merge expansion review labels after preflight is clean | `node scripts/hard-grounded-research-expansion-review-merge.mjs` |

## Export Files

| File | Scope | Workbook | Category | Rows exported/expected return | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| generated/annotation-export/hgr_review_batch_01.reviewer_a.export.jsonl | pilot_review | hgr_review_batch_01.reviewer_a | multi-hop synthesis | 3/3 | e3a6704586a71cc5c07e5585cc10610682d3407be288f3e8059db44c4bf0539f |
| generated/annotation-export/hgr_review_batch_01.reviewer_b.export.jsonl | pilot_review | hgr_review_batch_01.reviewer_b | multi-hop synthesis | 3/3 | 16cf1ca5500face325e319fd7563a57fa67aa728520ae183b59abc8df591b583 |
| generated/annotation-export/hgr_review_batch_02.reviewer_a.export.jsonl | pilot_review | hgr_review_batch_02.reviewer_a | stale-vs-current document conflicts | 3/3 | 945c0365c63983925fd8475bdd7e7d17f023daf40021177a519c6ada97109ac3 |
| generated/annotation-export/hgr_review_batch_02.reviewer_b.export.jsonl | pilot_review | hgr_review_batch_02.reviewer_b | stale-vs-current document conflicts | 3/3 | 7aa85d32594bf7e7bade17e15392e8a9d7a388464ed0e620f49cd454fb53dd9e |
| generated/annotation-export/hgr_review_batch_03.reviewer_a.export.jsonl | pilot_review | hgr_review_batch_03.reviewer_a | appended document lifecycle changes | 3/3 | 17bee09434aadda6513f617c87eb77a6e4c656b36b42757dd6e8fdc3f367be14 |
| generated/annotation-export/hgr_review_batch_03.reviewer_b.export.jsonl | pilot_review | hgr_review_batch_03.reviewer_b | appended document lifecycle changes | 3/3 | a0b434342acd8cc8d30c5017ef13ac69d659a9daed364a65e416b081bcb33b46 |
| generated/annotation-export/hgr_review_batch_04.reviewer_a.export.jsonl | pilot_review | hgr_review_batch_04.reviewer_a | table + text reasoning | 3/3 | 9ad5d62602080bb07a52979e2bbd4f1e71a1d01b33fc390af48aa4632023d533 |
| generated/annotation-export/hgr_review_batch_04.reviewer_b.export.jsonl | pilot_review | hgr_review_batch_04.reviewer_b | table + text reasoning | 3/3 | b5e04b54d4d5327b945a9d9124d3be68b8c3107be38996eaa805efb09c71da35 |
| generated/annotation-export/hgr_review_batch_05.reviewer_a.export.jsonl | pilot_review | hgr_review_batch_05.reviewer_a | source authority conflicts | 3/3 | 1b7bfc1caadbe7d2a202c0292524faf87fe54d9a6f1d5fd1c122dc8c143a0e45 |
| generated/annotation-export/hgr_review_batch_05.reviewer_b.export.jsonl | pilot_review | hgr_review_batch_05.reviewer_b | source authority conflicts | 3/3 | 760f0dd5f18259e17c1c124ca692ce70dbd363a3e7e810bb1aa10522e9048472 |
| generated/annotation-export/hgr_review_batch_06.reviewer_a.export.jsonl | pilot_review | hgr_review_batch_06.reviewer_a | evidence insufficiency / abstention | 3/3 | 68b332e245116582cc3a4dd495c76f3d87c197220f092e344abedb7e7cc50e83 |
| generated/annotation-export/hgr_review_batch_06.reviewer_b.export.jsonl | pilot_review | hgr_review_batch_06.reviewer_b | evidence insufficiency / abstention | 3/3 | 8de6f93306bf056d068b338e55bf98a0705d0df531693a4e46ac08cac62c28ee |
| generated/annotation-export/hgr_review_batch_07.reviewer_a.export.jsonl | pilot_review | hgr_review_batch_07.reviewer_a | citation supports fact but not conclusion | 3/3 | 671c904302fdc672c893f889a71f4498cd4a49b900b98a497dcd7217c0a6cb60 |
| generated/annotation-export/hgr_review_batch_07.reviewer_b.export.jsonl | pilot_review | hgr_review_batch_07.reviewer_b | citation supports fact but not conclusion | 3/3 | bb3ec8424c6cd11d5826412131776bb5c1769a59e2f176fc39c6f43059430fd3 |
| generated/annotation-export/hgr_review_batch_08.reviewer_a.export.jsonl | pilot_review | hgr_review_batch_08.reviewer_a | entity disambiguation | 3/3 | 2125e16d85c22dcb539f46375def8ea256702c9c040eacaf98de2fd7f2188c61 |
| generated/annotation-export/hgr_review_batch_08.reviewer_b.export.jsonl | pilot_review | hgr_review_batch_08.reviewer_b | entity disambiguation | 3/3 | 6a5c189df86c3382172ebcbb9f04a46748e132309599fab76bdb701e2125f576 |
| generated/annotation-export/hgr_review_batch_09.reviewer_a.export.jsonl | pilot_review | hgr_review_batch_09.reviewer_a | temporal questions: as of date X | 3/3 | a3f4a88de959776bb1ecd5d15a2c7260fccd5f93d9fa36e10e6145e675b10400 |
| generated/annotation-export/hgr_review_batch_09.reviewer_b.export.jsonl | pilot_review | hgr_review_batch_09.reviewer_b | temporal questions: as of date X | 3/3 | 604f923fd042461f482961060660e37533d2fcdf945002f1d1ac3cf584d49a06 |
| generated/annotation-export/hgr_review_batch_10.reviewer_a.export.jsonl | pilot_review | hgr_review_batch_10.reviewer_a | cross-document contradiction | 3/3 | 9ca68c932c0f1cdd6350fd3bd8afef5522f7be0b9e1a7bab98a85e4c12c5b7de |
| generated/annotation-export/hgr_review_batch_10.reviewer_b.export.jsonl | pilot_review | hgr_review_batch_10.reviewer_b | cross-document contradiction | 3/3 | 1b0d805d2876695c0512b5239b7c84955dd4b5bc6e5ed5938c92c7e0b8445c17 |
| generated/annotation-export/hgr_scale_batch_07.reviewer_a.export.jsonl | expansion_review | hgr_scale_batch_07.reviewer_a | appended document lifecycle changes | 5/5 | ffcc319492340730a495b0cfba7bddef11a20f3cb900c617c397d7d93de14c5c |
| generated/annotation-export/hgr_scale_batch_07.reviewer_b.export.jsonl | expansion_review | hgr_scale_batch_07.reviewer_b | appended document lifecycle changes | 5/5 | 136a885e81dca3f9094321654d8bc18878cb4b70cea493217acf038120b16f6d |
| generated/annotation-export/hgr_scale_batch_19.reviewer_a.export.jsonl | expansion_review | hgr_scale_batch_19.reviewer_a | citation supports fact but not conclusion | 5/5 | 2a050625001b6ec70ff9c387a097f8864550761148618cd5dab187983e3f18b3 |
| generated/annotation-export/hgr_scale_batch_19.reviewer_b.export.jsonl | expansion_review | hgr_scale_batch_19.reviewer_b | citation supports fact but not conclusion | 5/5 | 0a9d4aeb76472c3cd35c560e9863ebd155e6576693bc4191ac133e2307258c72 |
| generated/annotation-export/hgr_scale_batch_28.reviewer_a.export.jsonl | expansion_review | hgr_scale_batch_28.reviewer_a | cross-document contradiction | 5/5 | ffb87dc00692652b4875b0ae519923f2e418fe72398e01b25398e6dc30c30174 |
| generated/annotation-export/hgr_scale_batch_28.reviewer_b.export.jsonl | expansion_review | hgr_scale_batch_28.reviewer_b | cross-document contradiction | 5/5 | feaa35bc61794984c0edf4d4b9a42f0be6fa0cb8da257c31f1a3a12213cbbf10 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_a.export.jsonl | expansion_review | hgr_scale_batch_22.reviewer_a | entity disambiguation | 5/5 | b55f2c7938e28ac5da4c29272b8c9d78e78a3b31a6bf8e9baaab885b829e68e9 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_b.export.jsonl | expansion_review | hgr_scale_batch_22.reviewer_b | entity disambiguation | 5/5 | 054d2ca9731061559d4cb59f7c92480a9520dd0827ff27804fe1c1151d7ce0ef |
| generated/annotation-export/hgr_scale_batch_16.reviewer_a.export.jsonl | expansion_review | hgr_scale_batch_16.reviewer_a | evidence insufficiency / abstention | 5/5 | b94d613d8e7cc13bbba336c16230de9895c8b7d4350d8252155dae735d0dc164 |
| generated/annotation-export/hgr_scale_batch_16.reviewer_b.export.jsonl | expansion_review | hgr_scale_batch_16.reviewer_b | evidence insufficiency / abstention | 5/5 | 2d827fe30f5cb40f2095627ccdd840dcaa72e24d3d138da504fdb5b22f79b0e6 |
| generated/annotation-export/hgr_scale_batch_01.reviewer_a.export.jsonl | expansion_review | hgr_scale_batch_01.reviewer_a | multi-hop synthesis | 5/5 | 9036cf0b806689e2f1ccaba02aaca2db693f02d0dd39e5fff93b9f5bb32efe50 |
| generated/annotation-export/hgr_scale_batch_01.reviewer_b.export.jsonl | expansion_review | hgr_scale_batch_01.reviewer_b | multi-hop synthesis | 5/5 | 7116e99a99e88e027be574e19a35cacc0aa65e33803f6696ac883d31dd3ba827 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_a.export.jsonl | expansion_review | hgr_scale_batch_13.reviewer_a | source authority conflicts | 5/5 | 49e9ba9c2c9439254ab8e1f265141e13e06bdf67884a6bdb3619afffe275d5f3 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_b.export.jsonl | expansion_review | hgr_scale_batch_13.reviewer_b | source authority conflicts | 5/5 | a2e0a99721f46849635bc8dd350d7476226cdd855fbc881940bd97a3f9fc7278 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_a.export.jsonl | expansion_review | hgr_scale_batch_04.reviewer_a | stale-vs-current document conflicts | 5/5 | ea4a84a761d88b58bfe4b1ce52f23876b873969168832a9e3489bca042890f27 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_b.export.jsonl | expansion_review | hgr_scale_batch_04.reviewer_b | stale-vs-current document conflicts | 5/5 | de2e601c92d95bdfe74562cedd914dfb61f5ca9fa6ba3cfa116ddd33291bf5a7 |
| generated/annotation-export/hgr_scale_batch_10.reviewer_a.export.jsonl | expansion_review | hgr_scale_batch_10.reviewer_a | table + text reasoning | 5/5 | 2719d4081cff184e0a0d7fba0563ed7f72dbb099b145f16aa7c6ee55355fc212 |
| generated/annotation-export/hgr_scale_batch_10.reviewer_b.export.jsonl | expansion_review | hgr_scale_batch_10.reviewer_b | table + text reasoning | 5/5 | 6e8e1a7f45fdb8633b927cdf8093ebbaa3b7ba371846fad21d702dd451cdf837 |
| generated/annotation-export/hgr_scale_batch_25.reviewer_a.export.jsonl | expansion_review | hgr_scale_batch_25.reviewer_a | temporal questions: as of date X | 5/5 | 47d8c71c3e07f658a7c2e3aa53a0878cb794a7a867b955827f46a78529b503ef |
| generated/annotation-export/hgr_scale_batch_25.reviewer_b.export.jsonl | expansion_review | hgr_scale_batch_25.reviewer_b | temporal questions: as of date X | 5/5 | 99388512bd81ecd85e8feaa45471afdd3a1e0de38092c8523482198df0e5affc |
