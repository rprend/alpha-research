# Hard Grounded Research Baseline Uncertainty

This generated report adds descriptive uncertainty estimates to the current pilot baseline results. It is not a final power analysis; the release gate still requires double-reviewed gold data and real model baselines before submission claims.

## Summary

- Systems: 5
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
| anthropic-grounded-baseline-v1 | answer_correct | 30 | 0.3667 | [0.1913, 0.5421] | 0.0895 |
| anthropic-grounded-baseline-v1 | citation_faithfulness | 30 | 0.4000 | [0.2280, 0.5720] | 0.0878 |
| anthropic-grounded-baseline-v1 | conclusion_support | 30 | 0.3000 | [0.1400, 0.4600] | 0.0816 |
| anthropic-grounded-baseline-v1 | abstention_quality | 30 | 0.4333 | [0.2530, 0.6137] | 0.0920 |
| openai-grounded-baseline-v1 | answer_correct | 30 | 0.4000 | [0.2217, 0.5783] | 0.0910 |
| openai-grounded-baseline-v1 | citation_faithfulness | 30 | 0.7000 | [0.6108, 0.7892] | 0.0455 |
| openai-grounded-baseline-v1 | conclusion_support | 30 | 0.6000 | [0.4908, 0.7092] | 0.0557 |
| openai-grounded-baseline-v1 | abstention_quality | 30 | 0.6000 | [0.4217, 0.7783] | 0.0910 |

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
| anthropic-grounded-baseline-v1 - lexical-evidence-baseline-v1 | answer_correct | 30 | 0.1667 | [-0.0452, 0.3785] | 0.1081 |
| anthropic-grounded-baseline-v1 - lexical-evidence-baseline-v1 | citation_faithfulness | 30 | -0.2000 | [-0.3795, -0.0205] | 0.0916 |
| anthropic-grounded-baseline-v1 - lexical-evidence-baseline-v1 | conclusion_support | 30 | -0.2333 | [-0.4010, -0.0657] | 0.0855 |
| anthropic-grounded-baseline-v1 - lexical-evidence-baseline-v1 | abstention_quality | 30 | -0.2667 | [-0.4276, -0.1057] | 0.0821 |
| openai-grounded-baseline-v1 - lexical-evidence-baseline-v1 | answer_correct | 30 | 0.2000 | [-0.0184, 0.4184] | 0.1114 |
| openai-grounded-baseline-v1 - lexical-evidence-baseline-v1 | citation_faithfulness | 30 | 0.1000 | [-0.0092, 0.2092] | 0.0557 |
| openai-grounded-baseline-v1 - lexical-evidence-baseline-v1 | conclusion_support | 30 | 0.0667 | [-0.0356, 0.1689] | 0.0522 |
| openai-grounded-baseline-v1 - lexical-evidence-baseline-v1 | abstention_quality | 30 | -0.1000 | [-0.2720, 0.0720] | 0.0878 |
