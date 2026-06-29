# Targeted Citation-Pattern Constructor Audit

Generated: 2026-06-29T09:39:11.510Z

Status: `targeted_constructor_closes_most_construction_gaps`

This run makes no OpenAI calls and launches no Prime compute.

## Metrics

| Policy / pool | Contract correct | Rate |
| --- | ---: | ---: |
| Prior router | 47 / 70 | 67.1% |
| D417 two-head selector | 47 / 70 | 67.1% |
| Targeted constructor standalone | 44 / 70 | 62.9% |
| Augmented pool oracle | 58 / 70 | 82.9% |
| Augmented + targeted oracle | 70 / 70 | 100.0% |

## Construction Gap

- D418 irrecoverable construction gaps: 12
- Correct on D418 irrecoverable gaps: 12
- New correct candidates outside augmented pool: 12
- Combined oracle delta: +12
- Combined oracle remaining gap to 70: 0

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote as policy: no
- Keep as diagnostic candidate family: yes
- Reason: The validation-informed constructor adds 12 new correct candidates, repairing 12 D418 construction gaps and moving oracle headroom from 58/70 to 70/70. Because it was designed after inspecting validation misses, it is diagnostic only.
- Next step: Convert the successful citation-pattern rules into train-derived features or generate a fresh heldout packet before spending on a learned constructor.
