# Corpus Realism / Private-KB Gap Audit

Generated: 2026-06-26T23:50:06.644Z

Status: `public_dated_proxy_not_private_kb`

## Scorecard

| Check | Status | Evidence |
| --- | --- | --- |
| hf_dataset_available | pass | Source dataset is allenai/qasper from Hugging Face. |
| domain_specific_research_kb | pass | QASPER papers form a domain-specific NLP research-paper KB proxy. |
| trusted_document_dates | pass | 77/77 papers have trusted arXiv API publication dates. |
| non_inferred_final_snapshot | pass | Trusted arXiv dates supersede arXiv-id-prefix month inference for the final holdout audit. |
| answerable_and_abstention_supervision | pass | Seed splits include grounded-answer and abstention examples. |
| counterfactual_insufficiency_cases | pass | Builder adds same-question counterfactual insufficient-evidence packs for abstention supervision. |
| versioned_domain_kb_extension_candidate | pass | versioned-private-kb-prototype-git-docs-2026-06-26-v1 emits 30 git-snapshot examples with stale-snapshot abstentions. |
| natural_question_wording_probe | pass | versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2 writes 30 natural-question probes with template rate 0.0% and prefix leakage 3.3%. |
| natural_question_stale_kb_eval | pass | versioned-kb-natural-question-eval-versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2 keeps the natural-question stale-KB failure: naive copy overall 50.0%, lexical snapshot guard 96.7%. |
| natural_versioned_kb_benchmark | fail | versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1 reports natural benchmark support=false; template question rate 100.0% and prefix leakage 100.0%. |
| versioned_private_corpus | fail | No private or enterprise corpus snapshot is present. |
| mutable_access_controlled_kb | fail | No access-controlled KB, user/team permissions, or confidential document lifecycle is modeled. |
| writeback_baseline_executable | fail | WriteBack-style mutable-memory baseline is scoped out until leak-safe dated/private snapshots exist. |

## Claim Boundary

- Supports evolving public domain-KB claim: yes
- Supports natural versioned-KB benchmark claim: no
- Supports private enterprise-KB claim: no
- Supports WriteBack memory baseline claim: no

Allowed claims:
- The current experiment uses a public, dated, domain-specific QASPER/arXiv proxy for evolving KB behavior.
- The protocol exercises document dates, compact retrieved evidence packs, citation grounding, abstention on insufficient evidence, and temporal train/eval separation.
- The repository-local git-doc prototype is a versioned domain-KB extension candidate with immutable snapshots and stale-snapshot abstentions.
- A small ledgered natural-question probe reduces deterministic wording leakage while preserving source-derived labels.
- A deterministic natural-question eval preserves the stale-snapshot failure mode after template wording is removed.
- The git-doc prototype is a deterministic snapshot diagnostic, not a natural versioned-KB benchmark.
- The result should be framed as a public-domain proxy until a versioned private or enterprise-like corpus is added.

Prohibited claims:
- The current evidence proves behavior on private enterprise KBs.
- The current corpus models access-control, confidentiality, or user/team permission boundaries.
- The current git-doc prototype is a natural user-question benchmark.
- The current experiment includes a fair WriteBack-style mutable-memory baseline.

## Private-KB Upgrade Requirements

- Add at least two immutable KB snapshots with document ids, update timestamps, and source provenance.
- Ensure final-window questions are answerable only from documents available at the evaluated snapshot time.
- Include natural insufficiency cases caused by missing or stale private-KB evidence, not only synthetic withheld-gold counterfactuals.
- Use natural questions that do not quote the target evidence prefix or reveal train/eval snapshot labels.
- Record retrieval indexes or compact evidence packs per snapshot so answer support can be audited without final-window leakage.
- If write-back memory is compared, permit writes only from prior snapshots and preserve provenance for each derived memory record.
- Keep all private data out of committed artifacts or use a licensed public enterprise-like proxy with redistribution rights.

## Budget

No OpenAI calls, no GPU jobs, and no new spend. Actual total spend remains $5.8964.
