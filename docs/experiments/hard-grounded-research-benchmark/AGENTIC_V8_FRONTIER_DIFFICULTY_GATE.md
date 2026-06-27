# Agentic V8 Frontier Difficulty Gate

This gate rejects candidate suites that are solved too well by current frontier tool-using agents.

## Result

- Eligible runs: 1
- Buyer gate passed: false
- Observed max answer membership: 41.5%
- Observed max evidence recall: 75%
- Max buyer-ready answer membership threshold: 65%
- Max buyer-ready evidence recall threshold: 75%

The v8 candidate is not frontier-lab-grade: current frontier agents solve too much of it.

## Runs

| Run | Surface | Model/version | Answer membership | Evidence recall | Citation precision |
| --- | --- | --- | ---: | ---: | ---: |
| codex-cli-gpt-5-5-v8-full | Codex CLI | gpt-5.5 via codex exec v0.142.2 | 41.5% | 75% | 97.5% |
