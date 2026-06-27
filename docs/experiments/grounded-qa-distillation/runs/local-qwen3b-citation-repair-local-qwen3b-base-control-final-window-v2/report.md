# Local Qwen 3B Citation-Repair Control

Run: `local-qwen3b-citation-repair-local-qwen3b-base-control-final-window-v2`

Source run: `local-qwen3b-base-control-joint-action-final-window-v2`

This is a deterministic, zero-call syntax repair over the local Qwen 3B base-control outputs. It is not trained-student evidence.

| System | Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source base-control | 69 | 53 | 60.9% | 45.5% | 60.8% | 24.0% | 21.7% |
| repaired syntax control | 69 | 53 | 60.9% | 45.5% | 60.8% | 24.1% | 94.3% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 39 | 64 | 64 |

## Interpretation

- A local syntax repair can force cited ids into the answer text, but it does not change answer content, cited evidence ids, answer type, or grounded support.
- Citation formatting metrics must be reported separately from answer support and grounded correctness; this repaired base-control is still not trained-student evidence.

No OpenAI calls, no paid GPU jobs, and no new spend.
