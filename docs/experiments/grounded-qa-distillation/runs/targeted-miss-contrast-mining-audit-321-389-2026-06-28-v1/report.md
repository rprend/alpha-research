# Targeted Miss Contrast Mining Audit

Generated: 2026-06-28T14:12:31.434Z

Status: `targeted_contrasts_available_not_promoted`

This audit converts the five remaining source-prefix selector misses into explicit contrast-mining targets.

## Final Misses

- Remaining misses: 5
- Same-citation misses: 4
- Unsupported-longer misses: 3
- Unsupported-claim evidence available: 4
- Qwen unknown misses: 2

## Non-Final Targets

- Available target contrasts: 55
- Same-citation unsupported-claim contrasts: 29
- Same-citation unsupported-longer contrasts: 7
- Concise same-citation overexpansion contrasts: 2

## Decision

- Promote selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Build a targeted overexpansion/same-citation contrast packet from the mined non-final rows and evaluate a preregistered miss-aware selector.
- Reason: The remaining misses share concrete patterns, and matching non-final contrasts already exist, so the next step should construct targeted supervision rather than use broad hand-weighted feature overlays.
