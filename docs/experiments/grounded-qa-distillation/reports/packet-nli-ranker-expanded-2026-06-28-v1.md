# Packet NLI Ranker

Generated: 2026-06-28T07:50:05.484Z

Status: `packet_nli_not_sufficient`

This run makes no OpenAI calls and launches no compute. It scores packet candidates with `cross-encoder/nli-distilroberta-base` locally.

## Metrics

| Split | Pairs/examples | Correct/supported | Rate |
| --- | ---: | ---: | ---: |
| Train pairwise | 59 | 41 | 69.5% |
| Validation pairwise | 24 | 9 | 37.5% |
| Final diagnostic pairwise | 61 | 21 | 34.4% |
| Final diagnostic selection | 8 | 4 | 50.0% |

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Reason: Local NLI candidate scoring does not transfer strongly enough to support final-frontier selection.
- Next step: Add frontier-like non-final Qwen candidate pairs or buy a bounded GPT-4o labeling batch targeted at Qwen switch candidates before spending Prime GPU budget.
