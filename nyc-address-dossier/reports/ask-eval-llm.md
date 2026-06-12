# Ask-the-address eval (LLM layer, llama3.2:3b local)

_Generated 2026-06-12T16:03:10.973Z · 14 ground-truth questions sampled from `lots`_

| metric | result |
|---|---|
| address resolved to BBL | 100.0% |
| answer correct (contains ground truth) | **92.9%** |
| answer carries citations | 71.4% |
| accuracy: built questions | 85.7% (6/7) |
| accuracy: owner questions | 100.0% (7/7) |

Failure sample (first 1):
- "when was 62 DORVAL AVENUE in staten island built" expected ~"1979" (bbl 5056480029; resolved=true)

Method: questions generated FROM the dossier db (PLUTO yearbuilt / ownername), so scoring is
string-mechanical. Failures are mostly address-resolution mismatches (PAD range vs PLUTO
address string, condo lots) — exactly the gap an era gazetteer + BIN-level addressing closes.
The LLM layer must beat this baseline under the same citation constraint before it ships.
