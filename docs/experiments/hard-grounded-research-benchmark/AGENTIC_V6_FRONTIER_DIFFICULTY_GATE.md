# Agentic V6 Frontier Difficulty Gate

This gate rejects candidate suites that are solved too well by current frontier tool-using agents.

## Result

- Eligible runs: 2
- Buyer gate passed: false
- Observed max answer membership: 90%
- Observed max evidence recall: 80%
- Max buyer-ready answer membership threshold: 65%
- Max buyer-ready evidence recall threshold: 75%

The v6 candidate is not frontier-lab-grade: current frontier agents solve too much of it.

## Runs

| Run | Surface | Model/version | Answer membership | Evidence recall | Citation precision |
| --- | --- | --- | ---: | ---: | ---: |
| claude-code-opus-v6-full | Claude Code | claude-opus via Claude Code 2.1.118 | 89.5% | 79.5% | 99.5% |
| codex-cli-gpt-5-5-v6-full | Codex CLI | gpt-5.5 via codex exec v0.142.2 | 90% | 80% | 100% |
