# Generation-Gap Citation Contract Repair

Status: `citation_contract_repair_ready_for_shape_eval`

Source run: `generation-gap-qwen3b-sft-dpo-smoke-d321-v1`

This run makes no OpenAI calls and launches no Prime job.

## Summary

| Examples | Source answered | Repaired answered | Source inline-complete | Repaired inline-complete | Citation rows changed | Answer decisions changed |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 10 | 10 | 0 | 10 | 2 | 0 |

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: Run the D322 generation-gap shape harness on repaired_predictions.jsonl. Only consider paid judging if the shape gate passes.
- Reason: This repair only tests citation-surface headroom; it is not a grounded-correctness result.
