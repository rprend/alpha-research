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

This is a diagnostic expanded benchmark artifact, but not yet a sellable frontier-lab benchmark. The latest candidate is v6 with status `candidate_rejected_by_frontier_baseline`.

## What It Tests

The suite targets multi-hop synthesis, stale/current conflicts, appended lifecycle updates, table-text reasoning, authority conflicts, evidence insufficiency, citation-overreach, entity disambiguation, temporal-as-of questions, and cross-document contradiction.

Each task gives the agent a no-gold workspace with 1,000 documents. The agent must search, answer, cite exact document ids, reject misleading evidence, and write structured JSON.

## Novelty Position

- Novelty status: final_bounded
- Final novelty claim allowed: true
- Claim boundary: Defensible only as a unified HF-derived hard-grounded research-QA failure suite, not as first work on each individual subproblem.

## Current Empirical Evidence

The oracle smoke fixture scores the deterministic evaluator over 200 tasks. This proves scorer mechanics only; it is not an eligible model baseline.

Latest candidate frontier-agent runs: 2/2. Frontier difficulty gate passed: false.

## Failure Analysis

Runs analyzed: 2. Aggregate answer membership: 40.5%. Aggregate evidence recall: 78.5%. See `AGENTIC_FAILURE_ANALYSIS.md`.

## Candidate Attempt Status

| Candidate | Status | Tasks | Unique questions | Evidence audit failures | Eligible frontier runs | Frontier gate | Max answer membership | Max evidence recall |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| v4 | candidate_rejected_by_frontier_baseline | 200 | 200 | 0 | 2 | fail/not-run | 100% | 80% |
| v5 | candidate_rejected_by_frontier_baseline | 200 | 200 | 100 | 1 | fail/not-run | 99.5% | 79.8% |
| v6 | candidate_rejected_by_frontier_baseline | 200 | 200 | 0 | 2 | fail/not-run | 90% | 80% |

## Limitations

- The current v3 suite has only 12/150 required distinct native questions; it is diagnostic, not sellable.
- Latest candidate v6 is rejected by frontier-agent baselines: observed max answer membership 90% and evidence recall 80%.
- Some gold labels are HF-derived or deterministic transforms and need targeted audit before a paid benchmark sale.
- The current corpus uses compact document previews plus provenance hashes, not full upstream document redistribution.
- Novelty is bounded and must be sold as a combined hard-grounded research benchmark, not as a unique solution to each subproblem.

## Required Work Before Selling

- Remove remaining visible locator/rule shortcuts and regenerate tasks whose solution can be recovered by generic corpus parsing.
- Rerun Codex CLI and Claude Code after the rewrite and require frontier difficulty gate pass before buyer claims.
