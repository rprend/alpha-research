# Qwen 3B Failure-Driven Curriculum Packet

Source packet: `joint-action-gpu-prep-qwen3b-failure-driven-curriculum-v3`

Failure audit: `support-failure-analysis-qwen7b-v5-coverage-smoke-citation-repair-2026-06-27-v1`

This packet keeps the same final eval prompts and does not train on final-window labels. It hardens the instruction contract and adds synthetic DPO hard negatives from train/validation rows.

## Added Pressure

- Synthetic DPO train rows added: 553
- No-citation answer hard negatives: 208
- Spurious insufficient-evidence answer hard negatives: 36

## Failure Signal

```json
{
  "counterfactual_answered": 10,
  "unsupported_task_or_experiment": 12,
  "missing_direct_evidence": 10,
  "unsupported_comparison_or_baseline": 6,
  "unsupported_context_or_annotation": 6,
  "other_unsupported_claim": 1,
  "invalid_citation_id": 2,
  "partial_support": 4
}
```

## Support-Aware v4 Additions

- Support-aware DPO train rows added: 244
- Support-aware DPO validation rows added: 59
- Train overclaim hard negatives: 208
- Train insufficient-evidence hard negatives: 36

## Coverage-Aware v5 Additions

- Coverage-aware DPO train rows added: 0
- Coverage-aware DPO validation rows added: 0
- Train answer-over-abstain preferences: 0

## Answerability-Gated Coverage v6 Additions

- Gated coverage DPO train rows added: 65
- Gated coverage DPO validation rows added: 19
- Train gated answer-over-abstain preferences: 65
- Train answerable rows rejected by sufficiency gate: 143
