# Buyer Evaluation Packet

This packet is the current sellability brief for the hard-grounded agentic benchmark.

## Bottom Line

- Buyer ready: false
- Suite: agentic-large-corpus-research-v3
- Tasks: 200
- Categories: 10
- Corpus documents per task: 1000
- Scoring: deterministic, constant-time after submission, no LLM judge required
- Fresh frontier-agent runs: 0/2

This is now a serious expanded benchmark artifact, but not yet a sellable frontier-lab benchmark because fresh 200-task Codex CLI and Claude Code runs have not been collected.

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

## Limitations

- Fresh Codex CLI and Claude Code runs over all 200 v3 workspaces have not been collected yet.
- Some gold labels are HF-derived or deterministic transforms and need targeted audit before a paid benchmark sale.
- The current corpus uses compact document previews plus provenance hashes, not full upstream document redistribution.
- Novelty is bounded and must be sold as a combined hard-grounded research benchmark, not as a unique solution to each subproblem.

## Required Work Before Selling

- Run Codex CLI with the strongest available accepted model over all 200 no-gold workspaces.
- Run Claude Code with the strongest available accepted model over all 200 no-gold workspaces.
- Produce per-category failure analysis from fresh expanded-suite runs.
- Perform live novelty and contamination review before claiming the benchmark does not already exist.
