# Prime Auth/Price Gate

Generated: 2026-06-28T18:21:54.475Z

Status: `auth_and_live_price_verified`

## Checks

- PASS prime_whoami_authenticated: Passed: prime --plain whoami
- PASS prime_wallet_accessible: Passed: prime --plain wallet
- PASS prime_availability_accessible: Passed: prime --plain availability list --gpu-type A6000_48GB --gpu-count 1 --output json
- PASS gpu_resource_available: Cheapest A6000_48GB resource id 37f04b at $0.2135/hour.
- PASS estimated_total_under_budget: Estimated total after GPU/hour estimate and judge: $14.008828 of $100.

## Budget Gate

| Actual spend | External compute | Planned GPU estimate | Planned judge | Estimated total | Within $100 |
| ---: | ---: | ---: | ---: | ---: | --- |
| $13.545328 | $4.679500 | $0.213500 | $0.250000 | $14.008828 | yes |

Next step: Proceed to the Prime runbook pod-create step only if the selected resource and expected runtime are still acceptable.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
