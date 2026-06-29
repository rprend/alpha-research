# Prime Auth/Price Gate

Generated: 2026-06-29T08:08:15.309Z

Status: `auth_and_live_price_verified`

## Checks

- PASS prime_whoami_authenticated: Passed: prime --plain whoami
- PASS prime_wallet_accessible: Passed: prime --plain wallet
- PASS prime_availability_accessible: Passed: prime --plain availability list --gpu-type A6000_48GB --gpu-count 1 --output json
- PASS gpu_resource_available: Cheapest A6000_48GB resource id ea69b8 at $0.54/hour.
- PASS estimated_total_under_budget: Estimated total after GPU/hour estimate and judge: $18.234206 of $100.

## Budget Gate

| Actual spend | External compute | Planned GPU estimate | Planned judge | Estimated total | Within $100 |
| ---: | ---: | ---: | ---: | ---: | --- |
| $17.494206 | $5.857100 | $0.540000 | $0.200000 | $18.234206 | yes |

Next step: Proceed to the Prime runbook pod-create step only if the selected resource and expected runtime are still acceptable.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
