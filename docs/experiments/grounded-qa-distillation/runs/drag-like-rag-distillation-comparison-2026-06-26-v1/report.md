# DRAG-Like RAG Distillation Comparison

Scope: extended_temporal_future_holdout examples 321-389

This is a DRAG-like framing comparison over existing artifacts. It is not a full DRAG reproduction.

## Framing

- Close neighbor: DRAG-like RAG-to-small-language-model distillation.
- Comparable axis: A smaller or cheaper model/scaffold answers from a compact retrieved evidence pack.
- Non-comparable axis: This project requires dated/evolving-KB splits, inline evidence citations, support-aware abstention, and judged citation-grounded correctness rather than answer-only utility.

## Systems

| System | Answered | Answer rate | Citation precision | Citation recall | Answer F1 | Inline citation rate | Answer support | Overall judged correctness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| direct_mini_rag_student | 53 | 76.8% | 68.2% | 77.3% | 32.2% | 100.0% | 64.2% | 72.5% |
| zero_call_risk_gate_over_direct_student | 44 | 63.8% | 66.3% | 61.4% | 26.5% | 100.0% | 70.5% | 79.7% |
| zero_call_extractive_distilled_scaffold | 22 | 31.9% | 63.6% | 21.6% | 6.1% | 100.0% | n/a | n/a |
| zero_call_span_distilled_scaffold | 52 | 75.4% | 59.6% | 58.0% | 13.8% | 100.0% | 19.2% | 39.1% |
| local_qwen05b_sft_answer_repeat2 | 40 | 58.0% | 33.1% | 30.7% | 13.9% | 97.5% | 5.0% | 42.0% |

## Interpretation

Generic RAG distillation is an insufficient baseline unless it is judged on support and abstention under temporal update splits.

- The direct-mini RAG student plus citation repair reaches 72.5% GPT-4o judged correctness and 64.2% answer support, but still leaves unsupported answered claims.
- A zero-call risk gate improves overall judged correctness to 79.7% and answer support to 70.5%, but answers fewer examples and loses reference recall/F1.
- Zero-call distilled local scaffolds are materially cheaper but not competitive: the extractive scaffold answers 22/69 with 6.1% answer F1, while the span scaffold answers 52/69 but only 19.2% of answered spans are judged supported.
- The local Qwen 0.5B answer-repeat SFT result demonstrates the generic-SFT failure mode: 97.5% inline citation compliance with only 5.0% answer support.

## Paper Implication

A DRAG-like comparison should be framed as a close baseline family, but the novel target is support-preserving data construction over evolving/private KBs. The next model result must show whether joint-action SFT/DPO improves support without relying on per-query teacher or verifier calls.

## True Reproduction Needed

- Implement DRAG's exact teacher/student protocol if a reviewer asks for apples-to-apples reproduction.
- Evaluate it on the same final dated/private KB window with the same GPT-4o support judge.
- Report answer support, abstention support, citation precision/recall, and total inference cost rather than answer F1 alone.

## Budget

No new OpenAI calls, no GPU jobs, and no new spend.
