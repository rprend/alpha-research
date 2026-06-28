# Candidate-Internal Feature Overlay Audit

Generated: 2026-06-28T14:06:05.289Z

Status: `candidate_internal_overlay_not_sufficient`

This audit tests simple local-NLI and answer-shape overlays on top of the time-aware source-prefix selector.

## Selection

- Baseline source-prefix selector: 44/49
- Best overlay: source_prefix_recency_4x at 44/49
- Large NLI overlay: 34/49
- Train NLI entailment-min direction: 42/58

## Decision

- Promote candidate-internal overlay now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Mine targeted contrast data for the five remaining source-prefix misses instead of adding naive NLI/length overlays.
- Reason: Local NLI and answer-shape features are directionally useful in pairwise training, but simple listwise overlays do not improve the 44/49 final selector and larger NLI weights regress.
