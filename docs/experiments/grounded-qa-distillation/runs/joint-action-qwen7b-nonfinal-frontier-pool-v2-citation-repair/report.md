# Qwen Non-Final Citation Repair

Run: `joint-action-qwen7b-nonfinal-frontier-pool-v2-citation-repair`

Source run: `joint-action-qwen7b-nonfinal-frontier-pool-v2`

This is a deterministic, zero-call syntax repair over non-final Qwen candidate-generation outputs.

| System | Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source non-final candidates | 240 | 173 | 56.7% | 57.0% | 34.7% | 21.9% | 0.0% |
| repaired non-final candidates | 240 | 173 | 56.7% | 61.0% | 35.7% | 24.5% | 57.8% |

Rows changed: 100
Repaired inline citations: 123

No OpenAI calls and no new GPU jobs.
