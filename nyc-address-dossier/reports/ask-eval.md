# Ask-the-address eval (deterministic layer)

_Generated 2026-06-12T15:59:31.723Z · 46 ground-truth questions sampled from `lots`_

| metric | result |
|---|---|
| address resolved to BBL | 97.8% |
| answer correct (contains ground truth) | **93.5%** |
| answer carries citations | 97.8% |
| accuracy: built questions | 100.0% (23/23) |
| accuracy: owner questions | 87.0% (20/23) |

Failure sample (first 3):
- "who owns 3823 FT HAMILTON PARKWAY in brooklyn" expected ~"MIN" (bbl 3052900026; resolved=false)
- "who owns 579 MONROE STREET in brooklyn" expected ~"GIRARDOTBERG" (bbl 3016350053; resolved=true)
- "who owns 439 CASTLE HILL AVENUE in bronx" expected ~"URENASANTOS" (bbl 2035100047; resolved=true)

Method: questions generated FROM the dossier db (PLUTO yearbuilt / ownername), so scoring is
string-mechanical. Failures are mostly address-resolution mismatches (PAD range vs PLUTO
address string, condo lots) — exactly the gap an era gazetteer + BIN-level addressing closes.
The LLM layer must beat this baseline under the same citation constraint before it ships.
