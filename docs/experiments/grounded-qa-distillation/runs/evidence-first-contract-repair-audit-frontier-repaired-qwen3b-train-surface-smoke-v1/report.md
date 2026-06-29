# Evidence-First Repair Audit

Generated: 2026-06-29T06:37:05.440Z

Status: `repair_recovers_syntax_not_correctness`

## Source

- Source prediction run: `frontier-repaired-qwen3b-train-surface-smoke-v1`
- Source contract gate: `frontier-repaired-qwen3b-train-surface-smoke-v1-evidence-first-contract-gate`
- Source evidence-first valid: 44.8%
- Source contract correct: 33.2%

## Repair Metrics

- Examples: 223
- Repaired answer rate: 31.4%
- Evidence-first valid: 100.0%
- Answer type accuracy: 59.2%
- Citation-set exact: 87.0%
- Inline citation rate: 100.0%
- Contract correct: 59.2%

## Taxonomy

- Source gate errors: {"answer citations must equal claim citation union":30,"abstention must be insufficient":90,"abstention needs missing support":93}
- Repair actions: {"coerce_supported_claims_to_objects":29,"append_inline_citations_to_answer":28,"preserve_or_repair_abstention":152,"convert_empty_or_uncited_grounded_answer_to_abstain":1}
- Answer type flips: 1
- Repaired contract-correct examples: 132

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote repair as solution: no
- Reason: The audit is a zero-spend structural test. Passing syntax after repair would not prove grounded correctness; failing after repair identifies the next contract-learning bottleneck.
- Next step: Do not spend on judging this repair. Use constrained decoding/schema repair in the next packet, but focus the learning target on answerability and citation selection rather than syntax.
