# Hard Grounded Research Responsible Use

This generated policy records how the benchmark may be described, packaged, and used while review, scale, and final novelty gates remain incomplete. It is a release-surface guardrail, not evidence that the benchmark is complete.

## Summary

- Responsible-use policy ready: true
- Completion claim allowed: false
- Public leaderboard allowed: false
- Policy rules: 6
- Active restrictions: 2

## Policy Rules

| Rule id | Status | Rule | Evidence |
| --- | --- | --- | --- |
| no_public_leaderboard_before_gold | active_restriction | Do not publish a model leaderboard until HF-derived scale, eligible model-baseline, and final novelty gates pass; human review is optional audit. | hf-derived-label-suite-v1; 30/30 paper-eligible derived labels; datasets=5; findings=0<br>300/300 HF-derived paper-eligible items; 0 still needed; 10/10 categories ready |
| diagnostic_pilot_labeling | active_restriction | Pilot and fixture results may be reported only as diagnostics, not as final benchmark rankings. | 2 diagnostic-only paper claims |
| license_sensitive_distribution | packaged_clearance_ready | Unknown-license evidence must remain pointer-only or be replaced before public redistribution. | 15 pointer-only items<br>18 pointer-only evidence units |
| citation_and_source_attribution | required | Every public artifact must preserve upstream dataset IDs, source-row pointers, and license notes. | hotpotqa/hotpot_qa:cc-by-sa-4.0<br>allenai/qasper:cc-by-4.0<br>danwakeem/wikitablequestions-wtq:cc-by-4.0<br>DongfuJiang/FeTaQA:mit<br>tdiggelm/climate_fever:unknown<br>Pavithree/eli5:unknown |
| no_high_stakes_decision_use | required | The benchmark is for research evaluation of grounded QA systems, not for making medical, legal, financial, climate-policy, or safety decisions. | dataset card intended-use boundary<br>claim ledger completion_claim_allowed=false |
| reviewer_quality_before_release | required | Returned labels must satisfy calibration, double-review, citation-support, adjudication, and agreement-reporting controls before release. | 5 annotation quality-control rules<br>allow_sentinel_rows_in_gold=false |
