# Prime Auth/Price Gate

Generated: 2026-06-29T08:06:44.157Z

Status: `auth_or_price_blocked`

## Checks

- PASS prime_whoami_authenticated: Passed: prime --plain whoami
- PASS prime_wallet_accessible: Passed: prime --plain wallet
- PASS prime_availability_accessible: Passed: prime --plain availability list --gpu-type L4_24GB --gpu-count 1 --output json
- FAIL gpu_resource_available: No available resource parsed.
- PASS estimated_total_under_budget: Estimated total after GPU/hour estimate and judge: $21.694206 of $100.

## Budget Gate

| Actual spend | External compute | Planned GPU estimate | Planned judge | Estimated total | Within $100 |
| ---: | ---: | ---: | ---: | ---: | --- |
| $17.494206 | $5.857100 | $4.000000 | $0.200000 | $21.694206 | yes |

Next step: Do not create a pod. Repair Prime token permissions or billing, then rerun this gate.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
