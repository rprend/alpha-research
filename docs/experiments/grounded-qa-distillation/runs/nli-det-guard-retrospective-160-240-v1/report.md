# NLI And Deterministic Guard Retrospective

Scope: retrospective fixed-threshold zero-LLM verifier check on extended_temporal_future_holdout examples 161-240

This run makes no OpenAI calls. It retrospectively applies a fixed NLI threshold from the later transfer experiment plus a recomputed deterministic claim-entailment guard to the earlier judged balanced-gate window.

## Policy Comparison

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Delta rows vs balanced | Delta rate vs balanced |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 66 / 80 (82.5%) | 48 | 72.9% | 0 | 0 | 0 | 0 | 0.0pp |
| Deterministic claim-entailment guard | 65 / 80 (81.3%) | 43 | 74.4% | 5 | 2 | 3 | -1 | -1.2pp |
| Pretrained NLI fixed threshold | 66 / 80 (82.5%) | 46 | 73.9% | 2 | 1 | 1 | 0 | 0.0pp |
| NLI OR deterministic guard | 65 / 80 (81.3%) | 41 | 75.6% | 7 | 3 | 4 | -1 | -1.2pp |
| NLI AND deterministic guard | 66 / 80 (82.5%) | 48 | 72.9% | 0 | 0 | 0 | 0 | 0.0pp |

## Signals

- NLI fires: 2
- Deterministic guard fires: 5
- Either fires: 7
- Both fire: 0

## Fired Examples

| Example | Strong label | NLI | Deterministic | NLI score | Deterministic reasons | Answer preview |
| --- | --- | --- | --- | ---: | --- | --- |
| `2003.11562:fc4ae12576ea3a85ea6d150b46938890d63a7d18` | unsupported | yes | no | 0.005 |  | The LSTM baseline is not a sub-word model; it uses morfessor for subword tokenization, which is a method applied in conjunction with LSTM models for Finnish language processing [E2]. |
| `2003.12139:471683ba6251b631f38a24d42b6dba6f52dee429` | supported | no | yes | 0.010 | unsupported_number, unsupported_quantifier | The dataset consists of 2,803,164 tweets collected using the Twitter search API, and after filtering, 1,952,079 tweets were left. Additionally, 1,733,905 relevant tweets were identified from a historical database of p... |
| `2003.12450:d14118b18ee94dafe170439291e20cb19ab7a43c:counterfactual-insufficient` | unsupported | no | yes | 0.020 | unsupported_comparative_or_superlative | The full English language based sentiment analysis model that was tried is the VADER English lexicon, which was translated into Nigerian Pidgin for sentiment classification [E1]. The updated VADER lexicon showed impro... |
| `2003.12660:80bb07e553449bde9ac0ff35fcc718d7c161f2d4` | supported | yes | no | 0.004 |  | The dataset used for the supervised model contained 20,214 sentence pairs for training, 1,000 sentence pairs for validation, and a test set of 2,101 sentences [E1]. |
| `2003.13032:f2e8497aa16327aa297a7f9f7d156e485fe33945` | unsupported | no | yes | 0.020 | unsupported_number | { "answer_type": "grounded_answer", "answer": "Annotation was performed using WebAnno, a web-based tool for linguistic annotation. Annotators could choose between a pre-annotated version or a blank version of each tex... |
| `2004.00139:4d30c2223939b31216f2e90ef33fe0db97e962ac` | supported | no | yes | 0.219 | unsupported_number | The dictionary contains 11,248 standard German written words paired with their phonetic representations in six different Swiss dialects [E2]. |
| `2004.01694:bc473c5bd0e1a8be9b2037aa7006fd68217c3f47` | supported | no | yes | 0.073 | unsupported_comparative_or_superlative | The recommendations offered include: (R1) Choose professional translators as raters, as non-experts may overlook subtle differences in translation quality; and (R2) Evaluate documents, not sentences, to improve assess... |

## Interpretation

This is not a fresh later holdout; it is a retrospective robustness check on the threshold-selection window. It tests whether the verifier combination behaves sensibly outside the 241-389 transfer synthesis without spending more OpenAI budget.
