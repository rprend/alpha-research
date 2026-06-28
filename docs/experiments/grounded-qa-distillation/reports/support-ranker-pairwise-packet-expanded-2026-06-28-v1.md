# Support Ranker Pairwise Packet

Generated: 2026-06-28T07:34:09.698Z

Status: `pairwise_packet_ready_for_ranker_training`

This run makes no OpenAI calls and launches no compute. It constructs pairwise ranking data from existing paid judgments.

## Pair Counts

| Split | Window | Pairs | Examples with pairs | Training use |
| --- | --- | ---: | ---: | --- |
| Train | extended_future_holdout_0-80,extended_future_holdout_80-160,160-240,temporal_test_80-132 | 59 | 37 | allowed |
| Validation | 240-320,temporal_test_132-172 | 24 | 9 | allowed |
| Diagnostic | 321-389 | 61 | 8 | forbidden diagnostic only |

## Recommendation

- Train ranker now: yes
- Launch GPU now: no
- Reason: The packet has enough non-final pairwise rows for a local ranker experiment; train/evaluate that before any additional GPU generation run.
