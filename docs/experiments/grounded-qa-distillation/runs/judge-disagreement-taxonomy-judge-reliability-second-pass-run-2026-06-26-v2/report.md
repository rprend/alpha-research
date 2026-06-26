# Judge Disagreement Taxonomy

Generated: 2026-06-26T23:55:16.163Z

Status: `judge_disagreement_taxonomy_complete`

Source second-pass run: `judge-reliability-second-pass-run-2026-06-26-v2`

Compared cases: 42

Disagreements: 10 (23.8%)

## Taxonomy

| Category | Disagreements | Share | Manuscript treatment |
| --- | ---: | ---: | --- |
| abstention_boundary_reversal | 6 | 60.0% | Report as unstable abstention-boundary evidence; do not claim abstention calibration is solved. |
| partial_vs_supported_granularity | 2 | 20.0% | Report partial/support boundary as a granularity issue in model-judge labels. |
| unsupported_to_supported_reversal | 2 | 20.0% | Report as answer-support judge uncertainty; inspect examples before treating unsupported rates as human truth. |

## Constraints

- Call support/correctness metrics model-judged rather than human-validated.
- Report second-pass exact agreement and disagreement taxonomy near any judged-correctness table.
- Treat questionable abstentions as unstable boundary cases; do not use them as proof that abstention calibration is solved.
- For answer-support claims, highlight that most unsupported-answer and cross-policy cases are stable, but some first-pass unsupported/partial verdicts reverse to supported.
- Use Qwen 3B joint-action results to evaluate coverage/support jointly rather than relying on stronger abstention gates alone.

This taxonomy makes no OpenAI calls, launches no GPU jobs, and records no spend.
