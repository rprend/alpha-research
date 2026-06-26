# Agentic Hard Grounded Research Suite

This suite is the pivot from packet QA to agentic large-corpus research. It wraps the HF-derived scale suite into corpus-search tasks intended for frontier tool-using agents such as Codex CLI, Claude Code, or equivalent systems using the strongest available model at run time.

## What Changed

- The system under test must search a corpus shard instead of receiving only the evidence packet.
- Each task contains answer-bearing documents plus real HF-derived distractor documents.
- The answer is not enough; the agent must cite exact evidence ids and reject misleading evidence.
- Primary scoring is deterministic after submission. An LLM judge is not required for the main score.
- Current single-call OpenAI/Anthropic pilot runs do not satisfy this agentic goal.

## Readiness

- Suite materialized: true
- Tasks: 10
- Source scale items: 300
- Categories: 10
- Frontier agent runs present: see `AGENTIC_READINESS.md`
- Completion claim allowed: see `AGENTIC_READINESS.md`

## Task Table

| Task | Category | Corpus docs | Required evidence ids | Expected answers | Distractor items |
| --- | --- | ---: | ---: | --- | ---: |
| hgr_agentic_01_multi-hop-synthesis | multi-hop synthesis | 301 | 2 | Chief of Protocol | 97
| hgr_agentic_02_stale-vs-current-document-conflicts | stale-vs-current document conflicts | 271 | 1 | SUPPORTS | 97
| hgr_agentic_03_appended-document-lifecycle-changes | appended document lifecycle changes | 340 | 2 | BIBREF19 | 97
| hgr_agentic_04_table-text-reasoning | table + text reasoning | 340 | 2 | 400 m; Medley relay | 97
| hgr_agentic_05_source-authority-conflicts | source authority conflicts | 340 | 1 | SUPPORTS | 97
| hgr_agentic_06_evidence-insufficiency-abstention | evidence insufficiency / abstention | 340 | 0 | ABSTAIN | 97
| hgr_agentic_07_citation-supports-fact-but-not-conclusion | citation supports fact but not conclusion | 332 | 0 | ABSTAIN | 97
| hgr_agentic_08_entity-disambiguation | entity disambiguation | 335 | 2 | Chief of Protocol | 97
| hgr_agentic_09_temporal-questions-as-of-date-x | temporal questions: as of date X | 334 | 1 | SUPPORTS | 97
| hgr_agentic_10_cross-document-contradiction | cross-document contradiction | 332 | 3 | CONFLICT | 97 |

## Required Agent Run

An eligible run must execute a real tool-using agent over the no-gold workspaces generated from these corpus shards. Use `generated/agentic-workspaces/` for agent input and withhold `generated/agentic-hidden-gold.json`. The run manifest must name the agent surface, model, model version, date, frontier-model attestation, tools enabled, command transcript path, and whether the agent had access to hidden gold. Runs over preselected evidence packets or single chat completions are diagnostic only.
