# Targeted Grounded Construction DPO Prompt Repair

Generated: 2026-06-29T05:18:08.079Z

Status: `targeted_grounded_construction_dpo_prompt_repaired_packet_ready_for_preflight`

## Repair

| Split | Repaired prompts | Unmatched rows | Blank prompts after |
| --- | ---: | ---: | ---: |
| DPO train | 223 | 0 | 0 |
| DPO validation | 70 | 0 | 0 |

## Length Profile

| Surface | Rows | Max approx tokens | Rows over limit |
| --- | ---: | ---: | ---: |
| SFT full | 293 | 1684 | 0 |
| DPO prompt | 524 | 1160 | 0 |
| DPO full | 1048 | 1684 | 0 |
| Eval prompt | 10 | 820 | 0 |

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Next step: Run launch preflight on the prompt-repaired packet; only consider another bounded Prime smoke if the repaired packet has no blank DPO prompts and no length overflow.
