# Agentic V9 Failure Analysis

This report summarizes frontier tool-using agent runs over `agentic-large-corpus-research-v9-candidate`.

## Status

- Buyer-grade status: missing_frontier_runs
- Eligible frontier-agent runs: 1
- Runs analyzed: 1
- Task scores analyzed: 200

## Run Summary

| Run | Surface | Model | Version | Answer membership | Evidence recall |
| --- | --- | --- | --- | ---: | ---: |
| codex-cli-gpt-5-5-v9-full | Codex CLI | gpt-5.5 | gpt-5.5 via codex exec v0.142.2 | 48% | 75% |

## Aggregate Category Failures

| Category | Answer membership | Evidence recall | Citation precision | Evidence-answer gap |
| --- | ---: | ---: | ---: | ---: |
| multi-hop synthesis | 0% | 100% | 100% | 100% |
| table + text reasoning | 0% | 100% | 100% | 100% |
| cross-document contradiction | 0% | 100% | 100% | 100% |
| temporal questions: as of date X | 40% | 50% | 100% | 10% |
| stale-vs-current document conflicts | 50% | 50% | 100% | 0% |
| source authority conflicts | 60% | 50% | 100% | -10% |
| entity disambiguation | 65% | 100% | 100% | 35% |
| appended document lifecycle changes | 65% | 50% | 100% | -15% |
| evidence insufficiency / abstention | 100% | 100% | 100% | 0% |
| citation supports fact but not conclusion | 100% | 50% | 100% | -50% |

## Examples

### codex-cli-gpt-5-5-v9-full

- hgr_v9_candidate_181_cross-document-contradiction_51feab (cross-document contradiction): expected ["Garth Brooks <> modeled the relationship between word count and the two metrics of user engagement (overall rating, mean number of turns) in separate linear regressions"]; submitted "No Fences is the second studio album by the American country music artist Garth Brooks. It was released on August 27, 1990, and reached #1 on "Billboard's" Top Country Albums chart. <> We assessed the degree of conversational depth by measuring users' mean word count. Prior work has found that an increase in word count has been linked to improved user engagement (e.g., in a social dialog system BIBREF13)."; evidence recall 100%.
- hgr_v9_candidate_182_cross-document-contradiction_620f79 (cross-document contradiction): expected ["722,664 <> all three representations are concatenated and passed into a MLP"]; submitted "James Iroha Uchechukwu is a Nigerian photographer. He was born in 1972 in Enugu. <> The BERT architecture uses 12 hidden layers, each layer consists of 768 units. To derive contextualized representations from textual features, the book title and blurb are concatenated and then fed through BERT."; evidence recall 100%.
- hgr_v9_candidate_183_cross-document-contradiction_2c652d (cross-document contradiction): expected ["dancer Gregory Hines <> perform experiments to utilize ASR $n$-best hypotheses during evaluation"]; submitted "Hot Feet is a jukebox musical featuring the music of Earth, Wind & Fire, a book by Heru Ptah and was conceived, directed, and choreographed by Maurice Hines. The musical opened on Broadway at the Foxwoods Theatre (then the Hilton Theatre) on April 30, 2006 and closed on July 23, 2006. <> Besides the Baseline and Oracle, where only ASR 1-best hypothesis is considered, we also perform experiments to utilize ASR $n$-best hypotheses during evaluation. The models evaluating with $n$-bests and a BM (pre-trained on transcription) are called Direct Models (in Fig."; evidence recall 100%.
- hgr_v9_candidate_184_cross-document-contradiction_d59576 (cross-document contradiction): expected ["CEO of Lionsgate UK & Europe <> if there is an error in the graph, the triple is likely to be inconsistent with its neighborhood, and thus the model should put least trust on this triple. In other words, the error triple should have the least influence on the model's prediction of the training data. "]; submitted "Zygi Kamasa (born 12 November 1969) is a Swedish-British entertainment studio executive and film executive producer. He currently serves as CEO of Lionsgate UK & Europe and was the Executive Producer for Brooklyn, Eddie the Eagle, Salmon Fishing in the Yemen, The Railway Man and London Has Fallen. <> Here, we demonstrate another potential use of adversarial modifications: finding erroneous triples in the knowledge graph. Intuitively, if there is an error in the graph, the triple is likely to be inconsistent with its neighborhood, and thus the model should put least trust on this triple."; evidence recall 100%.
- hgr_v9_candidate_185_cross-document-contradiction_e588ef (cross-document contradiction): expected ["the Sumerians <> NNC SU4 F1"]; submitted "Cuneiform script ( or or ), one of the earliest systems of writing, was invented by the Sumerians. It is distinguished by its wedge-shaped marks on clay tablets, made by means of a blunt reed for a stylus. <> We conducted cross-validation experiments using various values of $t$ and $m$. Table TABREF26 shows the results for the best values of $t$ and $m$ obtained."; evidence recall 100%.
