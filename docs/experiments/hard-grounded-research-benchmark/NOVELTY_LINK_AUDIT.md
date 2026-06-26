# Hard Grounded Research Novelty Link Audit

This generated audit records whether unresolved novelty-watchlist links point to the expected primary sources. It does not resolve novelty; it quarantines invalid or unverified related-work sources until a primary source and title match are established.

## Summary

- Audit ready: true
- Version: novelty-link-audit-v1
- Date checked: 2026-06-26
- Checked sources: 4
- Quarantined sources: 4
- Title mismatches: 1
- Not-found sources: 1
- Unverified primary sources: 2
- Final novelty claim allowed: false
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_watchlist_sources_checked | true | 4/4 watchlist sources have link-audit entries |
| all_packets_linked | true | 4/4 source packets linked |
| quarantine_preserved | true | 4 sources quarantined; completion_claim_allowed=false |

## Source Link Status

| Source | Risk | Observed status | Quarantined | Checked URL | Action |
| --- | --- | --- | --- | --- | --- |
| faithjudge-2026 | medium | not_found | yes | https://arxiv.org/html/2606.21923v1 | quarantine_until_primary_source_found |
| faithfulness-qa-2026 | medium | title_mismatch | yes | https://arxiv.org/html/2606.03962v1 | replace_url_before_adjudication |
| dora-2026 | medium | unverified_primary_source | yes | https://arxiv.org/html/2601.10870v3 | quarantine_until_primary_source_found |
| hierarag-2026 | high | unverified_primary_source | yes | https://arxiv.org/html/2606.12159v1 | quarantine_until_primary_source_found |
