# Local Qwen 3B Base-Control Eval

Run: `local-qwen3b-base-control-joint-action-final-window-v2`

This is a no-training base-model control on the joint-action future-window prompt. It is not a substitute for the missing trained Qwen 3B smoke.

| Model | Examples | Answered | Abstained | Valid JSON | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Seconds/example |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Qwen/Qwen2.5-3B-Instruct` | 69 | 53 | 16 | 76.8% | 60.9% | 45.5% | 60.8% | 24.0% | 21.7% | 8.54 |

## Interpretation

- This run tests whether the 3B base model can follow the evidence/JSON/citation contract before LoRA training.
- It makes no OpenAI API calls and creates no paid GPU job.
- The paper-critical blocker remains the trained joint-action Qwen 3B smoke plus grounded-correctness judge.
