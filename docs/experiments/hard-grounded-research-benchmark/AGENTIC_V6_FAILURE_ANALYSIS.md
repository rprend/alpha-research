# Agentic V6 Failure Analysis

This report summarizes frontier tool-using agent runs over `agentic-large-corpus-research-v6-candidate`.

## Status

- Buyer-grade status: frontier_runs_present
- Eligible frontier-agent runs: 2
- Runs analyzed: 2
- Task scores analyzed: 400

## Run Summary

| Run | Surface | Model | Version | Answer membership | Evidence recall |
| --- | --- | --- | --- | ---: | ---: |
| claude-code-opus-v6-full | Claude Code | opus | claude-opus via Claude Code 2.1.118 | 89.5% | 79.5% |
| codex-cli-gpt-5-5-v6-full | Codex CLI | gpt-5.5 | gpt-5.5 via codex exec v0.142.2 | 90% | 80% |

## Aggregate Category Failures

| Category | Answer membership | Evidence recall | Citation precision | Evidence-answer gap |
| --- | ---: | ---: | ---: | ---: |
| table + text reasoning | 0% | 100% | 100% | 100% |
| multi-hop synthesis | 97.5% | 98.8% | 100% | 1.3% |
| evidence insufficiency / abstention | 100% | 100% | 100% | 0% |
| citation supports fact but not conclusion | 100% | 100% | 97.5% | 0% |
| entity disambiguation | 100% | 100% | 100% | 0% |
| cross-document contradiction | 100% | 98.8% | 100% | -1.2% |
| stale-vs-current document conflicts | 100% | 50% | 100% | -50% |
| appended document lifecycle changes | 100% | 50% | 100% | -50% |
| source authority conflicts | 100% | 50% | 100% | -50% |
| temporal questions: as of date X | 100% | 50% | 100% | -50% |

## Examples

### claude-code-opus-v6-full

- hgr_v6_candidate_061_table-text-reasoning_190ceb (table + text reasoning): expected ["Thompson prevailed in the 1982 Illinois gubernatorial election by a 5,074 vote margin. @ collection-69bf12"]; submitted "Thompson prevailed in the 1982 Illinois gubernatorial election by a 5,074 vote margin. @ DongfuJiang/FeTaQA"; evidence recall 100%.
- hgr_v6_candidate_062_table-text-reasoning_3a1468 (table + text reasoning): expected ["Michael Andretti finished with a run of 214.522 mph, faster than Mario. @ collection-69bf12"]; submitted "Michael Andretti finished with a run of 214.522 mph, faster than Mario. @ DongfuJiang/FeTaQA"; evidence recall 100%.
- hgr_v6_candidate_063_table-text-reasoning_314c5a (table + text reasoning): expected ["B'z The Best \"Pleasure\" sold more than 5 million copies in 1998 alone, making it a temporary best-selling album in Japanese music history, until being surpassed by Utada Hikaru's... @ collection-69bf12"]; submitted "B'z The Best "Pleasure" sold more than 5 million copies in 1998 alone, making it a temporary best-selling album in Japanese music history, until being surpassed by Utada Hikaru's... @ DongfuJiang/FeTaQA"; evidence recall 100%.
- hgr_v6_candidate_064_table-text-reasoning_a731c8 (table + text reasoning): expected ["The Tigerair Australia fleet consists of the following aircraft and Virgin Australia announced that the entire A320 fleet will be replaced with Boeing 737-800 aircraft. @ collection-69bf12"]; submitted "The Tigerair Australia fleet consists of the following aircraft and Virgin Australia announced that the entire A320 fleet will be replaced with Boeing 737-800 aircraft. @ DongfuJiang/FeTaQA"; evidence recall 100%.
- hgr_v6_candidate_065_table-text-reasoning_de801e (table + text reasoning): expected ["In 2016 and 2017, Platt played in Dear Evan Hansen on Broadway at the Music Box Theatre. @ collection-69bf12"]; submitted "In 2016 and 2017, Platt played in Dear Evan Hansen on Broadway at the Music Box Theatre. @ DongfuJiang/FeTaQA"; evidence recall 100%.

### codex-cli-gpt-5-5-v6-full

- hgr_v6_candidate_061_table-text-reasoning_190ceb (table + text reasoning): expected ["Thompson prevailed in the 1982 Illinois gubernatorial election by a 5,074 vote margin. @ collection-69bf12"]; submitted "Thompson prevailed in the 1982 Illinois gubernatorial election by a 5,074 vote margin. @ DongfuJiang/FeTaQA"; evidence recall 100%.
- hgr_v6_candidate_062_table-text-reasoning_3a1468 (table + text reasoning): expected ["Michael Andretti finished with a run of 214.522 mph, faster than Mario. @ collection-69bf12"]; submitted "Michael Andretti finished with a run of 214.522 mph, faster than Mario. @ DongfuJiang/FeTaQA"; evidence recall 100%.
- hgr_v6_candidate_063_table-text-reasoning_314c5a (table + text reasoning): expected ["B'z The Best \"Pleasure\" sold more than 5 million copies in 1998 alone, making it a temporary best-selling album in Japanese music history, until being surpassed by Utada Hikaru's... @ collection-69bf12"]; submitted "B'z The Best "Pleasure" sold more than 5 million copies in 1998 alone, making it a temporary best-selling album in Japanese music history, until being surpassed by Utada Hikaru's... @ DongfuJiang/FeTaQA"; evidence recall 100%.
- hgr_v6_candidate_064_table-text-reasoning_a731c8 (table + text reasoning): expected ["The Tigerair Australia fleet consists of the following aircraft and Virgin Australia announced that the entire A320 fleet will be replaced with Boeing 737-800 aircraft. @ collection-69bf12"]; submitted "The Tigerair Australia fleet consists of the following aircraft and Virgin Australia announced that the entire A320 fleet will be replaced with Boeing 737-800 aircraft. @ DongfuJiang/FeTaQA"; evidence recall 100%.
- hgr_v6_candidate_065_table-text-reasoning_de801e (table + text reasoning): expected ["In 2016 and 2017, Platt played in Dear Evan Hansen on Broadway at the Music Box Theatre. @ collection-69bf12"]; submitted "In 2016 and 2017, Platt played in Dear Evan Hansen on Broadway at the Music Box Theatre. @ DongfuJiang/FeTaQA"; evidence recall 100%.
