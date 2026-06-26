# Hard Grounded Research Sensitivity Analysis Plan

This generated plan pre-registers robustness checks for paper results. It defines how conclusions should change, narrow, or remain exploratory when metric strictness, abstention policy, aggregation, model eligibility, missing reviews, or multiple testing assumptions change.

## Summary

- Plan ready: true
- Version: sensitivity-analysis-plan-v1
- Sensitivity checks: 6
- Required metrics covered: 6
- Estimands: 10
- Eligible model baselines: 2
- Blocked claim gates: 1
- HF-derived items: 300/300
- Completion claim allowed: false

## Readiness Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_required_metric_families_have_sensitivity_checks | true | 6 required metrics covered across 6 sensitivity checks |
| estimands_linked_to_sensitivity_checks | true | 10 estimands; 6 checks with estimand links |
| model_reporting_limits_respected | true | 2 eligible baselines; public_leaderboard_allowed=false |
| claims_remain_gated | true | 1/4 confirmatory gates blocked; HF-derived=300/300 |

## Sensitivity Checks

| ID | Perturbation | Affected metrics | Estimand link | Decision rule |
| --- | --- | --- | --- | --- |
| metric_strictness | Recompute headline and category metrics under strict citation faithfulness: any unsupported cited sentence sets citation_faithfulness and conclusion_support to 0. | citation_faithfulness<br>conclusion_support | All category estimands with citation or conclusion metrics. | If a qualitative conclusion changes sign or interval interpretation under strict support, report the claim as sensitivity-dependent. |
| abstention_policy | Score false abstentions as answer errors and compare with a lenient policy that gives partial credit only on reviewed insufficiency or irreconcilable conflict items. | answer_correctness<br>abstention_quality | Evidence insufficiency, cross-document contradiction, and temporal estimands. | Claims about abstention quality require the same direction under strict and lenient policies. |
| aggregation_weighting | Compare unweighted category macro averages with item-weighted overall averages and source-dataset stratified averages. | answer_correctness<br>evidence_recall<br>citation_precision<br>citation_faithfulness<br>conclusion_support<br>abstention_quality | All benchmark-level and category-level estimands. | Benchmark-level claims must disclose when category weighting changes model ordering or effect magnitude by more than the planned uncertainty interval. |
| model_eligibility | Run headline contrasts on eligible external model baselines only, then separately on all diagnostic systems. | answer_correctness<br>evidence_recall<br>citation_precision<br>citation_faithfulness<br>conclusion_support<br>abstention_quality | System comparison estimands and reporting-card claims. | Do not promote a model comparison claim if it appears only after adding diagnostic systems excluded by the reporting card. |
| missing_review_data | Treat missing or non-merge-ready reviewed items as excluded in the primary analysis and as worst-case failures in a conservative bound. | answer_correctness<br>evidence_recall<br>citation_precision<br>citation_faithfulness<br>conclusion_support<br>abstention_quality | All confirmatory reviewed-data estimands. | No category claim is allowed when worst-case missing-review bounds cross the null or contradict the primary direction. |
| multiple_testing | Report unadjusted intervals plus family-level false-discovery or Holm-style sensitivity for the ten category hypotheses. | answer_correct<br>evidence_recall<br>citation_faithfulness<br>conclusion_support<br>abstention_quality | All category hypotheses in the estimand registry. | Treat claims that survive only unadjusted intervals as exploratory, not confirmatory. |

## Claim Gates

| Gate | Passed | Detail | Blocker |
| --- | --- | --- | --- |
| gold_review_complete | true | 30/30 HF-derived gold labels ready; human reviewed=0/30 | Generate HF-derived labels or complete double review before promoting gold labels. |
| review_merge_ready | true | HF-derived labels bypass mandatory human-review merge; optional audit merge-ready=0/30 | Generate HF-derived labels or fill reviewer workbooks until strict review merge succeeds. |
| category_scale_ready | true | 300/300 HF-derived paper-eligible items; 0 still needed; 10/10 categories ready | Scale each category to the target HF-derived label count before paper release. |
| novelty_audit_final | false | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
