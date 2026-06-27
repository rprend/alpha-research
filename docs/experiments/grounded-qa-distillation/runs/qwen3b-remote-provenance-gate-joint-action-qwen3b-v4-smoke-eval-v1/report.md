# Qwen 3B Remote Provenance Gate

Generated: 2026-06-27T17:35:55.917Z

Status: `remote_provenance_ready_for_judge`

| Artifact | Exists | Bytes | Path |
| --- | --- | ---: | --- |
| predictions_jsonl | yes | 127511 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-v4-smoke-eval-v1/predictions.jsonl` |
| result_json | yes | 970 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-v4-smoke-eval-v1/result.json` |
| report_md | yes | 427 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-v4-smoke-eval-v1/report.md` |
| smoke_manifest_json | yes | 1379 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-v4-smoke-eval-v1/smoke_manifest.json` |
| prime_pod_status_json | yes | 393 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-v4-smoke-eval-v1/prime_pod_status.json` |
| remote_environment_txt | yes | 1955 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-v4-smoke-eval-v1/remote_environment.txt` |
| remote_smoke_bootstrap_manifest_json | yes | 1610 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen3b-v4-smoke-eval-v1/remote_smoke_bootstrap_manifest.json` |

## Required Remote Provenance

- prime_pod_status.json with provider/pod/GPU metadata captured before fetch.
- remote_environment.txt with date, uname, nvidia-smi, uv version, and git head.
- remote_smoke_bootstrap_manifest.json emitted by run_prime_qwen3b_smoke_on_pod.sh.
- smoke_manifest.json proving bounded MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false.

Failures: 0
Warnings: 0

Next step: Proceed to prediction integrity and dry judge gates.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
