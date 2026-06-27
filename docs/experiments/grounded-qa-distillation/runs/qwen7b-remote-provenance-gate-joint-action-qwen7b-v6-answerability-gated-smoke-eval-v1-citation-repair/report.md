# Qwen 3B Remote Provenance Gate

Generated: 2026-06-27T19:22:26.247Z

Status: `remote_provenance_ready_for_judge`

| Artifact | Exists | Bytes | Path |
| --- | --- | ---: | --- |
| predictions_jsonl | yes | 164744 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair/predictions.jsonl` |
| result_json | yes | 2021 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair/result.json` |
| report_md | yes | 1203 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair/report.md` |
| smoke_manifest_json | yes | 1323 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair/smoke_manifest.json` |
| prime_pod_status_json | yes | 612 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair/prime_pod_status.json` |
| remote_environment_txt | yes | 176 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair/remote_environment.txt` |
| remote_smoke_bootstrap_manifest_json | yes | 2206 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair/remote_smoke_bootstrap_manifest.json` |

## Required Remote Provenance

- prime_pod_status.json with provider/pod/GPU metadata captured before fetch.
- remote_environment.txt with date, uname, nvidia-smi, uv version, and git head.
- remote_smoke_bootstrap_manifest.json emitted by run_prime_qwen3b_smoke_on_pod.sh.
- smoke_manifest.json proving bounded MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false.

Failures: 0
Warnings: 0

Next step: Proceed to prediction integrity and dry judge gates.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
