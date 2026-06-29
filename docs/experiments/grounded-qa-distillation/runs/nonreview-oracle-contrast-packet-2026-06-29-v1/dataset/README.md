# Non-Review Oracle Contrast Packet

This packet converts four-source oracle-correct non-review candidates into post-training rows for grounded QA distillation.

- Source packet: `frontier-full-nonfinal-packet-2026-06-29-v1`
- Four-source candidates: `four-source-router-audit-2026-06-29-v1`
- Calibrated non-review overlay: `calibrated-target-packet-eval-2026-06-29-v1`
- SFT train rows: 113
- SFT validation rows: 60
- DPO train rows: 84
- DPO validation rows: 47
- Fresh eval prompts: 64

Fresh-validation rows are eval-only. Training rows come only from non-review train-tune examples; validation rows come only from non-review train-heldout examples.
