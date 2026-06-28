# Answer Span Construction Gap

Generated: 2026-06-28T00:30:03.420Z

Status: `mixed_evidence_selection_and_answer_span_failures`

## Setup

| Item | Value |
| --- | --- |
| Prediction run | `trained-evidence-selector-constructor-final-window-2026-06-27-v1` |
| Judge run | `openai-judge-gpt4o-trained-evidence-selector-constructor-final-window-2026-06-27-v1` |
| Split | `extended_temporal_future_holdout` |
| OpenAI calls | 0 |
| External compute | $0.00 |

## Summary

| Answered | Judge supported | Unsupported | Support rate | Selected ref citation but unsupported | Non-ref citation unsupported | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 43 | 4 | 39 | 9.3% | 18 | 21 | 0 |

| Oracle recoverability | Rows |
| --- | ---: |
| Selected evidence span F1 >= 0.35 | 10 |
| Gold evidence span F1 >= 0.35 | 26 |
| Gold evidence span F1 >= 0.60 | 12 |

## Buckets

| Bucket | Count |
| --- | ---: |
| `selected_evidence_span_not_recoverable` | 29 |
| `selected_non_gold_evidence` | 21 |
| `question_mismatch` | 20 |
| `selected_gold_evidence_but_wrong_answer` | 18 |
| `gold_evidence_has_partial_extractable_answer` | 14 |
| `gold_evidence_needs_abstractive_or_structured_answer` | 13 |
| `missing_direct_evidence` | 13 |
| `gold_evidence_has_high_extractable_answer` | 12 |
| `selected_evidence_has_recoverable_span` | 10 |
| `table_or_metric_span_issue` | 8 |
| `judge_supported` | 4 |
| `too_short_answer` | 2 |

## Examples

- `2004.03034:6cdd61ebf84aa742155f4554456cc3233b6ae2bf` (selected_non_gold_evidence, selected_evidence_span_not_recoverable, gold_evidence_has_high_extractable_answer, question_mismatch): pred=Except the thesis, every claim in the argument tree either opposes or supports its parent claim. [E4]; ref=SVM with RBF kernel [E3]
- `2004.03034:8e8097cada29d89ca07166641c725e0f8fed6676` (selected_gold_evidence_but_wrong_answer, selected_evidence_has_recoverable_span, gold_evidence_has_high_extractable_answer): pred=An interesting observation is that, in this dataset, the same claim can have different impact labels depending on the context in which it is presented. [E1]; ref=While evaluating the impact of a claim, users have access to the full argument context and therefore, they can assess how impactful a claim is in the given context of an argument. [E1]
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e` (selected_gold_evidence_but_wrong_answer, selected_evidence_has_recoverable_span, gold_evidence_has_high_extractable_answer, question_mismatch): pred=An interesting observation is that, in this dataset, the same claim can have different impact labels depending on the context in which it is presented. [E4]; ref=5 possible impact labels for a particular claim: no impact, low impact, medium impact, high impact and very high impact [E4]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (selected_gold_evidence_but_wrong_answer, selected_evidence_span_not_recoverable, gold_evidence_needs_abstractive_or_structured_answer, question_mismatch): pred=We evaluated the zero-shot performance of these models on the test splits of these datasets, with perplexities shown in tab:datasetcomparison. [E4]; ref=two models (GPT2 and DialoGPT) on two datasets (DailyDialog and CALLHOME) [E3] [E4]
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec` (selected_non_gold_evidence, selected_evidence_span_not_recoverable, gold_evidence_needs_abstractive_or_structured_answer, question_mismatch): pred=We avoid modeling salutations and sign-offs (which tend to be formulaic, speaker-independent, and specific to the radio station) by restricting the target turns to those with at least three prior turns and two following turns of conversation, resulting in a...; ref=No. [E4]
- `2004.03090:7625068cc22a095109580b83eff48616387167c2` (selected_gold_evidence_but_wrong_answer, selected_evidence_has_recoverable_span, gold_evidence_has_high_extractable_answer, question_mismatch, missing_direct_evidence): pred=These tasks are crucial components to building fluent and role-specific dialog systems, for settings such as healthcare and customer service. [E3]; ref=1) generating appropriate responses for a specific role given a conversation history (speaker role modeling); 2) predicting whether a new speaker will interject on the next sentence of a conversation [E3]
- `2004.03090:a24b2269b292fd0ee81d50303d1315383c594382` (selected_non_gold_evidence, selected_evidence_span_not_recoverable, gold_evidence_has_partial_extractable_answer, question_mismatch): pred=These role-specific speaker IDs are modeled by a speaker embedding layer of the same dimensions as the transformer hidden state, injected into the transformer input layer. [E4]; ref=7 programs on National Public Radio (NPR) over 20 years [E1]
- `2004.03090:a97137318025a6642ed0634f7159255270ba3d4f` (selected_non_gold_evidence, selected_evidence_span_not_recoverable, gold_evidence_needs_abstractive_or_structured_answer, question_mismatch): pred=Hosts each have one ID, while guests share a single ID, allowing us to model idiosyncrasies and interviewing patterns for individual hosts: [E1]; ref=The evidence pack does not contain enough support to answer this question.

## Interpretation

Primary failure: `mixed_evidence_selection_and_answer_construction`

Next training signal: Add structured answer construction targets, not just evidence-id labels, because many gold answers are not recoverable as a single sentence span.

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
