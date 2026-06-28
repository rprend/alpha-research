# Answer-Completion Repair Curriculum Packet

This packet targets the D215/D216 Qwen 7B failure mode: short, underspecified, or counterfactual answers and missing supported candidates.

- Train window: `0-240`
- Validation window: `240-320`
- Eval window: `321-389`
- SFT train rows: 240
- DPO train rows: 546
- Answer-completion DPO negatives: 157
- Final oracle-gap eval targets: 13
- OpenAI calls: 0
- External compute cost: $0.00

Final eval labels are not used for training.
