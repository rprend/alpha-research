# NLI And Deterministic Guard Synthesis

Scope: zero-call synthesis of pretrained NLI verifier and deterministic claim-entailment guard on balanced-gate transfer examples 241-389

This synthesis makes no LLM calls and no new model calls. It combines existing predictions from `pretrained-nli-verifier-combined-labels-240-389-v1`, `claim-entailment-guard-balanced-risk-gate-240-389-v1`, and `mini-verifier-gate-balanced-risk-gate-240-389-v1`.

## Policy Comparison

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Delta rows vs balanced | Delta rate vs balanced |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 119 / 149 (79.9%) | 90 | 70.0% | 0 | 0 | 0 | 0 | 0.0pp |
| Deterministic claim-entailment guard | 122 / 149 (81.9%) | 85 | 72.9% | 5 | 4 | 1 | +3 | +2.0pp |
| Pretrained NLI verifier | 120 / 149 (80.5%) | 87 | 71.3% | 3 | 2 | 1 | +1 | +0.7pp |
| NLI OR deterministic guard | 123 / 149 (82.6%) | 82 | 74.4% | 8 | 6 | 2 | +4 | +2.7pp |
| NLI AND deterministic guard | 119 / 149 (79.9%) | 90 | 70.0% | 0 | 0 | 0 | 0 | 0.0pp |
| Mini-negative OR deterministic teacher | 125 / 149 (83.9%) | 82 | 75.6% | 8 | 7 | 1 | +6 | +4.0pp |

## Signal Overlap

| Pair | Left fires | Right fires | Both fire | Either fires | Either useful | Either harmful |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| nli vs det guard | 3 | 5 | 0 | 8 | 6 | 2 |
| nli vs combined teacher | 3 | 8 | 1 | 10 | 8 | 2 |
| det guard vs combined teacher | 5 | 8 | 5 | 8 | 7 | 1 |

## Fired Examples

| Example | Strong label | NLI | Deterministic | Mini | Combined teacher | NLI score | Answer preview |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| `2004.02105:e25b73f700e8c958b64951f14a71bc60d225125c` | unsupported | no | yes | no | yes | 0.204 | The results indicate that all selection methods performed better in terms of BLEU than random selection, and they also outperformed using all available data or oracle-selected data when averaged across all domains, su... |
| `2004.02192:b3de9357c569fb1454be8f2ac5fcecaea295b967` | unsupported | no | yes | no | yes | 0.072 | The dataset contains a total of 10,000 tweets, which includes 1,915 offensive tweets and 8,085 clean tweets [E3]. |
| `2004.02334:1f2952cd1dc0c891232fa678b6c219f6b4d31958:counterfactual-insufficient` | unsupported | no | yes | yes | yes | 0.079 | The better performer in terms of vocabulary size is the one that results in shorter sequences, as shorter sequences are desired for the autoregressor setting. [E2] [E3] |
| `2004.02363:37ac705166fa87dc74fe86575bf04bea56cc4930:counterfactual-insufficient` | unsupported | no | no | yes | yes | 0.026 | The evaluation metrics used in the study are not explicitly detailed in the provided evidence, but the authors mention comparing their model empirically with a number of baseline methods to answer their research quest... |
| `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26:counterfactual-insufficient` | unsupported | no | yes | no | yes | 0.312 | The results of the BERT model with larger context representations significantly outperform the baseline models, particularly for claims with context lengths of 3 and 4, achieving better F1 scores than the BERT model w... |
| `2004.04060:2fec84a62b4028bbe6500754d9c058eefbc24d9a` | supported | no | yes | no | yes | 0.201 | The performance of large state-of-the-art models on the CoNLL-03 and OntoNotes 5 datasets shows that neural models with language models achieved state-of-the-art results. Specifically, the F1 score for CoNLL-03 improv... |
| `2004.04435:d353a6bbdc66be9298494d0c853e0d8d752dec4b` | unsupported | yes | no | no | no | 0.003 | The correctness of automatic derivation is proved through empirical comparisons and the implementation of reverse mode differentiation, which computes the derivative of a function's output with respect to every interm... |
| `2004.04478:7dca806426058d59f4a9a4873e9219d65aea0987` | unsupported | no | no | yes | yes | 0.023 | The 20 domains available for selection as source domains are: Amazon Instant Video, Automotive, Baby, Beauty, Books, Clothing Accessories, Electronics, Health, Home, Kitchen, Movies TV, Music, Office Products, Patio, ... |
| `2004.04721:0737954caf66f2b4c898b356d2a3c43748b9706b` | unsupported | yes | no | yes | yes | 0.008 | They do not recommend translating the premise and hypothesis together, as translating them independently is likely to reduce lexical overlap between them, which can affect model performance negatively [E2]. |
| `2004.04721:b3307d5b68c57a074c483636affee41054be06d1` | supported | yes | no | no | no | 0.005 | Examples of artifacts in cross-lingual transfer learning include datasets like XNLI for natural language inference (NLI), PAWS-X for adversarial paraphrase identification, and XQuAD and MLQA for question answering (QA... |

## Interpretation

The union policy tests whether pretrained NLI and deterministic claim checks catch complementary retained errors. The intersection policy tests whether agreement improves precision enough to matter.
