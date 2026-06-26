# Hard Grounded Research Estimand Registry

This generated registry states exactly what each category hypothesis estimates. It binds the paper's mechanism claims to target populations, units, contrasts, metrics, estimators, uncertainty methods, sample requirements, and claim gates so pilot diagnostics cannot be mistaken for confirmatory results.

## Summary

- Registry ready: true
- Version: estimand-registry-v1
- Categories: 10
- Estimands: 10
- Target reviewed items/category: 30
- Target reviewed items total: 300
- Pilot systems with uncertainty: 5
- Blocked claim gates: 1
- Diagnostic-only estimands: 10
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_hypotheses_have_estimands | true | 10/10 category hypotheses have estimands |
| estimands_define_population_unit_contrast_metric_estimator | true | 10 estimands define target population, unit, contrast, metric, estimator, and uncertainty method |
| estimands_match_power_and_uncertainty_plan | true | 30 items/category target; 5 systems with pilot uncertainty |
| estimands_require_evidence_contracts | true | 30/30 pilot items have evidence contracts |
| claims_remain_gated | true | 1/4 confirmatory gates blocked; completion_claim_allowed=false |

## Category Estimands

| Category | Unit | Primary contrast | Primary metrics | Estimator | Minimum sample | Claim status |
| --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | item_system_response | multi-hop synthesis vs native single-row or first-evidence baselines | answer_correct<br>evidence_recall<br>conclusion_support | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | 30 HF-derived paper-eligible items in this category and at least two eligible model baselines. | diagnostic_only_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | item_system_response | stale evidence distractors vs current controlling evidence | answer_correct<br>citation_faithfulness<br>conclusion_support | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | 30 HF-derived paper-eligible items in this category and at least two eligible model baselines. | diagnostic_only_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | item_system_response | body-only evidence vs appended lifecycle evidence | answer_correct<br>evidence_recall<br>conclusion_support | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | 30 HF-derived paper-eligible items in this category and at least two eligible model baselines. | diagnostic_only_until_review_scale_and_novelty_clear |
| table + text reasoning | item_system_response | table-only extraction vs table-plus-text interpretation | answer_correct<br>citation_precision<br>conclusion_support | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | 30 HF-derived paper-eligible items in this category and at least two eligible model baselines. | diagnostic_only_until_review_scale_and_novelty_clear |
| source authority conflicts | item_system_response | authority-ranked evidence vs locally plausible lower-authority evidence | answer_correct<br>citation_faithfulness<br>abstention_quality | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | 30 HF-derived paper-eligible items in this category and at least two eligible model baselines. | diagnostic_only_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | item_system_response | near-miss evidence vs sufficient evidence | abstention_quality<br>conclusion_support<br>citation_faithfulness | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | 30 HF-derived paper-eligible items in this category and at least two eligible model baselines. | diagnostic_only_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | item_system_response | premise-supported citation vs conclusion-supported citation | conclusion_support<br>citation_faithfulness<br>answer_correct | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | 30 HF-derived paper-eligible items in this category and at least two eligible model baselines. | diagnostic_only_until_review_scale_and_novelty_clear |
| entity disambiguation | item_system_response | intended entity evidence vs same-name distractor evidence | answer_correct<br>evidence_recall<br>citation_precision | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | 30 HF-derived paper-eligible items in this category and at least two eligible model baselines. | diagnostic_only_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | item_system_response | as-of-date snapshot vs outside-window evidence | answer_correct<br>citation_faithfulness<br>abstention_quality | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | 30 HF-derived paper-eligible items in this category and at least two eligible model baselines. | diagnostic_only_until_review_scale_and_novelty_clear |
| cross-document contradiction | item_system_response | conflicting evidence bundle vs non-conflicting bundle | abstention_quality<br>conclusion_support<br>citation_faithfulness | Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals. | 30 HF-derived paper-eligible items in this category and at least two eligible model baselines. | diagnostic_only_until_review_scale_and_novelty_clear |

## Claim Gates

| Gate | Passed | Detail | Blocker |
| --- | --- | --- | --- |
| gold_review_complete | true | 30/30 HF-derived gold labels ready; human reviewed=0/30 | Generate HF-derived labels or complete double review before promoting gold labels. |
| review_merge_ready | true | HF-derived labels bypass mandatory human-review merge; optional audit merge-ready=0/30 | Generate HF-derived labels or fill reviewer workbooks until strict review merge succeeds. |
| category_scale_ready | true | 300/300 HF-derived paper-eligible items; 0 still needed; 10/10 categories ready | Scale each category to the target HF-derived label count before paper release. |
| novelty_audit_final | false | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
