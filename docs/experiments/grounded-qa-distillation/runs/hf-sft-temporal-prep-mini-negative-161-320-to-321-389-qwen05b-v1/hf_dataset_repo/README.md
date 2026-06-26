---
license: cc-by-4.0
task_categories:
- text-generation
language:
- en
pretty_name: Temporal Grounded QA SFT Packet
---

# Temporal Grounded QA SFT Packet

Leakage-aware SFT packet for amortized grounded QA over evolving knowledge bases.

- Source label packet: `teacher-mini-negative-future-holdout-160-389-v1`
- Train windows: `161-240, 241-320`
- Eval window: `321-389`
- Eval-paper exclusion: `true`
- Base model target: `Qwen/Qwen2.5-0.5B-Instruct`
