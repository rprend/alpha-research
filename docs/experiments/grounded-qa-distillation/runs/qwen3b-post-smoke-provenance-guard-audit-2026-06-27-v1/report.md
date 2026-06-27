# Qwen 3B Post-Smoke Provenance Guard Audit

Generated: 2026-06-27T04:17:29.445Z

Status: `post_smoke_provenance_guard_verified`

| Observation | Value |
| --- | --- |
| Integrity status | `ready_for_paid_judge` |
| Provenance status | `provenance_artifacts_missing` |
| Pipeline status | `failed_remote_provenance_not_ready` |
| Dry judge result created | no |
| Paid judge result created | no |

## Expected Guard Behavior

- Prediction integrity can pass on a complete local fixture.
- Remote provenance must fail when prime_pod_status.json, remote_environment.txt, and remote_smoke_bootstrap_manifest.json are absent.
- The post-smoke pipeline must exit before dry judge creation.
- No OpenAI judge calls or external compute may occur in this audit.

This audit makes no OpenAI calls, launches no GPU jobs, records no spend, and removes temporary fixture run directories.
