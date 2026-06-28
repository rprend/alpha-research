# Prime Auth/Price Gate

Generated: 2026-06-28T18:17:05.408Z

Status: `auth_or_price_blocked`

## Checks

- PASS prime_whoami_authenticated: Passed: prime --plain whoami
- PASS prime_wallet_accessible: Passed: prime --plain wallet
- PASS prime_availability_accessible: Passed: prime --plain availability list --gpu-type L4 --gpu-count 1 --output json
- FAIL gpu_resource_available: No available resource parsed.
- PASS estimated_total_under_budget: Estimated total after GPU/hour estimate and judge: $17.795328 of $100.

## Budget Gate

| Actual spend | External compute | Planned GPU estimate | Planned judge | Estimated total | Within $100 |
| ---: | ---: | ---: | ---: | ---: | --- |
| $13.545328 | $4.679500 | $4.000000 | $0.250000 | $17.795328 | yes |

Next step: Do not create a pod. Repair Prime token permissions or billing, then rerun this gate.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
