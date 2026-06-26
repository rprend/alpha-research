# Agentic Hard Grounded Research Suite

This suite is the frontier-lab-grade pivot from packet QA to agentic large-corpus research. It wraps the HF-derived scale suite into 200 no-gold corpus-search tasks intended for frontier tool-using agents such as Codex CLI, Claude Code, or equivalent systems using the strongest available model at run time.

## What Changed

- The system under test must search 1000 documents per task instead of receiving only the evidence packet.
- Each task contains answer-bearing documents plus deterministic HF/public-corpus distractors.
- The answer is not enough; the agent must cite exact evidence ids and reject misleading evidence.
- Primary scoring is deterministic after submission. An LLM judge is not required for the main score.
- Previous 10-task Codex/Claude runs are historical and do not satisfy this v3 suite.

## Readiness

- Suite materialized: true
- Tasks: 200
- Source scale items: 300
- Categories: 10
- Corpus documents per task: 1000
- Frontier agent runs present: see `AGENTIC_READINESS.md`
- Completion claim allowed: see `AGENTIC_READINESS.md`

## Task Table Preview

The generated JSON contains all 200 tasks. The table below shows the first 40.

| Task | Category | Corpus docs | Required evidence ids | Expected answers | Distractor docs |
| --- | --- | ---: | ---: | --- | ---: |
| hgr_agentic_001_multi-hop-synthesis_338bb9 | multi-hop synthesis | 1000 | 2 | Chief of Protocol | 998
| hgr_agentic_002_stale-vs-current-document-conflicts_ef94b3 | stale-vs-current document conflicts | 1000 | 1 | SUPPORTS | 999
| hgr_agentic_003_appended-document-lifecycle-changes_915c34 | appended document lifecycle changes | 1000 | 2 | BIBREF19 | 998
| hgr_agentic_004_table-text-reasoning_91498f | table + text reasoning | 1000 | 2 | 400 m; Medley relay | 998
| hgr_agentic_005_source-authority-conflicts_460f6b | source authority conflicts | 1000 | 1 | SUPPORTS | 999
| hgr_agentic_006_evidence-insufficiency-abstention_0c5ede | evidence insufficiency / abstention | 1000 | 0 | ABSTAIN | 999
| hgr_agentic_007_citation-supports-fact-but-not-conclusion_bdcc4e | citation supports fact but not conclusion | 1000 | 0 | ABSTAIN | 999
| hgr_agentic_008_entity-disambiguation_a4a101 | entity disambiguation | 1000 | 2 | Chief of Protocol | 998
| hgr_agentic_009_temporal-questions-as-of-date-x_4d20d7 | temporal questions: as of date X | 1000 | 1 | SUPPORTS | 999
| hgr_agentic_010_cross-document-contradiction_345aec | cross-document contradiction | 1000 | 3 | CONFLICT | 997
| hgr_agentic_011_multi-hop-synthesis_348bbb | multi-hop synthesis | 1000 | 2 | Animorphs | 998
| hgr_agentic_012_stale-vs-current-document-conflicts_f094b5 | stale-vs-current document conflicts | 1000 | 1 | SUPPORTS | 999
| hgr_agentic_013_appended-document-lifecycle-changes_945c38 | appended document lifecycle changes | 1000 | 2 | Stanford NER | 998
| hgr_agentic_014_table-text-reasoning_444046 | table + text reasoning | 1000 | 2 | 400 m; Medley relay | 998
| hgr_agentic_015_source-authority-conflicts_450f6a | source authority conflicts | 1000 | 1 | SUPPORTS | 999
| hgr_agentic_016_evidence-insufficiency-abstention_0f5ee3 | evidence insufficiency / abstention | 1000 | 0 | ABSTAIN | 999
| hgr_agentic_017_citation-supports-fact-but-not-conclusion_bacc4a | citation supports fact but not conclusion | 1000 | 0 | ABSTAIN | 999
| hgr_agentic_018_entity-disambiguation_a3a100 | entity disambiguation | 1000 | 2 | Animorphs | 998
| hgr_agentic_019_temporal-questions-as-of-date-x_4e20d9 | temporal questions: as of date X | 1000 | 1 | SUPPORTS | 999
| hgr_agentic_020_cross-document-contradiction_315ae7 | cross-document contradiction | 1000 | 3 | CONFLICT | 997
| hgr_agentic_021_multi-hop-synthesis_75f99a | multi-hop synthesis | 1000 | 2 | Chief of Protocol | 998
| hgr_agentic_022_stale-vs-current-document-conflicts_f194b6 | stale-vs-current document conflicts | 1000 | 1 | REFUTES | 999
| hgr_agentic_023_appended-document-lifecycle-changes_935c37 | appended document lifecycle changes | 1000 | 2 | politics, business, science, and AskReddit, and 1000 additional posts from the Reddit frontpage. | 998
| hgr_agentic_024_table-text-reasoning_414041 | table + text reasoning | 1000 | 2 | 400 m; Medley relay | 998
| hgr_agentic_025_source-authority-conflicts_440f68 | source authority conflicts | 1000 | 1 | REFUTES | 999
| hgr_agentic_026_evidence-insufficiency-abstention_0e5ee2 | evidence insufficiency / abstention | 1000 | 0 | ABSTAIN | 999
| hgr_agentic_027_citation-supports-fact-but-not-conclusion_bbcc4b | citation supports fact but not conclusion | 1000 | 0 | ABSTAIN | 999
| hgr_agentic_028_entity-disambiguation_100c96 | entity disambiguation | 1000 | 2 | Chief of Protocol | 998
| hgr_agentic_029_temporal-questions-as-of-date-x_4f20db | temporal questions: as of date X | 1000 | 1 | REFUTES | 999
| hgr_agentic_030_cross-document-contradiction_325ae9 | cross-document contradiction | 1000 | 3 | CONFLICT | 997
| hgr_agentic_031_multi-hop-synthesis_74f999 | multi-hop synthesis | 1000 | 2 | Animorphs | 998
| hgr_agentic_032_stale-vs-current-document-conflicts_8c28ee | stale-vs-current document conflicts | 1000 | 2 | SUPPORTS | 998
| hgr_agentic_033_appended-document-lifecycle-changes_99ac09 | appended document lifecycle changes | 1000 | 2 | BIBREF19 | 998
| hgr_agentic_034_table-text-reasoning_4e4055 | table + text reasoning | 1000 | 2 | 400 m; Medley relay | 998
| hgr_agentic_035_source-authority-conflicts_30a8e6 | source authority conflicts | 1000 | 2 | SUPPORTS | 998
| hgr_agentic_036_evidence-insufficiency-abstention_a2ca1a | evidence insufficiency / abstention | 1000 | 0 | ABSTAIN | 999
| hgr_agentic_037_citation-supports-fact-but-not-conclusion_227543 | citation supports fact but not conclusion | 1000 | 0 | ABSTAIN | 999
| hgr_agentic_038_entity-disambiguation_110c97 | entity disambiguation | 1000 | 2 | Animorphs | 998
| hgr_agentic_039_temporal-questions-as-of-date-x_fc8189 | temporal questions: as of date X | 1000 | 2 | SUPPORTS | 998
| hgr_agentic_040_cross-document-contradiction_b1a754 | cross-document contradiction | 1000 | 3 | CONFLICT | 997 |

## Required Agent Run

An eligible run must execute a real tool-using agent over the no-gold workspaces generated from these corpus shards. Use `generated/agentic-workspaces/` for agent input and withhold `generated/agentic-hidden-gold.json`. The run manifest must name the agent surface, model, model version, date, frontier-model attestation, tools enabled, command transcript path, and whether the agent had access to hidden gold. Runs over preselected evidence packets or single chat completions are diagnostic only.
