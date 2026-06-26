# Retained Unsupported Error Analysis

Scope: retained unsupported risk-gate answers on extended_temporal_future_holdout examples 241-389

This analysis makes no LLM calls. It inspects the 26 unsupported answers retained by the balanced support-risk gate, using existing risk-gate predictions and existing `gpt-4o` judge notes.

## Primary Failure Modes

| Category | Rows |
| --- | ---: |
| numeric or comparison overclaim | 18 |
| scope or overgeneralization | 5 |
| citation contract gap | 2 |
| method result confusion | 1 |

## Any-Match Failure Signals

Rows can match more than one signal.

| Category | Rows |
| --- | ---: |
| scope or overgeneralization | 22 |
| numeric or comparison overclaim | 18 |
| method result confusion | 10 |
| citation contract gap | 7 |
| unsupported relation | 2 |

## Judge Verdicts And Confidence

| Verdict | Rows |
| --- | ---: |
| partial | 13 |
| unsupported | 12 |
| supported | 1 |

Support-risk scores among retained unsupported answers: min 0.678, median 0.787, max 0.873. 12 of 26 failures score at least 0.800, and 5 score at least 0.850.

## Example Notes

| Example | Primary category | Support score | Judge note |
| --- | --- | ---: | --- |
| `2004.01853:193ee49ae0f8827a6e67388a10da59e137e7769f` | numeric or comparison overclaim | 0.829 | The claim about MDG learning to recover a document with a masked span of tokens is supported by E1. However, the claim about randomly sampling the length and start position of the span is not directly supported by the evidence provided, ... |
| `2004.01980:41d3750ae666ea5a9cea498ddfb973a8366cccd6` | numeric or comparison overclaim | 0.786 | The claim about human raters evaluating attractiveness is not directly supported by the evidence, which mentions evaluation on multiple criteria including attractiveness, but not specifically that attraction score is evaluated by human r... |
| `2004.02105:e25b73f700e8c958b64951f14a71bc60d225125c` | numeric or comparison overclaim | 0.846 | The evidence supports that all selection methods performed better than random selection in terms of BLEU. However, it does not explicitly state that all selection methods outperformed using all available data or oracle-selected data, onl... |
| `2004.02143:014830892d93e3c01cb659ad31c90de4518d48f3` | numeric or comparison overclaim | 0.803 | The prediction does not specify how much the model outperformed, only that performance evaluations exist. The evidence does not provide specific performance metrics or comparisons to support the claim of outperformance. |
| `2004.02143:ae7c5cf9c2c121097eb00d389cfd7cc2a5a7d577` | citation contract gap | 0.862 | The evidence does not specify the language of the dataset, which is the focus of the question. The claims about the dataset's name and characteristics are supported, but they do not address the language aspect. |
| `2004.02192:b3de9357c569fb1454be8f2ac5fcecaea295b967` | numeric or comparison overclaim | 0.678 | The evidence does not mention the total number of tweets in the dataset, only the breakdown of offensive and clean tweets. |
| `2004.02334:1f2952cd1dc0c891232fa678b6c219f6b4d31958:counterfactual-insufficient` | numeric or comparison overclaim | 0.691 | The prediction claims that the better performer is the one with shorter sequences, but the evidence does not directly support this claim. E2 mentions that shorter sequences are desired, but does not specify which vocabulary size achieves... |
| `2004.02334:ec990c16896793a819766bc3168c02556ef69971` | numeric or comparison overclaim | 0.805 | The evidence supports that decreasing the vocabulary improves BLEU scores and that larger vocabularies like 32k and 64k are not the best choice. However, it does not specify which vocabulary size was the best performer, only that smaller... |

## Interpretation

The retained unsupported answers are mostly high-confidence overclaims, not low-score threshold misses. Numeric/comparative statements and scope generalizations are the dominant local signals, so the next verifier should explicitly test claim-level entailment over cited evidence instead of adding another scalar threshold to the current lexical gate.
