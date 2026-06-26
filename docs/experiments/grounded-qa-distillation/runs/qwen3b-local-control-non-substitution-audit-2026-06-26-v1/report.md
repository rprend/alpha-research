# Qwen 3B Local Control Non-Substitution Audit

Generated: 2026-06-26T23:40:01.606Z

Status: `local_controls_rejected_as_final_qwen_smoke`

Final smoke run reserved for claims: `joint-action-qwen3b-smoke-eval-v1`

| Control | Integrity gate | Remote provenance gate | Substitution blockers | Accepted as final smoke |
| --- | --- | --- | ---: | --- |
| `local-qwen3b-base-control-joint-action-12-v1` | `refuse_paid_judge_prediction_integrity_failed` | `waiting_for_smoke_artifacts` | 7 | no |
| `local-qwen3b-citation-repair-local-qwen3b-base-control-joint-action-12-v1` | `refuse_paid_judge_prediction_integrity_failed` | `waiting_for_smoke_artifacts` | 7 | no |

## Required Final Smoke Evidence

- 69 final-window predictions from the trained joint-action adapter.
- smoke_manifest.json with bounded SFT/DPO smoke settings and run_id matching the final smoke run.
- prime_pod_status.json, remote_environment.txt, and remote_smoke_bootstrap_manifest.json for remote GPU provenance.
- A paid grounded-correctness judge run after prediction integrity and provenance gates pass.
- Qwen result integration and Pareto-table update from the real predictions and judge artifacts.

## Conclusion

The local controls remain useful negative/control evidence, but production gates reject them as final trained-smoke substitutes.

This audit makes no OpenAI calls, launches no GPU jobs, records no spend, and removes temporary gate directories.
