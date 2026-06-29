# Evidence-First Repair Audit

Generated: 2026-06-29T00:17:35.904Z

Status: `repair_recovers_syntax_not_correctness`

## Source

- Source prediction run: `evidence-first-contract-qwen3b-smoke-v1`
- Source contract gate: `evidence-first-contract-qwen3b-smoke-v1-evidence-first-contract-gate`
- Source evidence-first valid: 0.0%
- Source contract correct: 0.0%

## Repair Metrics

- Examples: 10
- Repaired answer rate: 50.0%
- Evidence-first valid: 100.0%
- Answer type accuracy: 60.0%
- Citation-set exact: 60.0%
- Inline citation rate: 100.0%
- Contract correct: 30.0%

## Taxonomy

- Source gate errors: {"grounded answer needs supported_claims":4,"answer citations must equal claim citation union":6,"abstention must be insufficient":1,"abstention needs missing support":1}
- Repair actions: {"convert_empty_or_uncited_grounded_answer_to_abstain":4,"coerce_supported_claims_to_objects":5,"append_inline_citations_to_answer":5,"preserve_or_repair_abstention":1}
- Answer type flips: 4
- Repaired contract-correct examples: 3

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote repair as solution: no
- Reason: The audit is a zero-spend structural test. Passing syntax after repair would not prove grounded correctness; failing after repair identifies the next contract-learning bottleneck.
- Next step: Do not spend on judging this repair. Use constrained decoding/schema repair in the next packet, but focus the learning target on answerability and citation selection rather than syntax.
