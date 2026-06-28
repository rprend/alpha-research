# Generation-Gap Qwen 3B SFT/DPO Launch Packet

Status: `ready_for_bounded_prime_smoke_after_live_resource_gate`

This packet makes no OpenAI calls and creates no Prime pod.

## Dataset

| SFT train | SFT validation | DPO train | DPO validation | Eval prompts | Diagnostic targets |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 240 | 75 | 397 | 124 | 10 | 10 |

Final diagnostic targets are loaded only by the evaluator after generation. They are not used for training or validation selection.

## Launch Contract

```bash
BASE_MODEL=Qwen/Qwen2.5-3B-Instruct \
RUN_ID=generation-gap-qwen3b-sft-dpo-smoke-d321-v1 \
MAX_SFT_STEPS=40 \
MAX_DPO_STEPS=20 \
PUSH_TO_HUB=false \
REPORT_TO=none \
MAX_EVAL_EXAMPLES=10 \
docs/experiments/grounded-qa-distillation/runs/generation-gap-qwen3b-sft-dpo-launch-packet-d321-2026-06-28-v1/run_joint_action_smoke.sh
```

After predictions are fetched:

```bash
node scripts/grounded-qa-distillation-generation-gap-eval-harness.mjs --packet-run-id generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1 --prediction-file docs/experiments/grounded-qa-distillation/runs/generation-gap-qwen3b-sft-dpo-smoke-d321-v1/predictions.jsonl --run-id generation-gap-qwen3b-sft-dpo-smoke-d321-v1-shape-eval
```

## Budget

Preferred read-only Prime gate: `prime-auth-price-gate-generation-gap-a6000-2026-06-28-v1`

Estimated total after one hour on the cheapest parsed `A6000_48GB` resource plus a small judge reserve: `$14.00882835` of `$100`.

## Decision

- Launch Prime now: no
- Reason: the packet is ready, but pod creation should remain an explicit next step guarded by a fresh live resource gate immediately before creation.
- Next step: create a bounded Prime pod only after rechecking the selected resource id, run the smoke command, fetch predictions, terminate the pod, finalize spend, and run the D322 shape harness before any paid judging.
