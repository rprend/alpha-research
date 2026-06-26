# Hard Grounded Research Baseline Uncertainty

This generated report adds descriptive uncertainty estimates to the current pilot baseline results. It is not a final power analysis; the release gate still requires double-reviewed gold data and real model baselines before submission claims.

## Summary

- Systems: 3
- Metrics: answer_correct, evidence_recall, citation_precision, citation_faithfulness, conclusion_support, abstention_quality
- Method: Normal-approximation 95% confidence intervals over task-level metric values. Paired deltas use matched task ids. Intervals are descriptive for the 30-item pilot and are not final paper power estimates.
- Uncertainty ready: true

## System Intervals

| System | Metric | n | Mean | 95% CI | SE |
| --- | --- | --- | --- | --- | --- |
| local-rule-agent-v1 | answer_correct | 30 | 1.0000 | [1.0000, 1.0000] | 0.0000 |
| local-rule-agent-v1 | citation_faithfulness | 30 | 1.0000 | [1.0000, 1.0000] | 0.0000 |
| local-rule-agent-v1 | conclusion_support | 30 | 0.9000 | [0.7908, 1.0000] | 0.0557 |
| local-rule-agent-v1 | abstention_quality | 30 | 1.0000 | [1.0000, 1.0000] | 0.0000 |
| lexical-evidence-baseline-v1 | answer_correct | 30 | 0.2000 | [0.0544, 0.3456] | 0.0743 |
| lexical-evidence-baseline-v1 | citation_faithfulness | 30 | 0.6000 | [0.5272, 0.6728] | 0.0371 |
| lexical-evidence-baseline-v1 | conclusion_support | 30 | 0.5333 | [0.4401, 0.6265] | 0.0475 |
| lexical-evidence-baseline-v1 | abstention_quality | 30 | 0.7000 | [0.5332, 0.8668] | 0.0851 |
| citation-aware-verifier-v1 | answer_correct | 30 | 0.1667 | [0.0310, 0.3023] | 0.0692 |
| citation-aware-verifier-v1 | citation_faithfulness | 30 | 0.5833 | [0.5155, 0.6512] | 0.0346 |
| citation-aware-verifier-v1 | conclusion_support | 30 | 0.6333 | [0.5529, 0.7138] | 0.0411 |
| citation-aware-verifier-v1 | abstention_quality | 30 | 0.6000 | [0.4217, 0.7783] | 0.0910 |

## Paired Deltas

| Comparison | Metric | n | Mean delta | 95% CI | SE |
| --- | --- | --- | --- | --- | --- |
| citation-aware-verifier-v1 - lexical-evidence-baseline-v1 | answer_correct | 30 | -0.0333 | [-0.0987, 0.0320] | 0.0333 |
| citation-aware-verifier-v1 - lexical-evidence-baseline-v1 | citation_faithfulness | 30 | -0.0167 | [-0.0493, 0.0160] | 0.0167 |
| citation-aware-verifier-v1 - lexical-evidence-baseline-v1 | conclusion_support | 30 | 0.1000 | [-0.0092, 0.2092] | 0.0557 |
| citation-aware-verifier-v1 - lexical-evidence-baseline-v1 | abstention_quality | 30 | -0.1000 | [-0.2092, 0.0092] | 0.0557 |
| local-rule-agent-v1 - lexical-evidence-baseline-v1 | answer_correct | 30 | 0.8000 | [0.6544, 0.9456] | 0.0743 |
| local-rule-agent-v1 - lexical-evidence-baseline-v1 | citation_faithfulness | 30 | 0.4000 | [0.3272, 0.4728] | 0.0371 |
| local-rule-agent-v1 - lexical-evidence-baseline-v1 | conclusion_support | 30 | 0.3667 | [0.2862, 0.4471] | 0.0411 |
| local-rule-agent-v1 - lexical-evidence-baseline-v1 | abstention_quality | 30 | 0.3000 | [0.1332, 0.4668] | 0.0851 |
