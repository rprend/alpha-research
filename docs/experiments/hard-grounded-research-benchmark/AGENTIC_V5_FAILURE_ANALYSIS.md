# Agentic V5 Failure Analysis

This report summarizes frontier tool-using agent runs over `agentic-large-corpus-research-v5-candidate`.

## Status

- Buyer-grade status: missing_frontier_runs
- Eligible frontier-agent runs: 1
- Runs analyzed: 1
- Task scores analyzed: 200

## Run Summary

| Run | Surface | Model | Version | Answer membership | Evidence recall |
| --- | --- | --- | --- | ---: | ---: |
| codex-cli-gpt-5-5-v5-full | Codex CLI | gpt-5.5 | gpt-5.5 via codex exec v0.142.2 | 99.5% | 79.8% |

## Aggregate Category Failures

| Category | Answer membership | Evidence recall | Citation precision | Evidence-answer gap |
| --- | ---: | ---: | ---: | ---: |
| multi-hop synthesis | 95% | 97.5% | 100% | 2.5% |
| table + text reasoning | 100% | 100% | 100% | 0% |
| evidence insufficiency / abstention | 100% | 100% | 100% | 0% |
| citation supports fact but not conclusion | 100% | 100% | 100% | 0% |
| entity disambiguation | 100% | 100% | 100% | 0% |
| cross-document contradiction | 100% | 100% | 100% | 0% |
| stale-vs-current document conflicts | 100% | 50% | 100% | -50% |
| appended document lifecycle changes | 100% | 50% | 100% | -50% |
| source authority conflicts | 100% | 50% | 100% | -50% |
| temporal questions: as of date X | 100% | 50% | 100% | -50% |

## Examples

### codex-cli-gpt-5-5-v5-full

- hgr_v5_candidate_016_multi-hop-synthesis_cfcf69 (multi-hop synthesis): expected ["Greenwich Village, New York City => Extreme Language Model Compression with Optimal Subwords and Shared Projections"]; submitted "Greenwich Village, New York City => Greenwich Village, New York City"; evidence recall 50%.
- hgr_v5_candidate_041_appended-document-lifecycle-changes_51f715 (appended document lifecycle changes): expected ["Stochastic Answer Networks for SQuAD 2.0"]; submitted "Stochastic Answer Networks for SQuAD 2.0"; evidence recall 50%.
- hgr_v5_candidate_042_appended-document-lifecycle-changes_906a3f (appended document lifecycle changes): expected ["Clustering Comparable Corpora of Russian and Ukrainian Academic Texts: Word Embeddings and Semantic Fingerprints"]; submitted "Clustering Comparable Corpora of Russian and Ukrainian Academic Texts: Word Embeddings and Semantic Fingerprints"; evidence recall 50%.
- hgr_v5_candidate_043_appended-document-lifecycle-changes_23a85d (appended document lifecycle changes): expected ["How To Avoid Being Eaten By a Grue: Exploration Strategies for Text-Adventure Agents"]; submitted "How To Avoid Being Eaten By a Grue: Exploration Strategies for Text-Adventure Agents"; evidence recall 50%.
- hgr_v5_candidate_044_appended-document-lifecycle-changes_749fa2 (appended document lifecycle changes): expected ["Towards a Continuous Knowledge Learning Engine for Chatbots"]; submitted "Towards a Continuous Knowledge Learning Engine for Chatbots"; evidence recall 50%.
