# Prime Auth/Price Gate

Generated: 2026-06-26T21:08:48.452Z

Status: `auth_or_price_blocked`

## Checks

- FAIL prime_whoami_authenticated: Failed: prime --plain whoami; Error: API key unauthorized. Please check that your API key has the correct permissions, generate a new one at https://app.primeintellect.ai/dashboard/tokens or run 'prime login' to configure a new API key.
- FAIL prime_wallet_accessible: Skipped because Prime auth failed.
- FAIL prime_availability_accessible: Skipped because Prime auth failed.
- FAIL gpu_resource_available: No available resource parsed.
- PASS estimated_total_under_budget: Estimated total after GPU/hour estimate and judge: $10.360265 of $100.

## Budget Gate

| Actual spend | External compute | Planned GPU estimate | Planned judge | Estimated total | Within $100 |
| ---: | ---: | ---: | ---: | ---: | --- |
| $5.893100 | $0.000000 | $4.000000 | $0.467165 | $10.360265 | yes |

Next step: Do not create a pod. Repair Prime token permissions or billing, then rerun this gate.

This gate makes no OpenAI calls, launches no GPU jobs, and records no spend.
