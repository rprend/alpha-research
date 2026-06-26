# Hard Grounded Research Scale Gap Ledger

This generated ledger turns the paper's category-scale requirement into auditable deficits. It does not clear category-level, review, merge, novelty, or completion claims.

## Summary

- Scale gap ledger ready: true
- Version: scale-gap-ledger-v1
- Categories: 10
- Target reviewed items per category: 30
- Total target reviewed items: 300
- Current valid reviewed items: 0
- Reviewed item deficit: 300
- Planned candidate items: 270
- Planned review rows: 540
- Blocked intake packets: 30
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_categories_have_gap_rows | true | 10/10 categories |
| target_matches_power_plan_scale | true | target=30 |
| deficits_remain_visible | true | 300 reviewed items still needed |
| intake_blocker_linked | true | 30 blocked intake packets |
| release_scale_gate_still_blocked | true | 0/300 valid reviewed target items; 300 reviewed items still needed |

## Release Gates

| Gate | Passed | Detail | Blocker |
| --- | --- | --- | --- |
| category_scale_ready | false | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
| expansion_review_preflight_ready | false | 0/540 complete expansion review rows | Complete all expansion reviewer workbook fields before using scaled candidates for paper claims. |
| expansion_review_merge_ready | false | 0/270 expansion merge-ready items | Resolve expansion reviewer disagreement before using scaled candidates for paper claims. |

## Category Deficits

| Category | Target reviewed | Current reviewed | Deficit | Planned candidates | Planned review rows | Scale claim status |
| --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | 30 | 0 | 30 | 27 | 54 | blocked_until_reviewed_items_meet_target |
| stale-vs-current document conflicts | 30 | 0 | 30 | 27 | 54 | blocked_until_reviewed_items_meet_target |
| appended document lifecycle changes | 30 | 0 | 30 | 27 | 54 | blocked_until_reviewed_items_meet_target |
| table + text reasoning | 30 | 0 | 30 | 27 | 54 | blocked_until_reviewed_items_meet_target |
| source authority conflicts | 30 | 0 | 30 | 27 | 54 | blocked_until_reviewed_items_meet_target |
| evidence insufficiency / abstention | 30 | 0 | 30 | 27 | 54 | blocked_until_reviewed_items_meet_target |
| citation supports fact but not conclusion | 30 | 0 | 30 | 27 | 54 | blocked_until_reviewed_items_meet_target |
| entity disambiguation | 30 | 0 | 30 | 27 | 54 | blocked_until_reviewed_items_meet_target |
| temporal questions: as of date X | 30 | 0 | 30 | 27 | 54 | blocked_until_reviewed_items_meet_target |
| cross-document contradiction | 30 | 0 | 30 | 27 | 54 | blocked_until_reviewed_items_meet_target |
