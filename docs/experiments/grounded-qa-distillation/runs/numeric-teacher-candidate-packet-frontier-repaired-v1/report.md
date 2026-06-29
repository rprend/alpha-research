# Numeric Teacher Candidate Packet

Generated: 2026-06-29T07:53:15.243Z

Status: `numeric_teacher_candidate_packet_ready_for_preflight`

This packet makes no new OpenAI calls and launches no compute. It converts already-ledgered non-final/train `gpt-4o` numeric teacher candidates into trainable SFT/DPO rows.

| Accepted numeric candidates | Added SFT train | Added SFT validation | Added DPO train | Added DPO validation | Validation errors |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 16 | 4 | 16 | 4 | 0 |

## Dataset Counts

- SFT train: 239
- SFT validation: 74
- DPO train: 239
- DPO validation: 74
- Eval prompts: 10

## Decision

- Run launch preflight next: yes
- Launch Prime now: no
- Buy OpenAI judgments now: no
- Reason: 20 non-final/train numeric teacher candidates passed deterministic contract scoring.
- Next step: Run launch preflight on the numeric teacher packet; only consider bounded Prime smoke if validation and length gates pass.
