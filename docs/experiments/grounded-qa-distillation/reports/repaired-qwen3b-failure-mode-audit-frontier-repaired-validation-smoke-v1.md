# Repaired Qwen3B Failure-Mode Audit

Generated: 2026-06-29T02:56:58.829Z

Status: `failure_mode_audit_blocks_model_escalation_until_schema_and_answerability_are_fixed`

## Summary

- Source contract correctness: 6/70 (8.6%)
- Repaired contract correctness: 35/70 (50.0%)
- Train-calibrated scaffold baseline: 44/70 (62.9%)
- Answerability skew: `over_answering`
- Invalid raw JSON rows: 16
- Malformed citation rows: 28
- Grounded answers missing inline [E#] citations: 44

## Decision

- Buy OpenAI judgments now: no
- Launch larger model now: no
- Launch more Qwen3B training now: no
- Next intervention: Build a constrained runner/scaffold that enforces JSON schema, normalizes evidence ids, and calibrates answerability against the repaired train split before any larger-model Prime run.

## Rationale

- The raw Qwen3B output fails schema/citation binding: invalid JSON, malformed citations, and missing inline [E#] citations are common.
- Post-hoc deterministic repair fixes most syntax but reaches only 35/70 contract correctness, below the 44/70 zero-spend train-calibrated scaffold.
- The dominant answerability error is over-answering: 26 false grounded answers versus 10 false abstentions before repair.
- Because deterministic repair changes the failure substantially, a larger model would confound capacity with schema/decoding and answerability policy.
