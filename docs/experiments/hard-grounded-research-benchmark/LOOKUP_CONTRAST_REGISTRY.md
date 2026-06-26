# Hard Grounded Research Lookup Contrast Registry

This generated registry states the simple lookup control for every category and the additional grounded-research operation that the benchmark is designed to test. It makes the paper question auditable: failures should be interpreted as hard-grounding failures only when they exceed what a simple fact lookup control would require.

## Summary

- Registry ready: true
- Version: lookup-contrast-registry-v1
- Categories: 10
- Pilot items: 30
- Lookup controls: 10
- Hard grounding operations: 10
- Hypothesis links: 10
- Estimand links: 10
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_categories_have_lookup_contrast | true | 10/10 categories define lookup controls and hard operations |
| lookup_contrasts_link_to_hypotheses_and_estimands | true | 10/10 rows link hypothesis and estimand |
| lookup_contrasts_have_pilot_and_evidence_contracts | true | 10/10 categories have pilot items with evidence contracts |
| claims_remain_gated | true | completion_claim_allowed=false; diagnostic_only_categories=10 |

## Lookup Contrasts

| Category | Simple lookup control | Hard grounding operation | Expected lookup-only failure | Primary metrics | Claim status |
| --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | Retrieve one page or one sentence containing a relevant entity fact. | Compose two or more required hops and reject a topically relevant but nonessential page. | The answer may be correct but the cited evidence misses one required hop or includes a distractor as if it were necessary. | answer_correct<br>evidence_recall<br>conclusion_support | diagnostic_only_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | Find a document that contains the requested claim text. | Select the controlling current snapshot and mark stale evidence as non-controlling. | The answer blends old and current snapshots or treats stale evidence as equally valid. | answer_correct<br>citation_faithfulness<br>conclusion_support | diagnostic_only_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | Find the original paper body passage that states a relevant claim. | Detect appended or lifecycle material that narrows, qualifies, or supersedes the original body. | The answer cites original-body evidence for a conclusion controlled by the appended material. | answer_correct<br>evidence_recall<br>conclusion_support | diagnostic_only_until_review_scale_and_novelty_clear |
| table + text reasoning | Extract a table cell or caption fact. | Combine table denotation with surrounding text before drawing the conclusion. | The answer extracts the right cell but draws a conclusion the text or caption does not support. | answer_correct<br>citation_precision<br>conclusion_support | diagnostic_only_until_review_scale_and_novelty_clear |
| source authority conflicts | Find a clear source that says a plausible answer. | Rank sources by authority and explain why lower-authority evidence is rejected. | The answer chooses the clearest prose instead of the highest-authority source. | answer_correct<br>citation_faithfulness<br>abstention_quality | diagnostic_only_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | Find a related fact or candidate evidence passage. | Decide whether the evidence entails the requested conclusion and abstain when it does not. | The answer supplies a plausible conclusion from evidence that supports only a related premise. | abstention_quality<br>conclusion_support<br>citation_faithfulness | diagnostic_only_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | Find a citation that supports a true premise. | Separate premise support from conclusion support and reject unsupported inference. | The answer uses a true citation as post-hoc support for a broader conclusion it does not entail. | conclusion_support<br>citation_faithfulness<br>answer_correct | diagnostic_only_until_review_scale_and_novelty_clear |
| entity disambiguation | Find a fact about a name, title, place, or abbreviation. | Resolve the intended entity and reject same-name or same-title distractors. | The answer merges entities that share a surface form. | answer_correct<br>evidence_recall<br>citation_precision | diagnostic_only_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | Find the most salient or newest relevant evidence. | Filter evidence by the requested as-of date and exclude future or stale evidence. | The answer leaks later evidence into an as-of answer or ignores the date constraint. | answer_correct<br>citation_faithfulness<br>abstention_quality | diagnostic_only_until_review_scale_and_novelty_clear |
| cross-document contradiction | Find documents that mention the topic. | Partition incompatible evidence and report conflict or apply the stated control rule. | The answer smooths contradictory evidence into a false consensus. | abstention_quality<br>conclusion_support<br>citation_faithfulness | diagnostic_only_until_review_scale_and_novelty_clear |
