# Qwen 3B Remote Provenance Gate

Generated: 2026-06-27T20:04:48.752Z

Status: `remote_provenance_ready_for_judge`

| Artifact | Exists | Bytes | Path |
| --- | --- | ---: | --- |
| predictions_jsonl | yes | 122144 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1/predictions.jsonl` |
| result_json | yes | 990 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1/result.json` |
| report_md | yes | 428 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1/report.md` |
| smoke_manifest_json | yes | 1427 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1/smoke_manifest.json` |
| prime_pod_status_json | yes | 393 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1/prime_pod_status.json` |
| remote_environment_txt | yes | 1955 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1/remote_environment.txt` |
| remote_smoke_bootstrap_manifest_json | yes | 1649 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1/remote_smoke_bootstrap_manifest.json` |

## Required Remote Provenance

- prime_pod_status.json with provider/pod/GPU metadata captured before fetch.
- remote_environment.txt with date, uname, nvidia-smi, uv version, and git head.
- remote_smoke_bootstrap_manifest.json emitted by run_prime_qwen3b_smoke_on_pod.sh.
- smoke_manifest.json proving bounded MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false.

Failures: 0
Warnings: 0

Next step: Proceed to prediction integrity and dry judge gates.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
