# Versioned Private/Domain KB Prototype

Generated: 2026-06-26T21:48:16.462Z

Status: `versioned_domain_kb_candidate_ready`

## Snapshot Pair

| Snapshot | Commit | Date |
| --- | --- | --- |
| train | `818a916fdf2c` | 2026-04-27T15:47:18-07:00 |
| eval | `4326a12aff20` | 2026-06-26T17:45:12-04:00 |

## Examples

| Type | Count |
| --- | ---: |
| stable_grounded_answer | 6 |
| eval_update_grounded_answer | 12 |
| stale_snapshot_abstention | 12 |

Candidate examples: `docs/experiments/grounded-qa-distillation/runs/versioned-private-kb-prototype-git-docs-2026-06-26-v1/candidate_examples.jsonl`

## Claim Boundary

- Supports versioned domain-KB extension: yes
- Supports private enterprise-KB proof: no
- Reason: The source is repository-local product/architecture documentation with immutable git commits, not a confidential enterprise corpus with access-control semantics.

## Value

- Uses immutable train/eval KB snapshots from git history rather than inferred paper dates.
- Includes stale-snapshot abstention cases where eval-only evidence is intentionally absent from the train snapshot.
- Preserves citation ids down to document path, commit, and line number.
- Keeps the private-enterprise claim blocked until access control, confidentiality, and allowed redistribution are established.

## Limitations

- Generated questions are deterministic line-level probes, not natural user research questions.
- Repository docs are an enterprise-like domain KB proxy, not proof over a customer's private KB.
- A paper-grade private-KB result would need natural queries or human/LLM-authored questions over a licensed versioned corpus.

This prototype makes no OpenAI calls, launches no GPU jobs, and records no spend.
