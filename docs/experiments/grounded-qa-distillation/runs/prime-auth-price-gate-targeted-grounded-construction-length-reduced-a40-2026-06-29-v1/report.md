# Prime Auth/Price Gate

Generated: 2026-06-29T04:56:04.098Z

Status: `auth_or_price_blocked`

## Checks

- PASS prime_whoami_authenticated: Passed: prime --plain whoami
- PASS prime_wallet_accessible: Passed: prime --plain wallet
- PASS prime_availability_accessible: Passed: prime --plain availability list --gpu-type A40 --gpu-count 1 --output json
- FAIL gpu_resource_available: No available resource parsed.
- PASS estimated_total_under_budget: Estimated total after GPU/hour estimate and judge: $20.921189 of $100.

## Budget Gate

| Actual spend | External compute | Planned GPU estimate | Planned judge | Estimated total | Within $100 |
| ---: | ---: | ---: | ---: | ---: | --- |
| $16.921189 | $5.537100 | $4.000000 | $0.000000 | $20.921189 | yes |

Next step: Do not create a pod. Repair Prime token permissions or billing, then rerun this gate.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
