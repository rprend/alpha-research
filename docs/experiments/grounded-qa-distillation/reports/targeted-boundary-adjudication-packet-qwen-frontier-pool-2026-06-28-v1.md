# Targeted Boundary Adjudication Packet

This is a zero-call launch packet. It made no OpenAI calls and launched no external compute.

## Why this packet exists

D267 found that the D265 overexpansion selector rescues 2 final diagnostic cases but regresses 1. D268 showed the current cheap conditional risk features do not recover that gain, so the next defensible paid step is a small boundary adjudication batch rather than more broad labels.

## Leakage guard

- Final boundary cases are diagnostic-only and forbidden for training.
- Candidate adjudication requests are non-final only.
- Candidate labels may be used only as allowed non-final targeted boundary adjudication.
- The paid runner must re-price before calls and ledger every call.

## Batch

- Requests: 12/12
- Unique non-final roots: 12
- Estimated cost: $0.24
- Cost cap: $0.25
- Budget remaining before batch: $86.54164689999998
- Estimated total after batch: $13.698353

## Decision

Paid batch prepared: true. Run paid batch now: false. Reason: The packet is capped and ready, but this script intentionally makes zero paid calls; use a ledgered runner to execute it.
