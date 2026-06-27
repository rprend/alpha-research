# Qwen 3B Outcome Decision Policy

Generated: 2026-06-27T16:31:36.265Z

Status: `qwen3b_outcome_policy_preregistered`

Current integration status: `qwen3b_negative_ready_for_pareto_update`

## Decision Tree

| Integration Status | Classification | Paper Action | Next Engineering Action |
| --- | --- | --- | --- |
| waiting_for_qwen3b_predictions | not_yet_evidence | Do not discuss Qwen 3B quality. Keep all trained-student and amortized-success claims blocked. | Repair remote backend auth, run the bounded smoke, fetch predictions/result/report/smoke manifest, then run provenance and integrity gates. |
| waiting_for_qwen3b_paid_judge | prediction_only_not_quality_evidence | Report no support-preservation claim from predictions alone. Local overlap/citation syntax metrics are diagnostics only. | Run remote provenance, prediction integrity, dry judge, and then paid grounded-correctness judge if budget remains under $100. |
| qwen3b_negative_ready_for_pareto_update | negative_result | Report the trained Qwen smoke as a negative result. Do not claim support-preserving amortized distillation; update the Pareto table and analyze whether failure is support, coverage, citation, abstention, or JSON/format related. | Run failure-mode audit before any larger model or second GPU run. Do not escalate to a cutting-edge model unless the failure mode is capacity-bound rather than data/contract-bound. |
| qwen3b_minimum_positive_ready_for_pareto_update | minimum_positive | Claim only minimum support-preserving evidence: Qwen beats both the direct baseline and the deployable selector baseline at >=70% answer rate, but does not beat the 70% coverage-constrained frontier. Report this as partial amortization, not a dominant result. | Update Pareto, rerun loss accounting, rerun novelty/risk artifacts, and decide whether one bounded follow-up is justified by specific frontier gaps. |
| qwen3b_strong_positive_ready_for_pareto_update | strong_positive | Claim support-preserving amortized grounded QA only with model-judged caveats, provenance, actual cost, novelty refresh, and private-KB scope limitations. | Update Pareto, budget, amortization, loss accounting, manuscript, reviewer-risk audit, final claim matrix, and run final novelty refresh. |

## Hard Rejections

- Citation syntax or inline-citation rate alone cannot count as success.
- A result below 70% answer rate cannot count as support-preserving distillation, even if support rises.
- A result without paid grounded-correctness judgments cannot count as quality evidence.
- A result without remote provenance and actual cost cannot count as amortized deployment evidence.

## Model Escalation Policy

Default after negative Qwen 3B: `report_negative_before_escalating`

Allowed only if:

- Qwen failure-mode audit shows capacity-limited answer repair rather than citation syntax, data construction, or abstention-threshold failure.
- A new budget gate shows total OpenAI plus external compute spend remains below $100.
- The larger run has a bounded smoke plan with the same final-window, judge, provenance, and Pareto requirements.
- A decision-log entry records why Qwen 3B was inadequate and what the larger model tests that Qwen did not.

Prohibited:

- Do not rent a cutting-edge GPU only to improve headline metrics after a negative Qwen result.
- Do not treat a larger base model without trained adapter/provenance as a substitute for the planned Qwen smoke.
- Do not use tiny/local model outputs as ground-truth labels.

No OpenAI calls, GPU jobs, or new spend were made for this policy.
