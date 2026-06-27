# Agentic V10 Failure Analysis

This report summarizes frontier tool-using agent runs over `agentic-large-corpus-research-v10-candidate`.

## Status

- Buyer-grade status: missing_frontier_runs
- Eligible frontier-agent runs: 1
- Runs analyzed: 1
- Task scores analyzed: 200

## Run Summary

| Run | Surface | Model | Version | Answer membership | Evidence recall |
| --- | --- | --- | --- | ---: | ---: |
| codex-cli-gpt-5-5-v10-full | Codex CLI | gpt-5.5 | gpt-5.5 via codex exec v0.142.2 | 42.5% | 72.8% |

## Aggregate Category Failures

| Category | Answer membership | Evidence recall | Citation precision | Evidence-answer gap |
| --- | ---: | ---: | ---: | ---: |
| table + text reasoning | 0% | 100% | 100% | 100% |
| multi-hop synthesis | 0% | 97.5% | 97.5% | 97.5% |
| cross-document contradiction | 0% | 97.5% | 97.5% | 97.5% |
| temporal questions: as of date X | 30% | 47.5% | 95% | 17.5% |
| stale-vs-current document conflicts | 40% | 50% | 100% | 10% |
| source authority conflicts | 45% | 50% | 100% | 5% |
| appended document lifecycle changes | 50% | 50% | 100% | 0% |
| entity disambiguation | 60% | 95% | 95% | 35% |
| evidence insufficiency / abstention | 100% | 100% | 100% | 0% |
| citation supports fact but not conclusion | 100% | 40% | 80% | -60% |

## Examples

### codex-cli-gpt-5-5-v10-full

- hgr_v10_candidate_181_cross-document-contradiction_51feab (cross-document contradiction): expected ["Garth Brooks <> modeled the relationship between word count and the two metrics of user engagement (overall rating, mean number of turns) in separate linear regressions"]; submitted "No Fences is the second studio album by the American country music artist Garth Brooks. <> We assessed the degree of conversational depth by measuring users' mean word count."; evidence recall 100%.
- hgr_v10_candidate_183_cross-document-contradiction_2c652d (cross-document contradiction): expected ["dancer Gregory Hines <> perform experiments to utilize ASR $n$-best hypotheses during evaluation"]; submitted "He is the brother of dancer Gregory Hines. <> The models evaluating with $n$-bests and a BM (pre-trained on transcription) are called Direct Models (in Fig."; evidence recall 100%.
- hgr_v10_candidate_184_cross-document-contradiction_d59576 (cross-document contradiction): expected ["CEO of Lionsgate UK & Europe <> if there is an error in the graph, the triple is likely to be inconsistent with its neighborhood, and thus the model should put least trust on this triple. In other words, the error triple should have the least influence on the model's prediction of the training data. "]; submitted "Zygi Kamasa (born 12 November 1969) is a Swedish-British entertainment studio executive and film executive producer. <> Here, we demonstrate another potential use of adversarial modifications: finding erroneous triples in the knowledge graph."; evidence recall 100%.
- hgr_v10_candidate_185_cross-document-contradiction_e588ef (cross-document contradiction): expected ["the Sumerians <> NNC SU4 F1"]; submitted "Cuneiform script ( or or ), one of the earliest systems of writing, was invented by the Sumerians. <> Table TABREF26 shows the results for the best values of $t$ and $m$ obtained."; evidence recall 100%.
- hgr_v10_candidate_186_cross-document-contradiction_60b726 (cross-document contradiction): expected ["MedStar Washington Hospital Center <> We thus try to remove the language-specific information from the representations by centering the representations of sentences in each language so that their average lies at the origin of the vector space."]; submitted "Children’s National Medical Center (formerly DC Children’s Hospital) is ranked among the top 10 children’s hospitals in the country by "U.S. <> Following BIBREF3, we hypothesize that a sentence representation in mBERT is composed of a language-specific component, which identifies the language of the sentence, and a language-neutral component, which captures the meaning of the sentence in a language-independent way."; evidence recall 100%.
