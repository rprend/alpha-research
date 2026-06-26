# Agentic V4 Frontier Difficulty Gate

This gate rejects candidate suites that are solved too well by current frontier tool-using agents.

## Result

- Eligible runs: 2
- Buyer gate passed: false
- Observed max answer membership: 100%
- Observed max evidence recall: 80%
- Max buyer-ready answer membership threshold: 65%
- Max buyer-ready evidence recall threshold: 75%

The v4 candidate is not frontier-lab-grade: current frontier agents solve too much of it, mainly because visible marker roles make task structure recoverable.

## Runs

| Run | Surface | Model/version | Answer membership | Evidence recall | Citation precision |
| --- | --- | --- | ---: | ---: | ---: |
| claude-code-opus-v4-full | Claude Code | claude-opus-4-7 via Claude Code 2.1.118 | 100% | 80% | 100% |
| codex-cli-gpt-5-5-v4-full | Codex CLI | gpt-5.5 via codex exec v0.142.2 | 80% | 80% | 95% |
