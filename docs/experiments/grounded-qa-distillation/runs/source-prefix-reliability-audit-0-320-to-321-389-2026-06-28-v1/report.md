# Source-Prefix Reliability Audit

Generated: 2026-06-28T13:51:44.323Z

Status: `source_prefix_promising_not_promoted`

This audit tests whether deployable source identity should be represented as exact prediction-run IDs, broad families, or normalized source prefixes.

## Selection

- Family prior: 42/49 supported
- Exact run with family fallback: 42/49 supported; unknown tops 49
- Source prefix with family fallback: 44/49 supported; unknown tops 14
- Delta vs committed family prior: +2

## Decision

- Promote source-prefix selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Use normalized source-prefix reliability as a candidate feature in a preregistered time-aware listwise selector, but do not treat exact run IDs as transferable.
- Reason: Exact run priors cannot transfer to unseen future runs, while normalized source prefixes improve final selection slightly and reduce misses, but the temporal stress caveat from D289 still applies.
