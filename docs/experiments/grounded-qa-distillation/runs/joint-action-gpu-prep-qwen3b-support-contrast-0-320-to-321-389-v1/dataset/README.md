# Grounded QA Joint-Action Training Packet

This dataset supports SFT plus DPO training for amortized grounded QA over evolving paper snapshots.

- Source support packet: `support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1`
- Base model target: `Qwen/Qwen2.5-3B-Instruct`
- SFT train rows: 185
- DPO train rows: 59
- Eval prompts: 69

The DPO rows prefer either a reference-supported repair/regeneration or a justified abstention over a judged unsupported answer.
