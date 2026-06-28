# Balanced Support Verifier Packet

This packet/probe combines broad preservation pairs with targeted overexpansion and same-citation hard negatives.

## Summary

- Status: balanced_support_verifier_final_signal_validation_conflict
- Train pairs: 97
- Validation pairs: 41
- Validation pairwise: 46.3%
- Final diagnostic pairwise: 57.4%
- Final diagnostic selection: 7/8
- Launch GPU now: no
- Buy OpenAI labels now: no

## Decision

The balanced verifier reaches 87.5% final diagnostic selection support, but only 46.3% validation pairwise accuracy; this is a final-like signal, not a deployable selector.

Next step: Audit the broad-preservation versus targeted-hard-negative conflict and build a stratified objective that preserves broad validation while retaining the final-like targeted signal.
