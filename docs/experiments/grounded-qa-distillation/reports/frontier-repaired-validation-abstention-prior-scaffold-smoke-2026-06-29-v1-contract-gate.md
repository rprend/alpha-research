# Evidence-First Contract Preflight

Generated: 2026-06-29T02:06:09.302Z

Status: `evidence_first_preflight_missing_eval_rows`

Prediction mode: `external_predictions`

## Metrics

- Examples: 70
- Parseable: 100.0%
- Evidence-first valid: 100.0%
- Answer type accuracy: 55.7%
- Citation-set exact: 100.0%
- Overall contract correct: 55.7%

## Decision

- Fixture passed: no
- Launch Prime now: no
- Buy OpenAI judgments now: no
- Reason: External predictions were evaluated under the evidence-first contract gate.
- Next step: Wire the evidence-first packet into a bounded local or Prime model runner only after this preflight is kept green; then judge only if generated predictions pass the contract gate.
