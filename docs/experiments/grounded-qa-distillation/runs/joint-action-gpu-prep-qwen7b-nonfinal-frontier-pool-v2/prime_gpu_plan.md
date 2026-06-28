# Prime GPU Plan: Qwen 7B Non-Final Frontier Pool

Packet: `joint-action-gpu-prep-qwen7b-nonfinal-frontier-pool-v2`

Smoke run id: `joint-action-qwen7b-nonfinal-frontier-pool-v2`

This is a bounded candidate-pool generation run for verifier supervision. It is not a final-window student result.

```bash
uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-nonfinal-frontier-pool-v2/validate_joint_action_dataset_uv.py
BASE_MODEL=Qwen/Qwen2.5-7B-Instruct RUN_ID=joint-action-qwen7b-nonfinal-frontier-pool-v2 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 NUM_RETURN_SEQUENCES=3 TEMPERATURE=0.7 TOP_P=0.9 MAX_EVAL_EXAMPLES=80 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-nonfinal-frontier-pool-v2/run_joint_action_frontier_pool.sh
```

Budget guard: do not launch if live price plus tracked spend would exceed $100. Fetch artifacts, terminate the pod, and ledger actual compute spend immediately.
