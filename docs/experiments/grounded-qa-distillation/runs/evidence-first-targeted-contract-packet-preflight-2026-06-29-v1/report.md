# Evidence-First Contract Preflight

Generated: 2026-06-29T00:20:17.946Z

Status: `evidence_first_fixture_preflight_passed`

Prediction mode: `oracle_fixture`

## Metrics

- Examples: 10
- Parseable: 100.0%
- Evidence-first valid: 100.0%
- Answer type accuracy: 100.0%
- Citation-set exact: 100.0%
- Overall contract correct: 100.0%

## Decision

- Fixture passed: yes
- Launch Prime now: no
- Buy OpenAI judgments now: no
- Reason: The fixture proves the parser and contract metrics are executable; it does not prove a model can follow the contract.
- Next step: Wire the evidence-first packet into a bounded local or Prime model runner only after this preflight is kept green; then judge only if generated predictions pass the contract gate.
