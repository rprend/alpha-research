# Prime GPU Plan: Qwen 7B Non-Final Frontier Candidate Generation

Packet: `joint-action-gpu-prep-qwen7b-nonfinal-frontier-candidates-v1`

Smoke run id: `joint-action-qwen7b-nonfinal-frontier-candidates-v1`

This packet is for generating leakage-safe non-final Qwen candidates, not for final-window model evidence.

```bash
uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-nonfinal-frontier-candidates-v1/validate_joint_action_dataset_uv.py
BASE_MODEL=Qwen/Qwen2.5-7B-Instruct RUN_ID=joint-action-qwen7b-nonfinal-frontier-candidates-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-nonfinal-frontier-candidates-v1/run_joint_action_smoke.sh
```

Budget guard: do not launch if estimated total OpenAI plus external compute spend would exceed $100. Fetch artifacts, terminate the pod, and ledger actual compute spend immediately.
