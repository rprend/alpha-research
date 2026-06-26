# Hard Grounded Research Reviewer FAQ

This generated FAQ anticipates common reviewer objections and maps each answer to current artifacts. It is a reviewer-navigation artifact, not a claim that the benchmark is complete.

## Summary

- Reviewer FAQ ready: true
- Version: reviewer-faq-v1
- Questions: 6
- Active release blockers: 1
- Prohibited claims: 3
- High-severity threats: 3
- Completion claim allowed: false

## Questions

| ID | Question | Answer | Evidence |
| --- | --- | --- | --- |
| is_this_gold_ready | Is the benchmark ready for final leaderboard or category-level claims? | Not fully. Category scale is now backed by HF-derived labels, while final leaderboard and completion claims remain gated on eligible model baselines and final novelty checks. Human review is optional audit, not the primary label source. | hf-derived-label-suite-v1; 30/30 paper-eligible derived labels; datasets=5; findings=0<br>300/300 HF-derived paper-eligible items; 0 still needed; 10/10 categories ready<br>3 paper claims prohibited until gates pass |
| what_is_novel | What is the novelty claim relative to existing RAG and long-context benchmarks? | The allowed claim is a taxonomy and package for hard grounded research failures beyond lookup, not that every component task type is new. Multi-hop and faithfulness are included only as parts of a broader document-lifecycle, authority, temporal, insufficiency, entity, contradiction, and conclusion-support surface. | 1 allowed novelty claims<br>5 prohibited or unsupported novelty framings |
| why_large_corpus | Why is this framed as large-corpus research QA? | The benchmark tracks source diversity, source acquisition, scaled public candidates, and pointer-only packaging separately from the 30-item pilot. The pilot proves harness mechanics; the scaled artifacts define the paper target and review queue. | 270 scaled public items<br>246 source acquisition candidates |
| how_are_licenses_handled | How are upstream Hugging Face licenses handled? | Known-license evidence can be redistributed under the package policy; unknown or mixed-license source text is pointer-only with hashes and locators. The data statement and public package manifest define this boundary. | 15 pointer-only items<br>18 pointer-only evidence units |
| what_should_reviewers_inspect | Which artifacts should reviewers inspect first? | Start with the supplement index, paper claim ledger, paper tables, data statement, version manifest, and release gate. These map claims to evidence and make blocked claims explicit. | 6 supplement sections<br>6 paper tables<br>1 active release blockers |
| main_risks | What are the main residual risks? | The main risks are construct validity before human review, statistical power before category scale, external validity across source domains, novelty drift, and measurement validity for citation and conclusion support. | 8 tracked validity threats<br>3 high-severity threats |
