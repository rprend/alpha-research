# Agentic Failure Analysis

This report summarizes frontier tool-using agent runs over `agentic-large-corpus-research-v3`.

## Status

- Buyer-grade status: diagnostic_only_not_buyer_ready
- Eligible frontier-agent runs: 2
- Runs analyzed: 2
- Task scores analyzed: 400

## Structural Blockers

- Only 12/150 required distinct native questions are present.
- The most reused native question appears 28 times.

## Run Summary

| Run | Surface | Model | Version | Answer membership | Evidence recall |
| --- | --- | --- | --- | ---: | ---: |
| claude-code-opus-v3-full | Claude Code | opus | claude-opus-4-7 via Claude Code 2.1.118 | 43.5% | 75.6% |
| codex-cli-gpt-5-5-v3-full | Codex CLI | gpt-5.5 | gpt-5.5 via codex exec v0.142.2 | 37.5% | 81.3% |

## Aggregate Category Failures

| Category | Answer membership | Evidence recall | Citation precision | Evidence-answer gap |
| --- | ---: | ---: | ---: | ---: |
| stale-vs-current document conflicts | 0% | 63.8% | 100% | 63.8% |
| source authority conflicts | 0% | 63.8% | 100% | 63.8% |
| temporal questions: as of date X | 0% | 63.8% | 100% | 63.8% |
| table + text reasoning | 0% | 50% | 100% | 50% |
| multi-hop synthesis | 50% | 100% | 100% | 50% |
| entity disambiguation | 50% | 100% | 100% | 50% |
| citation supports fact but not conclusion | 52.5% | 100% | 0% | 47.5% |
| cross-document contradiction | 67.5% | 43.3% | 100% | -24.2% |
| evidence insufficiency / abstention | 85% | 100% | 0% | 15% |
| appended document lifecycle changes | 100% | 100% | 100% | 0% |

## High-Evidence Wrong-Answer Examples

### claude-code-opus-v3-full

- hgr_agentic_027_citation-supports-fact-but-not-conclusion_bbcc4b (citation supports fact but not conclusion): expected ["ABSTAIN"]; submitted "Animorphs"; evidence recall 100%.
- hgr_agentic_057_citation-supports-fact-but-not-conclusion_20753f (citation supports fact but not conclusion): expected ["ABSTAIN"]; submitted "Animorphs"; evidence recall 100%.
- hgr_agentic_087_citation-supports-fact-but-not-conclusion_237544 (citation supports fact but not conclusion): expected ["ABSTAIN"]; submitted "Animorphs"; evidence recall 100%.
- hgr_agentic_117_citation-supports-fact-but-not-conclusion_1a7536 (citation supports fact but not conclusion): expected ["ABSTAIN"]; submitted "Animorphs"; evidence recall 100%.
- hgr_agentic_147_citation-supports-fact-but-not-conclusion_42894e (citation supports fact but not conclusion): expected ["ABSTAIN"]; submitted "Animorphs"; evidence recall 100%.

### codex-cli-gpt-5-5-v3-full

- hgr_agentic_017_citation-supports-fact-but-not-conclusion_bacc4a (citation supports fact but not conclusion): expected ["ABSTAIN"]; submitted "United States ambassador."; evidence recall 100%.
- hgr_agentic_027_citation-supports-fact-but-not-conclusion_bbcc4b (citation supports fact but not conclusion): expected ["ABSTAIN"]; submitted "Animorphs."; evidence recall 100%.
- hgr_agentic_047_citation-supports-fact-but-not-conclusion_1f753e (citation supports fact but not conclusion): expected ["ABSTAIN"]; submitted "United States ambassador."; evidence recall 100%.
- hgr_agentic_057_citation-supports-fact-but-not-conclusion_20753f (citation supports fact but not conclusion): expected ["ABSTAIN"]; submitted "Animorphs."; evidence recall 100%.
- hgr_agentic_077_citation-supports-fact-but-not-conclusion_267549 (citation supports fact but not conclusion): expected ["ABSTAIN"]; submitted "United States ambassador."; evidence recall 100%.
