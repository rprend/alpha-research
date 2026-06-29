# Evidence-First Contract Preflight

Generated: 2026-06-29T16:15:52.143Z

Status: `evidence_first_model_predictions_fail_contract_gate`

Prediction mode: `external_predictions`

## Metrics

- Examples: 315
- Parseable: 96.5%
- Evidence-first valid: 96.5%
- Answer type accuracy: 70.8%
- Citation-set exact: 75.2%
- Overall contract correct: 53.3%

## Decision

- Fixture passed: no
- Launch Prime now: no
- Buy OpenAI judgments now: no
- Reason: External predictions were evaluated under the evidence-first contract gate.
- Next step: Wire the evidence-first packet into a bounded local or Prime model runner only after this preflight is kept green; then judge only if generated predictions pass the contract gate.
