# OpenAI Pool Adjudication

Generated: 2026-06-28T10:27:24.920Z

Status: `complete`

This run buys a capped GPT-4o batch for pool-level candidate selection over non-final generated Qwen candidates only. It excludes reference answers and uses final-window labels nowhere.

| Pools | Calls | Cost | Selected supported | Pool success |
| ---: | ---: | ---: | ---: | ---: |
| 20 | 20 | $0.106195 | 19/20 | 95.0% |

## Decision

- Train selector from pool labels now: yes
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: Pool-level GPT-4o adjudication reliably selects existing-supported generated candidates on the targeted non-final batch.
- Next step: Train a listwise selector from pool-choice labels and evaluate final diagnostic selection before any generator GPU run.
