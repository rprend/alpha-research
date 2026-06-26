# Hard Grounded Research Scale Gap Ledger

This generated ledger turns the paper's category-scale requirement into auditable HF-derived item counts. Human review rows remain optional audit infrastructure and do not define the primary labels.

## Summary

- Scale gap ledger ready: true
- Version: scale-gap-ledger-v1
- Categories: 10
- Target HF-derived items per category: 30
- Total target HF-derived items: 300
- Current HF-derived items: 300
- HF-derived item deficit: 0
- Planned candidate items: 270
- Planned optional audit review rows: 540
- Blocked intake packets: 40
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_categories_have_gap_rows | true | 10/10 categories |
| target_matches_power_plan_scale | true | target=30 |
| hf_derived_deficits_resolved | true | 0 HF-derived items still needed |
| intake_blocker_linked | true | 40 blocked intake packets |
| release_scale_gate_passed | true | 300/300 HF-derived paper-eligible items; 0 still needed; 10/10 categories ready |

## Release Gates

| Gate | Passed | Detail | Blocker |
| --- | --- | --- | --- |
| category_scale_ready | true | 300/300 HF-derived paper-eligible items; 0 still needed; 10/10 categories ready | Scale each category to the target HF-derived label count before paper release. |
| expansion_review_preflight_ready | true | HF-derived labels bypass mandatory expansion human-review preflight; optional audit rows=0/540 | Generate HF-derived labels for scaled candidates or complete expansion reviewer workbook fields before using scaled candidates for paper claims. |
| expansion_review_merge_ready | true | HF-derived labels bypass mandatory expansion review merge; optional audit merge-ready=0/270 | Generate HF-derived labels for scaled candidates or resolve expansion reviewer disagreement before using scaled candidates for paper claims. |

## Category Deficits

| Category | Target derived | Current derived | Deficit | Planned candidates | Optional audit rows | Scale claim status |
| --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | 30 | 30 | 0 | 27 | 54 | scale_claim_allowed |
| stale-vs-current document conflicts | 30 | 30 | 0 | 27 | 54 | scale_claim_allowed |
| appended document lifecycle changes | 30 | 30 | 0 | 27 | 54 | scale_claim_allowed |
| table + text reasoning | 30 | 30 | 0 | 27 | 54 | scale_claim_allowed |
| source authority conflicts | 30 | 30 | 0 | 27 | 54 | scale_claim_allowed |
| evidence insufficiency / abstention | 30 | 30 | 0 | 27 | 54 | scale_claim_allowed |
| citation supports fact but not conclusion | 30 | 30 | 0 | 27 | 54 | scale_claim_allowed |
| entity disambiguation | 30 | 30 | 0 | 27 | 54 | scale_claim_allowed |
| temporal questions: as of date X | 30 | 30 | 0 | 27 | 54 | scale_claim_allowed |
| cross-document contradiction | 30 | 30 | 0 | 27 | 54 | scale_claim_allowed |
