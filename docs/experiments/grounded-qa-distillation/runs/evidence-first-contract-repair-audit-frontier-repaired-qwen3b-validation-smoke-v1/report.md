# Evidence-First Repair Audit

Generated: 2026-06-29T02:53:32.038Z

Status: `repair_recovers_syntax_not_correctness`

## Source

- Source prediction run: `frontier-repaired-qwen3b-validation-smoke-v1`
- Source contract gate: `frontier-repaired-qwen3b-validation-smoke-v1-evidence-first-contract-gate`
- Source evidence-first valid: 17.1%
- Source contract correct: 8.6%

## Repair Metrics

- Examples: 70
- Repaired answer rate: 47.1%
- Evidence-first valid: 98.6%
- Answer type accuracy: 60.0%
- Citation-set exact: 68.6%
- Inline citation rate: 100.0%
- Contract correct: 50.0%

## Taxonomy

- Source gate errors: {"abstention must be insufficient":16,"abstention needs missing support":16,"grounded answer must be sufficient":5,"grounded answer needs supported_claims":11,"answer citations must equal claim citation union":36}
- Repair actions: {"preserve_or_repair_abstention":23,"convert_empty_or_uncited_grounded_answer_to_abstain":14,"coerce_supported_claims_to_objects":33,"append_inline_citations_to_answer":32}
- Answer type flips: 14
- Repaired contract-correct examples: 35

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote repair as solution: no
- Reason: The audit is a zero-spend structural test. Passing syntax after repair would not prove grounded correctness; failing after repair identifies the next contract-learning bottleneck.
- Next step: Do not spend on judging this repair. Use constrained decoding/schema repair in the next packet, but focus the learning target on answerability and citation selection rather than syntax.
