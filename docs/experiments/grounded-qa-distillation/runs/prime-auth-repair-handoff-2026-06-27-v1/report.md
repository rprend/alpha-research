# Prime Auth Repair Handoff

Generated: 2026-06-27T15:39:19.244Z

Status: `prime_auth_repaired_gates_refreshed`

This artifact makes the Prime credential repair path explicit without storing or printing the secret. It only writes `~/.prime/config.json` when `--apply=true` is supplied and `PRIME_API_KEY` is present in the environment.

## Checks

- PASS secret_env_path_recorded: Use /Users/ryanprendergast/.codex/secrets.env with the hidden-input helper; do not paste keys into chat.
- PASS apply_requires_explicit_flag: apply=true was explicitly requested.
- PASS prime_api_key_env_present_when_applying: PRIME_API_KEY is present in the process environment.
- PASS config_write_safe_when_attempted: PRIME_API_KEY was loaded from the process environment and written to the local Prime CLI config with mode 0600.
- PASS prime_config_mode_private: /Users/ryanprendergast/.prime/config.json should be mode 0600 after repair.
- PASS budget_under_cap_before_launch: Actual spend is $5.896386 / $100.
- PASS no_pod_creation_performed: This handoff only updates local auth config and runs read-only gates; it never creates a Prime pod.

## Commands

Collect the key with hidden input:

```bash
/Users/ryanprendergast/.codex/scripts/ask-secret.sh PRIME_API_KEY /Users/ryanprendergast/.codex/secrets.env "Enter Prime Intellect API key"
```

Apply it and refresh read-only gates:

```bash
set -a; source /Users/ryanprendergast/.codex/secrets.env; set +a; node scripts/grounded-qa-distillation-prime-auth-repair-handoff.mjs --apply=true --max-budget-usd=100
```

Check the Prime launch predicate after repair:

```bash
node scripts/grounded-qa-distillation-prime-guarded-smoke-entrypoint.mjs --prime-gate-run-id=prime-auth-price-gate-current-2026-06-27-v1
```

## Budget

Actual spend remains $5.896386 with $0.000000 external compute spend. Remaining budget is $94.103614 under the $100.00 cap.

This handoff makes no OpenAI calls, creates no pod, launches no GPU job, and records no spend.
