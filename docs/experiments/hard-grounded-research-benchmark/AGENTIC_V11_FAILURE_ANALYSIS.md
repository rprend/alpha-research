# Agentic V11 Failure Analysis

This report summarizes frontier tool-using agent runs over `agentic-large-corpus-research-v11-candidate`.

## Status

- Buyer-grade status: frontier_runs_present
- Eligible frontier-agent runs: 2
- Runs analyzed: 2
- Task scores analyzed: 400

## Run Summary

| Run | Surface | Model | Version | Answer membership | Evidence recall |
| --- | --- | --- | --- | ---: | ---: |
| claude-code-opus-v11-minimal | Claude Code | opus | claude-opus-4-7 via Claude Code 2.1.118 minimal script run | 0% | 0% |
| codex-cli-gpt-5-5-v11-clean | Codex CLI | gpt-5.5 | gpt-5.5 via codex exec v0.142.2 clean no-local-llm run | 7.5% | 38.3% |

## Aggregate Category Failures

| Category | Answer membership | Evidence recall | Citation precision | Evidence-answer gap |
| --- | ---: | ---: | ---: | ---: |
| table + text reasoning | 0% | 47.5% | 47.5% | 47.5% |
| cross-document contradiction | 0% | 25% | 25% | 25% |
| appended document lifecycle changes | 0% | 16.3% | 32.5% | 16.3% |
| multi-hop synthesis | 0% | 15% | 15% | 15% |
| stale-vs-current document conflicts | 0% | 6.3% | 12.5% | 6.3% |
| citation supports fact but not conclusion | 0% | 5% | 10% | 5% |
| evidence insufficiency / abstention | 2.5% | 10% | 6.3% | 7.5% |
| entity disambiguation | 5% | 17.5% | 17.5% | 12.5% |
| source authority conflicts | 7.5% | 25% | 50% | 17.5% |
| temporal questions: as of date X | 22.5% | 23.8% | 47.5% | 1.3% |

## Examples

### claude-code-opus-v11-minimal

- hgr_v11_candidate_041_appended-document-lifecycle-changes_195915 (appended document lifecycle changes): expected ["crowd-sourced the collection of the dataset on Amazon Mechanical Turk (MTurk)"]; submitted "Between the evidence for "What is the size of this dataset?" and "How was the dataset collected?", use the later appended material and answer its question.". Between the evidence for "What is the size of this dataset?" and "How was the dataset collected?", use the later appended material and answer its question.". Between the evidence for "What is the size of this dataset?" and "How was the dataset collected?", use the later appended material and answer its question."."; evidence recall 0%.
- hgr_v11_candidate_042_appended-document-lifecycle-changes_5049d9 (appended document lifecycle changes): expected ["Quora duplicate question dataset BIBREF22"]; submitted "Between the evidence for "Fast Cars, Danger, Fire and Knives includes guest appearances from which hip hop record executive?" and "What existing corpus is used for comparison in these experiments?", use the later appended material and answ… Between the evidence for "Fast Cars, Danger, Fire and Knives includes guest appearances from which hip hop record executive?" and "What existing corpus is used for comparison in these experiments?", use the later appended material and answ… Between the evidence for "Fast Cars, Danger, Fire and Knives includes guest appearances from which hip hop record exe…"; evidence recall 0%.
- hgr_v11_candidate_043_appended-document-lifecycle-changes_3499e4 (appended document lifecycle changes): expected ["True, Likely (i.e. Answerable), or Unsure (i.e. Unanswerable)"]; submitted "Between the evidence for "Which actress played the part of fictitious character Kimberly Ann Hart, in the franchise built around a live action superhero television series taking much of its footage from the Japanese tokusatsu 'Super Sentai… Between the evidence for "Which actress played the part of fictitious character Kimberly Ann Hart, in the franchise built around a live action superhero television series taking much of its footage from the Japanese tokusatsu 'Super Sentai… Between the evidence for "Which actress played the part of fictitious character Kimberly Ann Hart, in the franchise b…"; evidence recall 0%.
- hgr_v11_candidate_044_appended-document-lifecycle-changes_64c468 (appended document lifecycle changes): expected [" peoples' sentiments expressed over social media"]; submitted "Between the evidence for "What does the Hacker-Pschorr Brewery have to limit in order to comply with German regulations?" and "Who is the crowd in these experiments?", use the later appended material and answer its question.". Between the evidence for "What does the Hacker-Pschorr Brewery have to limit in order to comply with German regulations?" and "Who is the crowd in these experiments?", use the later appended material and answer its question.". Between the evidence for "What does the Hacker-Pschorr Brewery have to limit in order to comply with German regulations?" and "Who is the crowd i…"; evidence recall 0%.
- hgr_v11_candidate_045_appended-document-lifecycle-changes_cfdee4 (appended document lifecycle changes): expected ["TransE, TransR and TransH"]; submitted "Between the evidence for "Iqaluit Airport and Canadian North are based out of what country?" and "What seven state-of-the-art methods are used for comparison?", use the later appended material and answer its question.". Between the evidence for "Iqaluit Airport and Canadian North are based out of what country?" and "What seven state-of-the-art methods are used for comparison?", use the later appended material and answer its question.". Between the evidence for "Iqaluit Airport and Canadian North are based out of what country?" and "What seven state-of-the-art methods are used for comparison?"…"; evidence recall 0%.

### codex-cli-gpt-5-5-v11-clean

- hgr_v11_candidate_185_cross-document-contradiction_999818 (cross-document contradiction): expected ["Emrich \"Imi\" Lichtenfeld <> R Adams Cowley"]; submitted "CONTRADICTION: Krav Maga ( ; Hebrew: קְרַב מַגָּע‎ ] , "lit." "contact-combat") is a military self-defense system developed for the Israel Defense Forces (IDF) and Israeli security forces (Shin Bet and Mossad) that consists of a combination of techniques sourced from Boxing, Wrestling, Aikido, Judo, Karate along with realistic fight training. || He is also known for being one of the first surgeons to perform open-heart surgery and invented both a surgical clamp that bears his name and a prototype pacemaker that was used by Dwight D."; evidence recall 100%.
- hgr_v11_candidate_154_entity-disambiguation_6e2f80 (entity disambiguation): expected ["alcohol"]; submitted "The crystal structure of cadmium chloride (described below), composed of two-dimensional layers of ions, is a reference for describing other crystal structures."; evidence recall 100%.
- hgr_v11_candidate_155_entity-disambiguation_7aac4f (entity disambiguation): expected ["6.213 km long"]; submitted "The 2013 Liqui Moly Bathurst 12 Hour was an endurance race for a variety of GT and touring car classes, including: GT3 cars, GT4 cars, Group 3E Series Production Cars and Dubai 24 Hour cars."; evidence recall 100%.
- hgr_v11_candidate_157_entity-disambiguation_9a68a8 (entity disambiguation): expected ["Kelli Ward"]; submitted "Sue Donahue is an American politician. Donahue did not run for re-election in 2016 and was replaced by Sonny Borrelli."; evidence recall 100%.
- hgr_v11_candidate_158_entity-disambiguation_65520c (entity disambiguation): expected ["Todd Phillips"]; submitted "The Quality Cafe (also known as Quality Diner) is a now-defunct diner at 1236 West 7th Street in Los Angeles, California."; evidence recall 100%.
