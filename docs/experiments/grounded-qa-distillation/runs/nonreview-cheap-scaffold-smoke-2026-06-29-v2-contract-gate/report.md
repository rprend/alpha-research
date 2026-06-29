# Evidence-First Contract Preflight

Generated: 2026-06-29T18:07:00.424Z

Status: `evidence_first_model_predictions_fail_contract_gate`

Prediction mode: `external_predictions`

## Metrics

- Examples: 64
- Parseable: 100.0%
- Evidence-first valid: 100.0%
- Answer type accuracy: 93.8%
- Citation-set exact: 62.5%
- Overall contract correct: 57.8%

## Decision

- Fixture passed: no
- Launch Prime now: no
- Buy OpenAI judgments now: no
- Reason: External predictions were evaluated under the evidence-first contract gate.
- Next step: Wire the evidence-first packet into a bounded local or Prime model runner only after this preflight is kept green; then judge only if generated predictions pass the contract gate.
