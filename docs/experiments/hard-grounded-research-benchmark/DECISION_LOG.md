# Decision Log

## 2026-06-26 — Prefer materializable Hugging Face sources

Decision: Use Hugging Face datasets that can be sampled through the Dataset Viewer API for the working benchmark seed, replacing non-materializable choices when a viewer-accessible equivalent exists.

Rationale: A paper-worthy benchmark needs concrete, inspectable examples, not only dataset citations. `stanfordnlp/wikitablequestions` requires arbitrary Python in the Dataset Viewer and `defunct-datasets/eli5` has the viewer disabled, so they are poor defaults for an executable seed suite. `danwakeem/wikitablequestions-wtq` and `Pavithree/eli5` preserve the same benchmark roles while allowing live row materialization.

Consequence: The benchmark runner now fails if it cannot normalize live rows from the selected HF sources, and `generated/materialized-examples.json` becomes part of the harness contract.
