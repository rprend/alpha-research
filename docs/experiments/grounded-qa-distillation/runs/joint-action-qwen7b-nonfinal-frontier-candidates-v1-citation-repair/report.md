# Qwen Non-Final Citation Repair

Run: `joint-action-qwen7b-nonfinal-frontier-candidates-v1-citation-repair`

Source run: `joint-action-qwen7b-nonfinal-frontier-candidates-v1`

This is a deterministic, zero-call syntax repair over non-final Qwen candidate-generation outputs.

| System | Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source non-final candidates | 80 | 55 | 60.0% | 65.7% | 47.0% | 24.5% | 0.0% |
| repaired non-final candidates | 80 | 55 | 60.0% | 65.7% | 47.0% | 26.6% | 78.2% |

Rows changed: 43
Repaired inline citations: 54

No OpenAI calls and no new GPU jobs.
