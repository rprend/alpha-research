# Fresh Nonfinal Learned Citation-Set Audit

Generated: 2026-06-29T15:55:49.305Z

Status: `learned_citation_set_beats_pattern_on_fresh_validation`

This run makes no OpenAI calls and launches no Prime compute.

## Metrics

| Split | Contract correct | Grounded target correct | False abstain | Over-answer | Citation errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| Train tune | 65 / 160 | 21 / 103 | 39 | 13 | 43 |
| Train heldout | 28 / 80 | 9 / 54 | 19 | 7 | 26 |
| Fresh validation | 32 / 75 | 16 / 49 | 14 | 10 | 19 |

Fresh validation oracle headroom: 75/75

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote learned constructor: no
- Keep as candidate source: yes
- Reason: The learned citation-set predictor beats the generic pattern rate on fresh validation (32/75) with oracle headroom 75/75, but remains too weak as a standalone policy.
- Next step: Use the learned citation-set predictor as a candidate source in a combined-pool fresh-validation router audit before paid labels.
