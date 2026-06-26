# Hard Grounded Research Data Statement

This generated data statement records benchmark composition, source provenance, redistribution policy, intended use, and review status. It complements the dataset card with a stricter package-facing summary.

## Summary

- Data statement ready: true
- Version: data-statement-v1
- Source datasets: 6
- Pilot items: 30
- Scaled public items: 270
- Pointer-only items: 15
- Public redistribution clearance ready: true
- Completion claim allowed: false

## Source Datasets

| Dataset | License | Covers | URL |
| --- | --- | --- | --- |
| hotpotqa/hotpot_qa | cc-by-sa-4.0 | multi-hop synthesis<br>citation supports fact but not conclusion<br>entity disambiguation<br>cross-document contradiction | https://hf.co/datasets/hotpotqa/hotpot_qa |
| allenai/qasper | cc-by-4.0 | multi-hop synthesis<br>evidence insufficiency / abstention<br>citation supports fact but not conclusion<br>appended document lifecycle changes | https://hf.co/datasets/allenai/qasper |
| danwakeem/wikitablequestions-wtq | cc-by-4.0 | table + text reasoning<br>entity disambiguation<br>citation supports fact but not conclusion | https://hf.co/datasets/danwakeem/wikitablequestions-wtq |
| DongfuJiang/FeTaQA | mit | table + text reasoning<br>entity disambiguation<br>citation supports fact but not conclusion | https://hf.co/datasets/DongfuJiang/FeTaQA |
| tdiggelm/climate_fever | unknown | source authority conflicts<br>evidence insufficiency / abstention<br>cross-document contradiction<br>stale-vs-current document conflicts<br>temporal questions: as of date X | https://hf.co/datasets/tdiggelm/climate_fever |
| Pavithree/eli5 | unknown | multi-hop synthesis<br>source authority conflicts<br>citation supports fact but not conclusion | https://hf.co/datasets/Pavithree/eli5 |

## Package Policy

- Redistributable known-license items: 15
- Pointer-only items: 15
- Pointer-only evidence units: 18
- Policy: Include text only for evidence units whose upstream dataset license is known; include dataset id, title, locator, and text hash for unknown-license evidence.

## Intended Use

| # | Use |
| --- | --- |
| 1 | Evaluate grounded research QA systems on document-state, source-authority, temporal, evidence-sufficiency, and citation-support failures. |
| 2 | Support diagnostic benchmark-development claims while human-reviewed gold and scale gates remain incomplete. |
| 3 | Provide auditable task provenance from Hugging Face source datasets and generated challenge transforms. |

## Out-of-Scope Use

| # | Restriction |
| --- | --- |
| 1 | Public model leaderboards before reviewed gold, category scale, and final novelty gates pass. |
| 2 | High-stakes medical, legal, financial, safety, or climate-policy decisions. |
| 3 | Redistribution of unknown-license source text outside pointer-only package rules. |

## Review State

- Gold review complete: true
- Review merge ready: true
- Category scale ready: true
- Annotation QA rules: 5

## Limitations

| # | Limitation |
| --- | --- |
| 1 | Pilot labels are machine-seeded and diagnostic until double review and merge gates pass. |
| 2 | Source acquisition candidates are review-pending and cannot support final category claims. |
| 3 | Some evidence is pointer-only because upstream licenses are unknown or mixed. |
| 4 | Novelty is refreshed as of June 26, 2026 but remains preliminary until the final novelty gate passes. |
