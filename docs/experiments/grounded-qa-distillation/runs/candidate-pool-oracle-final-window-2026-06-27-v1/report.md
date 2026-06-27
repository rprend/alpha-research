# Candidate Pool Oracle

Generated: 2026-06-27T01:21:50.578Z

Status: `current_candidate_pool_insufficient_for_support_preserving_coverage`

This is a no-spend oracle over already-judged final-window candidates. It asks whether selection among current direct/gate/guard outputs can satisfy the paper's support-preserving coverage target.

## Policy Metrics

| Policy | Answer rate | Answer support | Abstention support | Overall judged correct |
| --- | ---: | ---: | ---: | ---: |
| direct_mini_citation_repair | 76.8% | 64.2% | 100.0% | 72.5% |
| balanced_support_risk_gate | 63.8% | 70.5% | 96.0% | 79.7% |
| claim_entailment_guard | 60.9% | 73.8% | 96.3% | 82.6% |

## Oracle

| Examples | Answered | Answer rate | Answer support | Overall judged correct | Supported-answer candidates |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 69 | 46 | 66.7% | 76.1% | 84.1% | 35 |

Conclusion: Selection-only candidate pool cannot meet the 70% answer-rate target while choosing only supported answer candidates.

## Training Implication

The candidate pool mostly contains the direct answer and abstention variants of that answer. Selection can suppress unsupported answers, but it cannot create supported answers for examples where no supported answer candidate exists.

Next data change: Keep Qwen 3B joint-action training focused on repair/regeneration versus abstention, not only policy selection among existing direct/gate outputs.

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
