# Expanded Candidate Pool Audit

Generated: 2026-06-28T04:06:37.295Z

Status: `candidate_pool_improves_but_below_target`

This is a zero-call audit over already-paid prediction and judge artifacts. It is not a deployable final selector because the expanded oracle uses inherited judge labels.

## Candidate Metrics

| Candidate | Answered | Answer rate | Answer support | Abstention support | Judged correct |
| --- | ---: | ---: | ---: | ---: | ---: |
| balanced_risk_gate | 44 | 63.8% | 70.5% | 96.0% | 79.7% |
| claim_entailment_guard | 42 | 60.9% | 73.8% | 96.3% | 82.6% |
| direct_mini_repair | 53 | 76.8% | 64.2% | 100.0% | 72.5% |
| qwen3b_v1 | 54 | 78.3% | 13.0% | 100.0% | 31.9% |
| qwen3b_v3 | 46 | 66.7% | 32.6% | 100.0% | 55.1% |
| qwen3b_v4 | 45 | 65.2% | 33.3% | 100.0% | 56.5% |
| qwen7b_v10 | 22 | 31.9% | 31.8% | 97.9% | 76.8% |
| qwen7b_v11 | 44 | 63.8% | 43.2% | 100.0% | 63.8% |
| qwen7b_v12 | 41 | 59.4% | 26.8% | 100.0% | 56.5% |
| qwen7b_v4 | 35 | 50.7% | 65.7% | 100.0% | 82.6% |
| qwen7b_v5 | 44 | 63.8% | 50.0% | 100.0% | 68.1% |
| qwen7b_v6 | 34 | 49.3% | 61.8% | 100.0% | 81.2% |
| qwen7b_v7 | 63 | 91.3% | 41.3% | 100.0% | 46.4% |
| qwen7b_v8 | 0 | 0.0% | 0.0% | 95.7% | 95.7% |
| qwen7b_v9 | 28 | 40.6% | 50.0% | 97.6% | 78.3% |

## Selection Metrics

| Selector | Answered | Answer rate | Answer support | Abstention support | Overall judged correct |
| --- | ---: | ---: | ---: | ---: | ---: |
| expanded_judged_oracle | 45 | 65.2% | 100.0% | 100.0% | 100.0% |
| expanded_heuristic_selector | 69 | 100.0% | 52.2% | 0.0% | 52.2% |
| qwen_only_judged_oracle | 42 | 60.9% | 100.0% | 100.0% | 100.0% |
| scaffold_priority_selector | 42 | 60.9% | 73.8% | 96.3% | 82.6% |

## Oracle Gap

- Expanded oracle minus scaffold answer rate: 4.3%
- Expanded oracle minus scaffold answer support: 26.2%
- Expanded oracle minus scaffold overall correct: 17.4%
- Qwen-unique supported answer examples: 10

## Decision

The expanded judged oracle has 65.2% answer rate and 100.0% answer support, while the scaffold priority selector has 60.9% answer rate and 73.8% answer support with 11 unsupported answers.

Next action: Do not launch another blind adapter run; improve candidate generation because even the judged candidate pool is below a strong support-preserving target.

No OpenAI calls or GPU jobs were made by this audit.
