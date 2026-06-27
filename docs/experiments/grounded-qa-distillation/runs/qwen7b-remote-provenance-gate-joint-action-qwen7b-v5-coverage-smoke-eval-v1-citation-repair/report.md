# Qwen 3B Remote Provenance Gate

Generated: 2026-06-27T18:48:49.395Z

Status: `remote_provenance_ready_for_judge`

| Artifact | Exists | Bytes | Path |
| --- | --- | ---: | --- |
| predictions_jsonl | yes | 196219 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair/predictions.jsonl` |
| result_json | yes | 2002 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair/result.json` |
| report_md | yes | 1180 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair/report.md` |
| smoke_manifest_json | yes | 1232 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair/smoke_manifest.json` |
| prime_pod_status_json | yes | 365 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair/prime_pod_status.json` |
| remote_environment_txt | yes | 1949 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair/remote_environment.txt` |
| remote_smoke_bootstrap_manifest_json | yes | 1831 | `docs/experiments/grounded-qa-distillation/runs/joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair/remote_smoke_bootstrap_manifest.json` |

## Required Remote Provenance

- prime_pod_status.json with provider/pod/GPU metadata captured before fetch.
- remote_environment.txt with date, uname, nvidia-smi, uv version, and git head.
- remote_smoke_bootstrap_manifest.json emitted by run_prime_qwen3b_smoke_on_pod.sh.
- smoke_manifest.json proving bounded MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false.

Failures: 0
Warnings: 0

Next step: Proceed to prediction integrity and dry judge gates.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
