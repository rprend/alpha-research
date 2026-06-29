# Broad Sufficiency Constructor Smoke

Generated: 2026-06-29T08:59:45.594Z

Status: `constructor_adds_candidate_headroom_but_not_standalone_policy`

This run makes no OpenAI calls and launches no Prime compute.

## Metrics

| Policy / pool | Contract correct | Rate |
| --- | ---: | ---: |
| Abstention prior | 39 / 70 | 55.7% |
| Train-calibrated scaffold | 44 / 70 | 62.9% |
| Current router | 47 / 70 | 67.1% |
| Constructor standalone | 41 / 70 | 58.6% |
| Existing pool oracle | 54 / 70 | 77.1% |
| Augmented pool oracle | 58 / 70 | 82.9% |

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote constructor as policy: no
- Keep as candidate generator: yes
- Reason: The constructor is weaker standalone (41/70) than the router (47/70), but it adds 4 correct candidates on rows the existing pool could not solve.
- Next step: Train or tune a leakage-safe router that can choose among the existing three systems plus this constructor, then test whether it captures the added oracle headroom without validation-label leakage.
