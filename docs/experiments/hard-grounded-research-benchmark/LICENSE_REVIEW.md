# Hard Grounded Research License Review

This generated review records release-facing license status for upstream Hugging Face datasets. It is intentionally conservative: unknown or missing license metadata blocks public redistribution of stored evidence snippets.

## Summary

- Status: blocked
- Checked date: 2026-06-26
- Datasets reviewed: 5
- Public-release blockers: 2

## Dataset Review

| Dataset | Spec license | Observed license | Package policy | Blocks release |
| --- | --- | --- | --- | --- |
| hotpotqa/hotpot_qa | cc-by-sa-4.0 | cc-by-sa-4.0 | redistribute_with_attribution | no |
| allenai/qasper | cc-by-4.0 | cc-by-4.0 | redistribute_with_attribution | no |
| danwakeem/wikitablequestions-wtq | cc-by-4.0 | cc-by-4.0 | redistribute_with_attribution | no |
| tdiggelm/climate_fever | unknown | unknown | pointer_only_or_replace_before_public_release | yes |
| Pavithree/eli5 | unknown | missing | pointer_only_or_replace_before_public_release | yes |

## Blockers

- tdiggelm/climate_fever: Resolve upstream license, remove stored snippets, switch to pointer-only packaging, or replace this source before public redistribution. (observed license: unknown)
- Pavithree/eli5: Resolve upstream license, remove stored snippets, switch to pointer-only packaging, or replace this source before public redistribution. (observed license: missing)

## Evidence Notes

- hotpotqa/hotpot_qa: License comes from local benchmark spec metadata. Source: https://hf.co/datasets/hotpotqa/hotpot_qa
- allenai/qasper: License comes from local benchmark spec metadata. Source: https://hf.co/datasets/allenai/qasper
- danwakeem/wikitablequestions-wtq: License comes from local benchmark spec metadata. Source: https://hf.co/datasets/danwakeem/wikitablequestions-wtq
- tdiggelm/climate_fever: Hugging Face dataset page and Hub API report license: unknown. Source: https://huggingface.co/datasets/tdiggelm/climate_fever
- Pavithree/eli5: Hugging Face Hub API returned no license tag or cardData license field. Source: https://huggingface.co/datasets/Pavithree/eli5
