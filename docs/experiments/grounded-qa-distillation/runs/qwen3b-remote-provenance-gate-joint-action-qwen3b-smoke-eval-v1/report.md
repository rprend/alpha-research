# Qwen 3B Remote Provenance Gate

Generated: 2026-06-27T03:10:44.565Z

Status: `waiting_for_smoke_artifacts`

| Artifact | Exists | Bytes | Path |
| --- | --- | ---: | --- |
| predictions_jsonl | no | 0 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/predictions.jsonl` |
| result_json | no | 0 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/result.json` |
| report_md | no | 0 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/report.md` |
| smoke_manifest_json | no | 0 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/smoke_manifest.json` |
| prime_pod_status_json | no | 0 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/prime_pod_status.json` |
| remote_environment_txt | no | 0 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/remote_environment.txt` |
| remote_smoke_bootstrap_manifest_json | no | 0 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-smoke-eval-v1/remote_smoke_bootstrap_manifest.json` |

## Required Remote Provenance

- prime_pod_status.json with provider/pod/GPU metadata captured before fetch.
- remote_environment.txt with date, uname, nvidia-smi, uv version, and git head.
- remote_smoke_bootstrap_manifest.json emitted by run_prime_qwen3b_smoke_on_pod.sh.
- smoke_manifest.json proving bounded MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false.

Failures: 0
Warnings: 0

Next step: Run the bounded remote Qwen 3B smoke and fetch core plus provenance artifacts.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
