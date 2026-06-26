# Coverage-Constrained Support Frontier

Generated: 2026-06-26T20:20:21.987Z

Status: `historical_judgment_replay_not_final_qwen3b_result`

For each threshold, kept source predictions inherit direct-judge labels. Newly forced abstentions inherit the already-paid gate-judge labels. Thresholds are bounded by the source gate threshold, so every forced abstention is covered by an existing gate judgment.

## Threshold Replay

| Threshold | Answer rate | Answer support | Abstention support | Overall judged correct | Answered | Unsupported answers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.00 | 79.0% | 65.2% | 100.0% | 72.5% | 181 | 63 |
| 0.20 | 79.0% | 65.2% | 100.0% | 72.5% | 181 | 63 |
| 0.25 | 79.0% | 65.2% | 100.0% | 72.5% | 181 | 63 |
| 0.30 | 78.6% | 65.6% | 100.0% | 72.9% | 180 | 62 |
| 0.35 | 78.6% | 65.6% | 100.0% | 72.9% | 180 | 62 |
| 0.40 | 78.2% | 65.9% | 100.0% | 73.4% | 179 | 61 |
| 0.45 | 76.9% | 67.0% | 100.0% | 74.7% | 176 | 58 |
| 0.50 | 74.7% | 67.3% | 100.0% | 75.5% | 171 | 56 |
| 0.55 | 72.1% | 68.5% | 100.0% | 77.3% | 165 | 52 |
| 0.60 | 67.7% | 69.7% | 95.9% | 78.2% | 155 | 47 |
| 0.65 | 60.3% | 73.2% | 95.6% | 82.1% | 138 | 37 |

## Coverage-Constrained Operating Points

| Min answer rate | Selected threshold | Answer rate | Answer support | Overall judged correct |
| ---: | ---: | ---: | ---: | ---: |
| 75.0% | 0.45 | 76.9% | 67.0% | 74.7% |
| 70.0% | 0.55 | 72.1% | 68.5% | 77.3% |
| 65.0% | 0.60 | 67.7% | 69.7% | 78.2% |
| 60.0% | 0.65 | 60.3% | 73.2% | 82.1% |
| 57.5% | 0.65 | 60.3% | 73.2% | 82.1% |

## Qwen3B Acceptance Target

Beat the direct baseline on answer support and overall judged correctness while keeping answer rate above 70%; if that is not possible, report the exact coverage/support frontier instead of claiming support-preserving distillation.

## Conclusions

- The answer-rate constraint is binding: higher support comes from suppressing direct answers.
- A 70% answer-rate operating point is the minimum useful target for a trained student because it preserves most direct-student coverage while still testing support gains.
- The current hard gate at threshold 0.65 is a support-first scaffold, not a satisfactory final model behavior target by itself.
- The Qwen3B joint-action student should be judged against both the direct baseline and the 70% coverage-constrained frontier.

## Budget

No OpenAI calls, no GPU jobs, and no new spend. Actual total spend remains $5.8931.
