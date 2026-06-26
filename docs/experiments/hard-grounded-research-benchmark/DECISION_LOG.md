# Decision Log

## 2026-06-26 — Materialize appendix evidence for lifecycle tasks

Decision: Add explicit synthetic appendix evidence units to document-lifecycle pilot items instead of representing appended document state only inside challenge metadata.

Rationale: The quality audit correctly flagged lifecycle items as repair-before-gold because they had only original-body evidence. To test lifecycle reasoning, models and reviewers need a citeable appended/superseding document unit.

Consequence: Appended lifecycle pilot items now include both original evidence and a citeable appendix update evidence unit, and the challenge payload points to the appendix evidence id.

## 2026-06-26 — Audit machine-seeded items before gold review

Decision: Add a deterministic item-quality audit that flags pilot items needing repair or careful review before human adjudication can promote them to gold.

Rationale: The pilot suite intentionally composes and perturbs Hugging Face rows, which can create weak or artificial items. A paper-worthy benchmark needs explicit pre-adjudication quality checks so machine-seeded artifacts do not silently become gold data.

Consequence: `benchmark:hard-grounded:audit` now emits `ITEM_QUALITY_AUDIT.md` and `generated/item-quality-audit.json` with per-item repair priorities and findings.

## 2026-06-26 — Promote aggregate scores into failure analysis

Decision: Extend the baseline report from macro metrics into per-category failure counts and representative failed examples for the lexical baseline.

Rationale: A benchmark paper needs to explain what failures the tasks expose, not only show that a baseline score is low. Representative failures connect the taxonomy to concrete evidence-use errors.

Consequence: `benchmark:hard-grounded:report` now includes lexical failure taxonomy and example failures in both `BASELINE_ANALYSIS.md` and `generated/baseline-analysis.json`.

## 2026-06-26 — Summarize baselines as reproducible paper tables

Decision: Add a report builder that turns checked-in run reports, gold readiness, and model-baseline readiness into a Markdown analysis and machine-readable JSON.

Rationale: Raw score JSON is useful for automation but weak as paper evidence. The benchmark needs reproducible category-level result tables that separate oracle sanity checks, non-oracle failures, dry-run model readiness, and unreviewed gold status.

Consequence: `benchmark:hard-grounded:report` now emits `BASELINE_ANALYSIS.md` and `generated/baseline-analysis.json`.

## 2026-06-26 — Make model baselines prompt-auditable first

Decision: Add an OpenAI-compatible baseline harness whose default mode writes prompt packets and a run manifest, with API execution gated behind an explicit `--run` flag.

Rationale: Model baselines are necessary for a publishable benchmark, but results must be reproducible and inspectable before spending API calls. Prompt packets let reviewers audit the exact evidence, challenge payload, and JSON answer contract sent to a model.

Consequence: `benchmark:hard-grounded:openai` now emits `runs/openai-grounded-baseline-v1/prompt-packet.jsonl` and `run-manifest.json` in dry-run mode; scored submissions are produced only with `--run` and `OPENAI_API_KEY`.

## 2026-06-26 — Add the first non-oracle retrieval baseline

Decision: Add a lexical evidence baseline that ranks provided evidence by question-token overlap, answers with simple abstain/conflict/label/text heuristics, and scores through the same external submission path as model systems.

Rationale: Previous weak baselines still read native answers, so they were scorer diagnostics rather than credible research-QA systems. A publishable benchmark needs baselines that fail for realistic reasons without privileged labels.

Consequence: `benchmark:hard-grounded:lexical` now emits `runs/lexical-evidence-baseline-v1/submission.json` and `runs/lexical-evidence-baseline-v1/report.json`.

## 2026-06-26 — Gate gold release on validated adjudication

Decision: Add an adjudication builder that validates reviewer labels, final answers, citation ids, insufficiency/conflict flags, notes, and challenge preservation before emitting a gold suite.

Rationale: The pilot suite is machine-seeded and should remain visibly non-gold until human review is complete. A paper benchmark needs an enforceable promotion path from review queue to publishable gold data.

Consequence: `benchmark:hard-grounded:adjudicate` now writes `generated/gold-suite-summary.json` on every run and emits `generated/gold-suite.json` only when all items are valid reviewed rows.

## 2026-06-26 — Add a deterministic local runner before API model runs

Decision: Add a local rule runner that writes full submission objects and scores them through the same evaluator path intended for model systems.

Rationale: The benchmark needs a reproducible end-to-end runner contract before spending API calls on frontier or open model baselines.

Consequence: `benchmark:hard-grounded:run` now emits `runs/local-rule-agent-v1/submission.json` and `runs/local-rule-agent-v1/report.json`.

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

## 2026-06-26 — Make scorer switchable to adjudicated gold

Decision: Add a gold-aware evaluation path that uses `generated/gold-suite.json` final answers and required citation ids when invoked with `--gold`.

Rationale: The pilot scorer is useful before review, but paper results must be computed from adjudicated labels rather than native or machine-seeded answers.

Consequence: `hard-grounded-research-evaluate.mjs --gold` now refuses to run until gold exists, then scores external submissions against adjudicated answers and citation requirements.

## 2026-06-26 — Add a non-oracle citation verifier baseline

Decision: Add a citation-aware verifier baseline that post-checks lexical answers against their cited evidence and abstains when citations do not support the conclusion.

Rationale: The novelty audit requires a third non-oracle baseline beyond lexical retrieval and prompt-auditable model runs. A verifier baseline isolates whether citation checking improves groundedness or merely trades answer coverage for abstention.

Consequence: `benchmark:hard-grounded:verify-citations` now emits `runs/citation-aware-verifier-v1/submission.json` and `report.json`, and the baseline analysis compares verifier deltas against the lexical baseline.

## 2026-06-26 — Add provisional calibration without weakening gold

Decision: Add a mechanically labeled calibration suite that reuses the future gold item shape but is explicitly marked non-gold and separate from strict adjudicated gold.

Rationale: The benchmark needs end-to-end gold-style scoring before human adjudication is complete, but publishing machine-derived labels as gold would corrupt the paper claim. A provisional calibration suite exercises final-answer and required-citation scoring while preserving the all-reviewed gold gate.

Consequence: `benchmark:hard-grounded:calibrate` now emits `generated/calibration-suite.json` and `calibration-suite-summary.json`, and `hard-grounded-research-evaluate.mjs --calibration` scores against those provisional labels without overwriting pilot baseline artifacts.

## 2026-06-26 — Make model baselines source-aware

Decision: Make the OpenAI-compatible baseline runner choose among pilot, provisional calibration, and future gold suites with separate output directories and matching evaluator flags.

Rationale: Paper tables need model baselines over the same label source being reported. A pilot-only model harness would force manual rewiring once calibration or adjudicated gold is available.

Consequence: `benchmark:hard-grounded:openai:calibration` now emits an auditable calibration prompt packet under `runs/openai-grounded-baseline-v1-calibration/`, while `--gold` is already wired to score future reviewed gold without changing code.

## 2026-06-26 — Score conclusion support separately

Decision: Add `conclusion_support` as an explicit evaluator metric that penalizes citation-overreach probes unless the system abstains.

Rationale: Citation precision only checks whether cited ids are in the expected set; it cannot distinguish evidence that supports a true premise from evidence that supports the submitted conclusion. The benchmark's overreach category needs a visible diagnostic for that failure mode.

Consequence: All score reports now include `conclusion_support`, baseline analysis tables expose it, and validation checks keep the overreach diagnostic in the evaluator contract.
