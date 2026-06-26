# Buyer Evaluation Packet

This packet is the current sellability brief for the hard-grounded agentic benchmark.

## Bottom Line

- Buyer ready: false
- Suite: agentic-large-corpus-research-v3
- Tasks: 200
- Categories: 10
- Corpus documents per task: 1000
- Scoring: deterministic, constant-time after submission, no LLM judge required
- Fresh frontier-agent runs: 2/2
- Unique native questions: 12/150

This is a diagnostic expanded benchmark artifact, but not yet a sellable frontier-lab benchmark. The largest current blocker is source-question diversity: the v3 suite repeats a small set of underlying questions across many generated tasks.

## What It Tests

The suite targets multi-hop synthesis, stale/current conflicts, appended lifecycle updates, table-text reasoning, authority conflicts, evidence insufficiency, citation-overreach, entity disambiguation, temporal-as-of questions, and cross-document contradiction.

Each task gives the agent a no-gold workspace with 1,000 documents. The agent must search, answer, cite exact document ids, reject misleading evidence, and write structured JSON.

## Novelty Position

- Novelty status: final_bounded
- Final novelty claim allowed: true
- Claim boundary: Defensible only as a unified HF-derived hard-grounded research-QA failure suite, not as first work on each individual subproblem.

## Current Empirical Evidence

The oracle smoke fixture scores the deterministic evaluator over 200 tasks. This proves scorer mechanics only; it is not an eligible model baseline.

Fresh expanded-suite frontier-agent runs are missing. Historical 10-task runs are intentionally rejected by readiness because the suite is now v3 with 200 tasks.

## Failure Analysis

Runs analyzed: 2. Aggregate answer membership: 40.5%. Aggregate evidence recall: 78.5%. See `AGENTIC_FAILURE_ANALYSIS.md`.

## V4 Candidate Status

A v4 candidate exists with 200 tasks and 200 unique native questions, but it is rejected: candidate_rejected_by_shallow_baseline. The shallow metadata baseline solves 180/200 tasks, so it cannot replace v3 until those tasks are rewritten or removed.

## Limitations

- The current v3 suite has only 12/150 required distinct native questions; it is diagnostic, not sellable.
- Some gold labels are HF-derived or deterministic transforms and need targeted audit before a paid benchmark sale.
- The current corpus uses compact document previews plus provenance hashes, not full upstream document redistribution.
- Novelty is bounded and must be sold as a combined hard-grounded research benchmark, not as a unique solution to each subproblem.

## Required Work Before Selling

- Replace repeated templates until at least 150 distinct native questions exist across 200 tasks.
- Perform live novelty and contamination review before claiming the benchmark does not already exist.
