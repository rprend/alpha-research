# Agentic V4 Failure Analysis

This report summarizes frontier tool-using agent runs over `agentic-large-corpus-research-v4-candidate`.

## Status

- Buyer-grade status: frontier_runs_present
- Eligible frontier-agent runs: 2
- Runs analyzed: 2
- Task scores analyzed: 400

## Run Summary

| Run | Surface | Model | Version | Answer membership | Evidence recall |
| --- | --- | --- | --- | ---: | ---: |
| claude-code-opus-v4-full | Claude Code | opus | claude-opus-4-7 via Claude Code 2.1.118 | 100% | 80% |
| codex-cli-gpt-5-5-v4-full | Codex CLI | gpt-5.5 | gpt-5.5 via codex exec v0.142.2 | 80% | 80% |

## Aggregate Category Failures

| Category | Answer membership | Evidence recall | Citation precision | Evidence-answer gap |
| --- | ---: | ---: | ---: | ---: |
| table + text reasoning | 50% | 100% | 100% | 50% |
| appended document lifecycle changes | 50% | 50% | 100% | 0% |
| multi-hop synthesis | 100% | 100% | 100% | 0% |
| evidence insufficiency / abstention | 100% | 100% | 75% | 0% |
| citation supports fact but not conclusion | 100% | 100% | 100% | 0% |
| entity disambiguation | 100% | 100% | 100% | 0% |
| cross-document contradiction | 100% | 100% | 100% | 0% |
| stale-vs-current document conflicts | 100% | 50% | 100% | -50% |
| source authority conflicts | 100% | 50% | 100% | -50% |
| temporal questions: as of date X | 100% | 50% | 100% | -50% |

## Examples

### claude-code-opus-v4-full

- hgr_v4_candidate_041_appended-document-lifecycle-changes_51f715 (appended document lifecycle changes): expected ["Stochastic Answer Networks for SQuAD 2.0"]; submitted "Stochastic Answer Networks for SQuAD 2.0"; evidence recall 50%.
- hgr_v4_candidate_042_appended-document-lifecycle-changes_906a3f (appended document lifecycle changes): expected ["Clustering Comparable Corpora of Russian and Ukrainian Academic Texts: Word Embeddings and Semantic Fingerprints"]; submitted "Clustering Comparable Corpora of Russian and Ukrainian Academic Texts: Word Embeddings and Semantic Fingerprints"; evidence recall 50%.
- hgr_v4_candidate_043_appended-document-lifecycle-changes_23a85d (appended document lifecycle changes): expected ["How To Avoid Being Eaten By a Grue: Exploration Strategies for Text-Adventure Agents"]; submitted "How To Avoid Being Eaten By a Grue: Exploration Strategies for Text-Adventure Agents"; evidence recall 50%.
- hgr_v4_candidate_044_appended-document-lifecycle-changes_749fa2 (appended document lifecycle changes): expected ["Towards a Continuous Knowledge Learning Engine for Chatbots"]; submitted "Towards a Continuous Knowledge Learning Engine for Chatbots"; evidence recall 50%.
- hgr_v4_candidate_045_appended-document-lifecycle-changes_2226a7 (appended document lifecycle changes): expected ["Adaptive Semi-supervised Learning for Cross-domain Sentiment Classification"]; submitted "Adaptive Semi-supervised Learning for Cross-domain Sentiment Classification"; evidence recall 50%.

### codex-cli-gpt-5-5-v4-full

- hgr_v4_candidate_061_table-text-reasoning_190ceb (table + text reasoning): expected ["Thompson prevailed in the 1982 Illinois gubernatorial election by a 5,074 vote margin. @ collection-69bf12"]; submitted "Thompson prevailed in the 1982 Illinois gubernatorial election by a 5,074 vote margin. @ FeTaQA"; evidence recall 100%.
- hgr_v4_candidate_062_table-text-reasoning_3a1468 (table + text reasoning): expected ["Michael Andretti finished with a run of 214.522 mph, faster than Mario. @ collection-69bf12"]; submitted "Michael Andretti finished with a run of 214.522 mph, faster than Mario. @ FeTaQA"; evidence recall 100%.
- hgr_v4_candidate_063_table-text-reasoning_314c5a (table + text reasoning): expected ["B'z The Best \"Pleasure\" sold more than 5 million copies in 1998 alone, making it a temporary best-selling album in Japanese music history, until being surpassed by Utada Hikaru's... @ collection-69bf12"]; submitted "B'z The Best "Pleasure" sold more than 5 million copies in 1998 alone, making it a temporary best-selling album in Japanese music history, until being surpassed by Utada Hikaru's... @ FeTaQA"; evidence recall 100%.
- hgr_v4_candidate_064_table-text-reasoning_a731c8 (table + text reasoning): expected ["The Tigerair Australia fleet consists of the following aircraft and Virgin Australia announced that the entire A320 fleet will be replaced with Boeing 737-800 aircraft. @ collection-69bf12"]; submitted "The Tigerair Australia fleet consists of the following aircraft and Virgin Australia announced that the entire A320 fleet will be replaced with Boeing 737-800 aircraft. @ FeTaQA"; evidence recall 100%.
- hgr_v4_candidate_065_table-text-reasoning_de801e (table + text reasoning): expected ["In 2016 and 2017, Platt played in Dear Evan Hansen on Broadway at the Music Box Theatre. @ collection-69bf12"]; submitted "In 2016 and 2017, Platt played in Dear Evan Hansen on Broadway at the Music Box Theatre. @ FeTaQA"; evidence recall 100%.
