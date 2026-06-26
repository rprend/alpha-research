# Agentic Workspaces

These are no-gold workspaces for real tool-using agent runs. Give an agent one workspace directory at a time, or the full `generated/agentic-workspaces` directory, but do not include `generated/agentic-hidden-gold.json`.

## Files

- `task.json`: public task metadata and corpus pointer.
- `corpus.json`: searchable evidence documents with exact `document_id` values.
- `README.md`: natural-language task prompt.
- `answer.schema.json`: required answer shape.
- `answer.json`: file the agent must create during a run.

## Hidden Gold

`generated/agentic-hidden-gold.json` is for deterministic scoring only and must be withheld from agents.

## Workspaces

| Task | Category | Workspace | Corpus docs | Source items |
| --- | --- | --- | ---: | ---: |
| hgr_agentic_01_multi-hop-synthesis | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_01_multi-hop-synthesis | 301 | 98
| hgr_agentic_02_stale-vs-current-document-conflicts | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_02_stale-vs-current-document-conflicts | 271 | 98
| hgr_agentic_03_appended-document-lifecycle-changes | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_03_appended-document-lifecycle-changes | 340 | 98
| hgr_agentic_04_table-text-reasoning | table + text reasoning | generated/agentic-workspaces/hgr_agentic_04_table-text-reasoning | 340 | 98
| hgr_agentic_05_source-authority-conflicts | source authority conflicts | generated/agentic-workspaces/hgr_agentic_05_source-authority-conflicts | 340 | 98
| hgr_agentic_06_evidence-insufficiency-abstention | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_06_evidence-insufficiency-abstention | 340 | 98
| hgr_agentic_07_citation-supports-fact-but-not-conclusion | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_07_citation-supports-fact-but-not-conclusion | 332 | 98
| hgr_agentic_08_entity-disambiguation | entity disambiguation | generated/agentic-workspaces/hgr_agentic_08_entity-disambiguation | 335 | 98
| hgr_agentic_09_temporal-questions-as-of-date-x | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_09_temporal-questions-as-of-date-x | 334 | 98
| hgr_agentic_10_cross-document-contradiction | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_10_cross-document-contradiction | 332 | 98 |
