# Local Qwen 3B Citation-Repair Control

Run: `local-qwen3b-citation-repair-local-qwen3b-base-control-joint-action-12-v1`

Source run: `local-qwen3b-base-control-joint-action-12-v1`

This is a deterministic, zero-call syntax repair over the local Qwen 3B base-control outputs. It is not trained-student evidence.

| System | Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source base-control | 12 | 10 | 75.0% | 40.0% | 71.4% | 20.6% | 15.0% |
| repaired syntax control | 12 | 10 | 75.0% | 40.0% | 71.4% | 17.9% | 100.0% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 9 | 13 | 13 |

## Interpretation

- A local syntax repair can force cited ids into the answer text, but it does not change answer content, cited evidence ids, answer type, or grounded support.
- Citation formatting metrics must be reported separately from answer support and grounded correctness; this repaired base-control is still not trained-student evidence.

No OpenAI calls, no paid GPU jobs, and no new spend.
