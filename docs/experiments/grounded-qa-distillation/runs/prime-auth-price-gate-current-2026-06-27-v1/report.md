# Prime Auth/Price Gate

Generated: 2026-06-27T15:40:57.149Z

Status: `auth_and_live_price_verified`

## Checks

- PASS prime_whoami_authenticated: Passed: prime --plain whoami
- PASS prime_wallet_accessible: Passed: prime --plain wallet
- PASS prime_availability_accessible: Passed: prime --plain availability list --gpu-type RTX6000Ada_48GB --gpu-count 1 --output json
- PASS gpu_resource_available: Cheapest RTX6000Ada_48GB resource id 9908d2 at $0.364/hour.
- PASS estimated_total_under_budget: Estimated total after GPU/hour estimate and judge: $6.727551 of $100.

## Budget Gate

| Actual spend | External compute | Planned GPU estimate | Planned judge | Estimated total | Within $100 |
| ---: | ---: | ---: | ---: | ---: | --- |
| $5.896386 | $0.000000 | $0.364000 | $0.467165 | $6.727551 | yes |

Next step: Proceed to the Prime runbook pod-create step only if the selected resource and expected runtime are still acceptable.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
