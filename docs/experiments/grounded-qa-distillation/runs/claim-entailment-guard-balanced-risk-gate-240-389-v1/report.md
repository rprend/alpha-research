# Claim-Entailment Guard After Balanced Risk Gate

Scope: balanced support-risk gate outputs on extended_temporal_future_holdout examples 241-389

This run makes no LLM calls. It applies deterministic cited-evidence checks after the balanced support-risk gate and evaluates with local task metrics plus inherited support-oracle accounting from existing `gpt-4o` judgments.

## Guard Effect

| Examples | Answered before | Answered after | Guard fired | Suppressed unsupported | Harmful suppressed supported |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 149 | 90 | 85 | 5 | 4 | 1 |

## Inherited Support-Oracle Accounting

| Policy | Correct / examples | Correct rate | Answer support after guard |
| --- | ---: | ---: | ---: |
| Balanced risk gate | 119 / 149 | 79.9% | n/a |
| Risk gate + claim-entailment guard | 122 / 149 | 81.9% | 72.9% |

Delta: +3 rows, +2.0pp.

## Local Task Metrics

| Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 85 | 70.5% | 67.0% | 55.1% | 24.1% | 100.0% |

## Guard Reasons

| Reason | Rows |
| --- | ---: |
| unsupported comparative or superlative | 4 |
| unsupported number | 1 |
| unsupported quantifier | 1 |

## Fired Examples

| Example | Interpretation | Reasons | Upstream support score | Gate verdict | Answer preview |
| --- | --- | --- | ---: | --- | --- |
| `2004.02105:e25b73f700e8c958b64951f14a71bc60d225125c` | suppressed unsupported answer | unsupported comparative or superlative | 84.6% | unsupported | The results indicate that all selection methods performed better in terms of BLEU than random selection, and they also outperformed using all available data or oracle-selected data when averaged across all domains, su... |
| `2004.02192:b3de9357c569fb1454be8f2ac5fcecaea295b967` | suppressed unsupported answer | unsupported number, unsupported quantifier | 67.8% | unsupported | The dataset contains a total of 10,000 tweets, which includes 1,915 offensive tweets and 8,085 clean tweets [E3]. |
| `2004.02334:1f2952cd1dc0c891232fa678b6c219f6b4d31958:counterfactual-insufficient` | suppressed unsupported answer | unsupported comparative or superlative | 69.1% | unsupported | The better performer in terms of vocabulary size is the one that results in shorter sequences, as shorter sequences are desired for the autoregressor setting. [E2] [E3] |
| `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26:counterfactual-insufficient` | suppressed unsupported answer | unsupported comparative or superlative | 73.2% | partial | The results of the BERT model with larger context representations significantly outperform the baseline models, particularly for claims with context lengths of 3 and 4, achieving better F1 scores than the BERT model w... |
| `2004.04060:2fec84a62b4028bbe6500754d9c058eefbc24d9a` | harmful suppression supported answer | unsupported comparative or superlative | 85.7% | supported | The performance of large state-of-the-art models on the CoNLL-03 and OntoNotes 5 datasets shows that neural models with language models achieved state-of-the-art results. Specifically, the F1 score for CoNLL-03 improv... |

## Interpretation

The guard is a high-safety diagnostic, not a final policy. It targets the dominant retained-error class from D64 and improves inherited support-oracle correctness only when it suppresses unsupported answers faster than supported ones. A fresh judge pass would be required before treating the new abstentions as independently verified.
