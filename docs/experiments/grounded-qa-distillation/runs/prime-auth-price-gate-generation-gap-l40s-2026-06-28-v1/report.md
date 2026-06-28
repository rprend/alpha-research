# Prime Auth/Price Gate

Generated: 2026-06-28T18:21:55.030Z

Status: `auth_and_live_price_verified`

## Checks

- PASS prime_whoami_authenticated: Passed: prime --plain whoami
- PASS prime_wallet_accessible: Passed: prime --plain wallet
- PASS prime_availability_accessible: Passed: prime --plain availability list --gpu-type L40S_48GB --gpu-count 1 --output json
- PASS gpu_resource_available: Cheapest L40S_48GB resource id 4342eb at $0.4795/hour.
- PASS estimated_total_under_budget: Estimated total after GPU/hour estimate and judge: $14.274828 of $100.

## Budget Gate

| Actual spend | External compute | Planned GPU estimate | Planned judge | Estimated total | Within $100 |
| ---: | ---: | ---: | ---: | ---: | --- |
| $13.545328 | $4.679500 | $0.479500 | $0.250000 | $14.274828 | yes |

Next step: Proceed to the Prime runbook pod-create step only if the selected resource and expected runtime are still acceptable.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
