# Agentic V11 Frontier Difficulty Gate

This gate rejects candidate suites that are solved too well by current frontier tool-using agents.

## Result

- Eligible runs: 2
- Buyer gate passed: true
- Observed max answer membership: 7.5%
- Observed max evidence recall: 38.3%
- Max buyer-ready answer membership threshold: 65%
- Max buyer-ready evidence recall threshold: 75%

Current frontier agents do not solve the v11 candidate at buyer-disqualifying rates.

## Runs

| Run | Surface | Model/version | Answer membership | Evidence recall | Citation precision |
| --- | --- | --- | ---: | ---: | ---: |
| claude-code-opus-v11-minimal | Claude Code | claude-opus-4-7 via Claude Code 2.1.118 minimal script run | 0% | 0% | 0% |
| codex-cli-gpt-5-5-v11-clean | Codex CLI | gpt-5.5 via codex exec v0.142.2 clean no-local-llm run | 7.5% | 38.3% | 52.8% |
