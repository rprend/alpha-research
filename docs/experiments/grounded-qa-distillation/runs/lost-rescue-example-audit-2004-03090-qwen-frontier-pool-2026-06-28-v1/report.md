# Lost-Rescue Example Audit

Generated: 2026-06-28T11:57:22.984Z

This is a zero-call final-diagnostic audit. It uses final-window labels only as forbidden diagnostics and makes no training decision from them.

Question: Which news outlets did they focus on?

Reference answer: natural dialog [E2]

## Diagnosis

- Primary failure: ambiguous_question_reference_mismatch_plus_ranking_margin
- Interpretation: The final example is not a clean training target: the question asks for news outlets, the reference answer is 'natural dialog', and the candidate-pool judge marks a dataset-list answer as supported.
- D262 selected: qwen3b_v3
- Boundary-only selected: qwen7b_v11
- Hybrid selected: qwen3b_v3

## Candidates

- qwen7b_v11: supported=true, ranks D262/boundary/hybrid=4/1/4, tags=low_question_alignment,low_reference_alignment
- qwen3b_v3: supported=false, ranks D262/boundary/hybrid=1/3/1, tags=existing_unsupported_claim,verbose_answer,low_question_alignment,low_reference_alignment,question_entity_mismatch
- qwen7b_v5: supported=false, ranks D262/boundary/hybrid=2/4/2, tags=existing_unsupported_claim,verbose_answer,low_question_alignment,question_entity_mismatch
- qwen7b_v7: supported=false, ranks D262/boundary/hybrid=3/2/3, tags=existing_unsupported_claim,low_question_alignment,low_reference_alignment,question_entity_mismatch

## Decision

- Use example for training now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: The lost rescue is label-ambiguous and should not drive selector training or policy thresholds.
- Next step: Quarantine this final diagnostic as a label-quality risk and audit whether final-window support metrics should separately track ambiguous-question examples.
