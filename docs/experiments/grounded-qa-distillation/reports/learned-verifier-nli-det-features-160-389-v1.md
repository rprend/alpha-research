# Learned NLI And Deterministic Verifier

Scope: leave-window-out local verifier over already judged balanced-gate outputs on extended_temporal_future_holdout examples 161-389

This run makes no OpenAI calls and no new model calls. It consumes cached NLI scores from prior verifier runs and recomputes deterministic citation-support features locally.

## Policy Comparison

| Policy | Correct / examples | Answered | Answer support | Citation recall | Answer F1 | Gate fired | Suppressed unsupported | Harmful suppressions | Delta rows vs balanced | Delta rate vs balanced |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 185 / 229 (80.8%) | 138 | 71.0% | 41.4% | 18.1% | 0 | 0 | 0 | 0 | 0.0pp |
| Deterministic claim-entailment guard | 187 / 229 (81.7%) | 128 | 73.4% | 39.0% | 17.2% | 10 | 6 | 4 | +2 | +0.9pp |
| Pretrained NLI fixed threshold | 185 / 229 (80.8%) | 134 | 71.6% | 39.4% | 18.0% | 4 | 2 | 2 | 0 | 0.0pp |
| NLI OR deterministic guard | 187 / 229 (81.7%) | 124 | 74.2% | 37.0% | 17.1% | 14 | 8 | 6 | +2 | +0.9pp |
| Leave-window-out learned NLI+det verifier | 179 / 229 (78.2%) | 122 | 71.3% | 36.1% | 16.4% | 16 | 5 | 11 | -6 | -2.6pp |

## Leave-Window-Out Folds

| Eval window | Train windows | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 161-240 | 241-320, 321-389 | 0.458 | 64 / 80 (80.0%) | 44 | 72.7% | 4 | 1 | 3 |
| 241-320 | 161-240, 321-389 | 0.525 | 61 / 80 (76.3%) | 37 | 70.3% | 9 | 3 | 6 |
| 321-389 | 161-240, 241-320 | 0.400 | 54 / 69 (78.3%) | 41 | 70.7% | 3 | 1 | 2 |

## Learned Suppressions

| Example | Window | Source label | Interpretation | Keep score | NLI min | Deterministic | Reasons | Answer preview |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| `2003.12139:471683ba6251b631f38a24d42b6dba6f52dee429` | 161-240 | supported | harmful_suppression_supported_answer | 0.080 | 0.010 | yes | unsupported_number, unsupported_quantifier | The dataset consists of 2,803,164 tweets collected using the Twitter search API, and after filtering, 1,952,079 tweets were left. Additionally, 1,733,905 relevant tweets were id... |
| `2003.13032:f2e8497aa16327aa297a7f9f7d156e485fe33945` | 161-240 | unsupported | suppressed_unsupported_answer | 0.002 | 0.020 | yes | unsupported_number | { "answer_type": "grounded_answer", "answer": "Annotation was performed using WebAnno, a web-based tool for linguistic annotation. Annotators could choose between a pre-annotate... |
| `2004.00139:4d30c2223939b31216f2e90ef33fe0db97e962ac` | 161-240 | supported | harmful_suppression_supported_answer | 0.060 | 0.219 | yes | unsupported_number | The dictionary contains 11,248 standard German written words paired with their phonetic representations in six different Swiss dialects [E2]. |
| `2004.01694:bc473c5bd0e1a8be9b2037aa7006fd68217c3f47` | 161-240 | supported | harmful_suppression_supported_answer | 0.259 | 0.073 | yes | unsupported_comparative_or_superlative | The recommendations offered include: (R1) Choose professional translators as raters, as non-experts may overlook subtle differences in translation quality; and (R2) Evaluate doc... |
| `2004.02083:25b24ab1248f14a621686a57555189acc1afd49c` | 241-320 | supported | harmful_suppression_supported_answer | 0.443 | 0.468 | no |  | The baseline system used for lemmatization is a character level encoder-decoder model implemented in DyNet, which follows a sequence-to-sequence approach [E2]. |
| `2004.02083:9e1bf306658ef2972159643fdaf149c569db524b` | 241-320 | supported | harmful_suppression_supported_answer | 0.523 | 0.773 | no |  | Chatino belongs to the Otomanguean language family, specifically forming the Zapotecan branch along with the Zapotec language group [E1]. |
| `2004.02105:908ba58d26d15c14600623498d4e86c9b73b14b2` | 241-320 | supported | harmful_suppression_supported_answer | 0.399 | 0.763 | no |  | The established approach used for comparison in domain data selection is the well-established cross-entropy difference method, which is compared against the proposed methods tha... |
| `2004.02105:e25b73f700e8c958b64951f14a71bc60d225125c` | 241-320 | unsupported | suppressed_unsupported_answer | 0.345 | 0.204 | yes | unsupported_comparative_or_superlative | The results indicate that all selection methods performed better in terms of BLEU than random selection, and they also outperformed using all available data or oracle-selected d... |
| `2004.02143:af948ea91136c700957b438d927f58d9b051c97c` | 241-320 | supported | harmful_suppression_supported_answer | 0.402 | 0.028 | no |  | The HotPotQA dataset consists of over 113,000 Wikipedia-based question-answer pairs, with each question requiring multi-step reasoning across multiple supporting documents to in... |
| `2004.02334:1f2952cd1dc0c891232fa678b6c219f6b4d31958:counterfactual-insufficient` | 241-320 | unsupported | suppressed_unsupported_answer | 0.336 | 0.079 | yes | unsupported_comparative_or_superlative | The better performer in terms of vocabulary size is the one that results in shorter sequences, as shorter sequences are desired for the autoregressor setting. [E2] [E3] |
| `2004.02334:23fe8431058f2a7b7588745766fc715f271aad07` | 241-320 | supported | harmful_suppression_supported_answer | 0.483 | 0.108 | no |  | The languages explored are German (De) and English (En) using the Europarl v9 parallel data set. [E3] |
| `2004.02334:9aa751aebf6a449d95fb04ceec71688f2ed2cea2:counterfactual-insufficient` | 241-320 | unsupported | suppressed_unsupported_answer | 0.308 | 0.040 | no |  | The analysis included a fixed BPE vocabulary size of 16k on the target language [E2]. |
| `2004.02363:37ac705166fa87dc74fe86575bf04bea56cc4930` | 241-320 | supported | harmful_suppression_supported_answer | 0.343 | 0.396 | no |  | The evaluation metrics used in the study are Mean Absolute Error (MAE) between the predicted and ground-truth agreed prices, and Accuracy±k, which measures the percentage of cas... |
| `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26:counterfactual-insufficient` | 321-389 | unsupported | suppressed_unsupported_answer | 0.121 | 0.312 | yes | unsupported_comparative_or_superlative | The results of the BERT model with larger context representations significantly outperform the baseline models, particularly for claims with context lengths of 3 and 4, achievin... |
| `2004.04060:2fec84a62b4028bbe6500754d9c058eefbc24d9a` | 321-389 | supported | harmful_suppression_supported_answer | 0.342 | 0.201 | yes | unsupported_comparative_or_superlative | The performance of large state-of-the-art models on the CoNLL-03 and OntoNotes 5 datasets shows that neural models with language models achieved state-of-the-art results. Specif... |
| `2004.04498:2749fb1725a2c4bdba5848e2fc424a43e7c4be51` | 321-389 | supported | harmful_suppression_supported_answer | 0.399 | 0.844 | no |  | The set of trusted, gender-balanced examples is selected by creating a handcrafted dataset that includes 194 professions, resulting in 388 sentences. This dataset is derived fro... |

## Interpretation

The learned verifier is a candidate only if it improves aggregate support-oracle correctness over the balanced gate and does not rely on one fragile window. Fixed NLI and deterministic-guard baselines are included to separate genuine learned transfer from a simple threshold rule.
