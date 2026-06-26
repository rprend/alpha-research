# Decision Log

## 2026-06-26 — Prefer materializable Hugging Face sources

Decision: Use Hugging Face datasets that can be sampled through the Dataset Viewer API for the working benchmark seed, replacing non-materializable choices when a viewer-accessible equivalent exists.

Rationale: A paper-worthy benchmark needs concrete, inspectable examples, not only dataset citations. `stanfordnlp/wikitablequestions` requires arbitrary Python in the Dataset Viewer and `defunct-datasets/eli5` has the viewer disabled, so they are poor defaults for an executable seed suite. `danwakeem/wikitablequestions-wtq` and `Pavithree/eli5` preserve the same benchmark roles while allowing live row materialization.

Consequence: The benchmark runner now fails if it cannot normalize live rows from the selected HF sources, and `generated/materialized-examples.json` becomes part of the harness contract.

## 2026-06-26 — Make scoring deterministic before adding agents

Decision: Add a schema-first local evaluator and a native-label baseline before building any model- or agent-specific runner.

Rationale: The benchmark cannot be paper-worthy if results depend on ad hoc manual judging or a single agent implementation. A deterministic scorer establishes the result contract first: answer correctness, evidence recall, citation precision, citation faithfulness, and abstention quality.

Consequence: `scripts/hard-grounded-research-evaluate.mjs` now scores JSON submissions against the materialized examples and emits reproducible baseline artifacts under `generated/`.

## 2026-06-26 — Treat novelty as a release gate

Decision: Do not claim the benchmark is paper-worthy or novel until a current literature scan supports a narrower contribution claim.

Rationale: The June 2026 scan found adjacent benchmarks for RAG faithfulness, passage grounding, temporal conflicts, conflicting evidence, and long-context/RAG evaluation. The benchmark's plausible contribution is the combined hard-research failure taxonomy, not any single category.

Consequence: `NOVELTY_AUDIT.md` is now part of the project record and lists required work before a completion claim.

## 2026-06-26 — Make categories operational with rubrics

Decision: Promote the ten hard-research categories from labels into an explicit rubric contract before expanding item counts.

Rationale: A larger benchmark would be weak if annotators and evaluators interpreted categories differently. The novelty audit also identified category-specific rubrics as required work before any paper-worthy claim.

Consequence: `rubrics.json` now defines task goals, required dimensions, strong answers, near misses, and hard negatives for every category, and the evaluator includes rubric dimensions in score reports.

## 2026-06-26 — Add diagnostic weak baselines

Decision: Add deterministic non-oracle diagnostic baselines before integrating model runners.

Rationale: The native-label baseline is useful only as an evaluator sanity check because it has access to gold answers and all required citations. A paper benchmark also needs simple systems that visibly fail on evidence recall and citation faithfulness, so the benchmark can show its scoring surface catches grounded-research failures.

Consequence: `benchmark:hard-grounded:evaluate` now emits `baseline-comparisons.json` with oracle, answer-only/no-citation, and first-evidence-only systems.

## 2026-06-26 — Expand to a machine-seeded pilot suite

Decision: Build a deterministic 30-item pilot suite from the materialized Hugging Face rows before attempting the full reviewed benchmark.

Rationale: The paper-worthy target needs 30-50 reviewed items per category, but the benchmark needs an intermediate artifact that exercises all category contracts across multiple examples and remains cheap to regenerate. A machine-seeded pilot lets the scorer, baselines, and data contract scale beyond a single example per category while clearly marking items as needing human adjudication.

Consequence: `generated/pilot-suite.json` now contains three pilot items per category with native, composed, and adversarial-wrapper construction metadata, and the evaluator scores this pilot suite by default.

## 2026-06-26 — Separate pilot items from gold items

Decision: Treat the machine-seeded pilot suite as a review queue, not as publishable gold data.

Rationale: Paper-worthy benchmark claims require adjudicated labels, minimal citation sets, and explicit insufficiency/conflict judgments. The pilot suite is useful for exercising the machinery, but it should not be confused with reviewed ground truth.

Consequence: The generator now emits `generated/adjudication-queue.jsonl`, `generated/adjudication-summary.json`, and `ADJUDICATION_PACKET.md`; the summary marks `gold_ready: false` until human review is complete.

## 2026-06-26 — Make adversarial traps explicit

Decision: Encode category-specific challenge payloads inside pilot items instead of relying on the generic `adversarial_wrapper` flag.

Rationale: Reviewers and model runners need to know the exact trap an item is testing: stale/current conflict, lifecycle supersession, authority ranking, insufficiency, citation overreach, as-of-date leakage, or contradiction handling. A flag alone is not enough to make the benchmark inspectable or reproducible.

Consequence: Pilot items and adjudication queue rows now include structured `challenge` objects with required behavior, invalid evidence policy, and the intended failure mode.
