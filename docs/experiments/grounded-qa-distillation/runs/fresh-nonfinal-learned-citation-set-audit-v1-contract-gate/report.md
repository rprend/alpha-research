# Evidence-First Contract Preflight

Generated: 2026-06-29T15:55:49.298Z

Status: `evidence_first_model_predictions_fail_contract_gate`

Prediction mode: `external_predictions`

## Metrics

- Examples: 315
- Parseable: 23.8%
- Evidence-first valid: 23.8%
- Answer type accuracy: 16.2%
- Citation-set exact: 41.0%
- Overall contract correct: 10.2%

## Decision

- Fixture passed: no
- Launch Prime now: no
- Buy OpenAI judgments now: no
- Reason: External predictions were evaluated under the evidence-first contract gate.
- Next step: Wire the evidence-first packet into a bounded local or Prime model runner only after this preflight is kept green; then judge only if generated predictions pass the contract gate.
