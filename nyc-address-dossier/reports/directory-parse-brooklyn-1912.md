# Directory parse report — brooklyn-1912

_Generated 2026-06-12T15:35:40.258Z · volume: brooklynnewyorkc1912broo.txt · year 1912 · boro 3_

| metric | value |
|---|---|
| OCR lines | 197,369 |
| surname headers detected | 4,115 |
| entry lines (dash-led under a surname) | 65,227 |
| entries parsed (name + address) | 49,170 (75.4% of entry lines) |
| geocoded vs PAD (modern street + house range) | 6,373 / 49,170 (13.0%) |

Parsed entries: `/Users/ryanprendergast/.nyc-address-dossier/data/derived/directory-brooklyn-1912.jsonl` (not loaded into events — plan gate: ≥95% precision on gold pages first).

Honest caveats: rules-based parse over raw IA OCR; heavy OCR noise (digit/letter confusion,
mangled street names) caps the geocode rate. The plan's upgrade path is a local-VLM re-OCR
pass on failing pages plus the era gazetteer for renamed streets — both measured against
hand-labeled gold pages before anything enters dossiers.
