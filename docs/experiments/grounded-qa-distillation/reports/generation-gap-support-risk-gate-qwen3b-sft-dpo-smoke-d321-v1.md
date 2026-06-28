# Generation-Gap Support-Risk Gate

Status: `support_risk_gate_ready_for_shape_eval`

Source run: `generation-gap-citation-repair-qwen3b-sft-dpo-smoke-d321-v1`

This run makes no OpenAI calls and launches no Prime job.

## Summary

| Examples | Source answered | Kept answers | Converted to abstain | Kept yes/no | Mean kept coverage | Mean suppressed coverage |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 10 | 2 | 8 | 2 | 0.000 | 0.125 |

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: Run the D322 generation-gap shape harness on gated_predictions.jsonl. Only consider paid judging if the gate passes.
- Reason: This is a zero-call abstention/support-risk scaffold; shape scoring must come before any paid grounded-correctness judging.
