# Support Ranker Pairwise Packet

Generated: 2026-06-28T07:26:33.306Z

Status: `pairwise_signal_present_but_sparse`

This run makes no OpenAI calls and launches no compute. It constructs pairwise ranking data from existing paid judgments.

## Pair Counts

| Split | Window | Pairs | Examples with pairs | Training use |
| --- | --- | ---: | ---: | --- |
| Train | 160-240 | 4 | 4 | allowed |
| Validation | 240-320 | 6 | 3 | allowed |
| Diagnostic | 321-389 | 61 | 8 | forbidden diagnostic only |

## Recommendation

- Train ranker now: no
- Launch GPU now: no
- Reason: Existing pre-final judged candidates produce too few supported-vs-unsupported answer pairs for a reliable ranker. Add or mine more pre-final candidate diversity before training.
