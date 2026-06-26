import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredDocs = [
  'AGENTS.md',
  'ARCHITECTURE.md',
  'docs/product/dashboard.md',
  'docs/control-plane.md',
  'docs/remote-agent-runner.md',
  'docs/observability.md',
  'docs/run-lifecycle.md',
  'docs/quality.md',
  'docs/dashboard-journey-eval.md',
  'docs/exec-plans/active/harness-engineering-foundation.md',
]

const requiredPackageScripts = [
  'build',
  'test',
  'test:harness',
  'test:infra',
  'benchmark:gutenberg',
  'benchmark:gutenberg:acquire',
  'benchmark:gutenberg:medium',
  'benchmark:gutenberg:high-recall:candidates',
  'benchmark:gutenberg:high-recall:label',
  'benchmark:gutenberg:high-recall:verify',
  'benchmark:gutenberg:high-recall:synthesize',
  'benchmark:gutenberg:high-recall:smoke',
  'benchmark:gutenberg:high-recall:mock-openai',
  'benchmark:hard-grounded',
  'benchmark:hard-grounded:evaluate',
  'benchmark:hard-grounded:run',
  'benchmark:hard-grounded:adjudicate',
  'benchmark:hard-grounded:calibrate',
  'benchmark:hard-grounded:review-merge',
  'benchmark:hard-grounded:lexical',
  'benchmark:hard-grounded:verify-citations',
  'benchmark:hard-grounded:openai',
  'benchmark:hard-grounded:openai:calibration',
  'benchmark:hard-grounded:report',
  'benchmark:hard-grounded:audit',
  'smoke:infra:live',
  'kb:validate',
  'kb:status',
  'kb:inventory',
  'kb:question',
  'kb:ingest:core',
  'kb:ingest:broad',
  'kb:ingest:gaps',
  'kb:index',
  'kb:tables',
  'kb:ingest:departments',
  'kb:import:gutenberg',
  'kb:ingest:web',
  'kb:import:experiments',
  'kb:search',
  'kb:audit',
  'kb:audit:blocked',
  'kb:search:sqlite',
  'kb:refresh',
  'qa:dashboard',
  'journey:dashboard:capture',
  'journey:dashboard:judge',
  'journey:dashboard:remediate',
  'cf:deploy:preview',
]

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

for (const doc of requiredDocs) {
  assert(existsSync(join(root, doc)), `Missing harness document: ${doc}`)
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
for (const script of requiredPackageScripts) {
  assert(packageJson.scripts?.[script], `Missing package script: ${script}`)
}

const appSource = readFileSync(join(root, 'src/App.tsx'), 'utf8')
assert(appSource.includes('isHarnessMode'), 'Dashboard is not wired to harness mode.')
assert(appSource.includes('harnessDatasets'), 'Dashboard does not expose harness datasets.')
for (const token of [
  'Set up your first dataset',
  'Copy setup command',
  'Open RESEARCH CLI',
  'This is expected for a new workspace.',
]) {
  assert(appSource.includes(token), `Datasets empty-state guidance is missing: ${token}`)
}
assert(appSource.includes('DashboardDataErrorState'), 'Dashboard data error state is missing.')
assert(appSource.includes('We cannot tell yet whether your account is empty'), 'Dashboard data error guidance is missing.')
assert(appSource.includes('Check status'), 'Dashboard data recovery action is missing.')

const harnessSource = readFileSync(join(root, 'src/harness-data.ts'), 'utf8')
for (const token of [
  'harnessDatasets',
  'harnessRuns',
  'harnessSessions',
  'getHarnessRunResults',
  'getHarnessDebugView',
]) {
  assert(harnessSource.includes(token), `Missing harness export: ${token}`)
}

const controlPlaneSource = readFileSync(join(root, 'src/control-plane.ts'), 'utf8')
assert(controlPlaneSource.includes('/debug-view'), 'Run debug endpoint is missing.')
assert(controlPlaneSource.includes('/assistant-sessions/') && controlPlaneSource.includes('latestError'), 'Session debug endpoint is missing.')
assert(
  controlPlaneSource.includes('UPDATE datasets SET deployment_status = ?, status = ?, updated_at = ? WHERE id = ?'),
  'Failed environment launches must update dataset deployment/status.',
)
assert(
  controlPlaneSource.includes('launchModalResearchJob') &&
    controlPlaneSource.includes('Submitting remote agent job to Modal.'),
  'Control plane must submit remote runs through Modal.',
)
assert(existsSync(join(root, 'scripts/validate-infrastructure-contract.mjs')), 'Missing infrastructure contract validation script.')
assert(existsSync(join(root, 'scripts/live-infrastructure-smoke.mjs')), 'Missing live infrastructure smoke script.')
assert(existsSync(join(root, 'docs/research-plans/local-humanities-knowledge-base-plan.md')), 'Missing local humanities knowledge base plan.')
assert(existsSync(join(root, 'data/knowledge-base/source-registry.json')), 'Missing local humanities KB source registry.')
assert(existsSync(join(root, 'data/knowledge-base/rights-taxonomy.json')), 'Missing local humanities KB rights taxonomy.')
assert(existsSync(join(root, 'data/knowledge-base/schemas/source-registry.schema.json')), 'Missing local humanities KB source registry schema.')
assert(existsSync(join(root, 'data/knowledge-base/schemas/ingest-manifest.schema.json')), 'Missing local humanities KB ingest manifest schema.')
assert(existsSync(join(root, 'scripts/kb-validate.mjs')), 'Missing local humanities KB validation script.')
assert(existsSync(join(root, 'scripts/kb-status.mjs')), 'Missing local humanities KB status script.')
assert(existsSync(join(root, 'scripts/kb-inventory-existing.mjs')), 'Missing local humanities KB inventory script.')
assert(existsSync(join(root, 'scripts/kb-question.mjs')), 'Missing local humanities KB question script.')
assert(existsSync(join(root, 'scripts/kb-ingest-core-samples.mjs')), 'Missing local humanities KB core ingest script.')
assert(existsSync(join(root, 'scripts/kb-ingest-broad-metadata.mjs')), 'Missing local humanities KB broad metadata ingest script.')
assert(existsSync(join(root, 'scripts/kb-ingest-cultural-collections.mjs')), 'Missing local humanities KB cultural collections ingest script.')
assert(existsSync(join(root, 'scripts/kb-ingest-doaj.mjs')), 'Missing local humanities KB DOAJ ingest script.')
assert(existsSync(join(root, 'scripts/kb-ingest-gap-sources.mjs')), 'Missing local humanities KB gap-source ingest script.')
assert(existsSync(join(root, 'scripts/kb-ingest-wikidata.mjs')), 'Missing local humanities KB Wikidata ingest script.')
assert(existsSync(join(root, 'scripts/kb-build-search-index.mjs')), 'Missing local humanities KB search index script.')
assert(existsSync(join(root, 'scripts/kb-build-semantic-index.mjs')), 'Missing local humanities KB semantic index script.')
assert(existsSync(join(root, 'scripts/kb-build-analytical-tables.mjs')), 'Missing local humanities KB analytical table script.')
assert(existsSync(join(root, 'scripts/kb-ingest-department-pages.mjs')), 'Missing local humanities KB department page ingest script.')
assert(existsSync(join(root, 'scripts/kb-import-gutenberg-local.mjs')), 'Missing local humanities KB Gutenberg local import script.')
assert(existsSync(join(root, 'scripts/kb-ingest-web-metadata.mjs')), 'Missing local humanities KB web metadata ingest script.')
assert(existsSync(join(root, 'scripts/kb-ingest-wayback-snapshots.mjs')), 'Missing local humanities KB Wayback snapshot ingest script.')
assert(existsSync(join(root, 'scripts/kb-import-experiment-seeds.mjs')), 'Missing local humanities KB experiment seed import script.')
assert(existsSync(join(root, 'scripts/kb-search.mjs')), 'Missing local humanities KB search script.')
assert(existsSync(join(root, 'scripts/kb-audit-coverage.mjs')), 'Missing local humanities KB coverage audit script.')
assert(existsSync(join(root, 'scripts/kb-audit-blocked-sources.mjs')), 'Missing local humanities KB blocked-source audit script.')
assert(existsSync(join(root, 'scripts/kb-search-sqlite.mjs')), 'Missing local humanities KB SQLite search script.')
assert(existsSync(join(root, 'scripts/kb-search-semantic.mjs')), 'Missing local humanities KB semantic search script.')
assert(existsSync(join(root, 'scripts/kb-refresh.mjs')), 'Missing local humanities KB refresh script.')
assert(existsSync(join(root, 'data/knowledge-base/config/department-pages.json')), 'Missing local humanities KB department page targets.')
assert(existsSync(join(root, 'scripts/gutenberg-semantic-benchmark.mjs')), 'Missing Gutenberg semantic benchmark runner.')
assert(existsSync(join(root, 'scripts/hard-grounded-research-benchmark.mjs')), 'Missing hard grounded research benchmark runner.')
assert(existsSync(join(root, 'scripts/hard-grounded-research-evaluate.mjs')), 'Missing hard grounded research benchmark evaluator.')
const hardGroundedEvaluatorSource = readFileSync(join(root, 'scripts/hard-grounded-research-evaluate.mjs'), 'utf8')
for (const token of ['conclusion_support', 'citation_overreach_probe']) {
  assert(hardGroundedEvaluatorSource.includes(token), `Hard grounded evaluator is missing conclusion-support token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-runner.mjs')), 'Missing hard grounded research benchmark local runner.')
assert(existsSync(join(root, 'scripts/hard-grounded-research-adjudicate.mjs')), 'Missing hard grounded research adjudication builder.')
const hardGroundedAdjudicateSource = readFileSync(join(root, 'scripts/hard-grounded-research-adjudicate.mjs'), 'utf8')
for (const token of ['review-merge-report.json', 'review-workbooks/index.json', 'reviewed-gold-v0']) {
  assert(hardGroundedAdjudicateSource.includes(token), `Hard grounded adjudicator is missing gold promotion token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-calibration-suite.mjs')), 'Missing hard grounded research calibration suite builder.')
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-merge.mjs')), 'Missing hard grounded research review merge validator.')
const hardGroundedReviewMergeSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-merge.mjs'), 'utf8')
for (const token of ['agreementStats', 'exact_agreement_rate', 'label_agreement_rate']) {
  assert(hardGroundedReviewMergeSource.includes(token), `Hard grounded review merge is missing agreement token: ${token}`)
}
const hardGroundedBenchmarkSource = readFileSync(join(root, 'scripts/hard-grounded-research-benchmark.mjs'), 'utf8')
for (const token of ['review_priority', 'quality_findings', 'workbookQualityHints']) {
  assert(hardGroundedBenchmarkSource.includes(token), `Hard grounded benchmark generator is missing reviewer quality token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-lexical-baseline.mjs')), 'Missing hard grounded research lexical baseline.')
assert(
  existsSync(join(root, 'scripts/hard-grounded-research-citation-verifier.mjs')),
  'Missing hard grounded research citation-aware verifier baseline.',
)
assert(existsSync(join(root, 'scripts/hard-grounded-research-openai-baseline.mjs')), 'Missing hard grounded research OpenAI baseline.')
const openAiBaselineSource = readFileSync(join(root, 'scripts/hard-grounded-research-openai-baseline.mjs'), 'utf8')
for (const token of ['--calibration', '--gold', 'calibration-suite.json', 'gold-suite.json']) {
  assert(openAiBaselineSource.includes(token), `Hard grounded OpenAI baseline is missing source-aware token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-report.mjs')), 'Missing hard grounded research baseline report builder.')
const hardGroundedReportSource = readFileSync(join(root, 'scripts/hard-grounded-research-report.mjs'), 'utf8')
for (const token of ['challengeTypeSummary', 'by_challenge_type', 'Challenge-Type Diagnostics']) {
  assert(hardGroundedReportSource.includes(token), `Hard grounded report is missing challenge diagnostic token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-paper-draft.mjs')), 'Missing hard grounded research paper draft builder.')
const hardGroundedPaperDraftSource = readFileSync(join(root, 'scripts/hard-grounded-research-paper-draft.mjs'), 'utf8')
for (const token of ['PAPER_DRAFT.md', 'Challenge-Type Results', 'Required Before Submission']) {
  assert(hardGroundedPaperDraftSource.includes(token), `Hard grounded paper draft is missing manuscript token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-dataset-card.mjs')), 'Missing hard grounded research dataset card builder.')
const hardGroundedDatasetCardSource = readFileSync(join(root, 'scripts/hard-grounded-research-dataset-card.mjs'), 'utf8')
for (const token of ['DATASET_CARD.md', 'Intended Uses', 'Data Provenance And Licensing Notes']) {
  assert(hardGroundedDatasetCardSource.includes(token), `Hard grounded dataset card is missing release token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-license-review.mjs')), 'Missing hard grounded research license review builder.')
const hardGroundedLicenseReviewSource = readFileSync(join(root, 'scripts/hard-grounded-research-license-review.mjs'), 'utf8')
for (const token of ['license-review.json', 'pointer_only_or_replace_before_public_release', 'Pavithree/eli5']) {
  assert(hardGroundedLicenseReviewSource.includes(token), `Hard grounded license review is missing license token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-release-gate.mjs')), 'Missing hard grounded research release gate builder.')
const hardGroundedReleaseGateSource = readFileSync(join(root, 'scripts/hard-grounded-research-release-gate.mjs'), 'utf8')
for (const token of ['release-gate.json', 'license-review.json', 'public-package-manifest.json', 'review_preflight_ready', 'sanitized_public_suite_present', 'unknown_license_resolved', 'novelty_audit_json', 'completion_claim_allowed', 'novelty_audit_final']) {
  assert(hardGroundedReleaseGateSource.includes(token), `Hard grounded release gate is missing release token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-package-manifest.mjs')), 'Missing hard grounded research package manifest builder.')
const hardGroundedPackageManifestSource = readFileSync(join(root, 'scripts/hard-grounded-research-package-manifest.mjs'), 'utf8')
for (const token of ['public-package-manifest.json', 'pointer_only_no_text', 'text_sha256']) {
  assert(hardGroundedPackageManifestSource.includes(token), `Hard grounded package manifest is missing packaging token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-public-package.mjs')), 'Missing hard grounded research public package builder.')
const hardGroundedPublicPackageSource = readFileSync(join(root, 'scripts/hard-grounded-research-public-package.mjs'), 'utf8')
for (const token of ['hard-grounded-research-public-suite.json', 'text_included_in_public_package', 'Pointer-only evidence leaked text']) {
  assert(hardGroundedPublicPackageSource.includes(token), `Hard grounded public package builder is missing packaging token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-import-model-results.mjs')), 'Missing hard grounded research model result importer.')
const hardGroundedModelImportSource = readFileSync(join(root, 'scripts/hard-grounded-research-import-model-results.mjs'), 'utf8')
for (const token of ['--system-id', 'custom_id', 'raw_output_parse_error', 'hard-grounded-research-evaluate.mjs']) {
  assert(hardGroundedModelImportSource.includes(token), `Hard grounded model importer is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-model-run-index.mjs')), 'Missing hard grounded research model run index.')
const hardGroundedModelRunIndexSource = readFileSync(join(root, 'scripts/hard-grounded-research-model-run-index.mjs'), 'utf8')
for (const token of ['model-run-index.json', 'eligible_model_baseline', 'import-manifest.json', 'run_requested', 'fixture']) {
  assert(hardGroundedModelRunIndexSource.includes(token), `Hard grounded model run index is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-import-smoke.mjs')), 'Missing hard grounded research model import smoke.')
const hardGroundedImportSmokeSource = readFileSync(join(root, 'scripts/hard-grounded-research-import-smoke.mjs'), 'utf8')
for (const token of ['fixture-model-import-smoke', 'fixture: true', 'eligible_model_baseline', 'Hard grounded model import smoke passed']) {
  assert(hardGroundedImportSmokeSource.includes(token), `Hard grounded model import smoke is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-preflight.mjs')), 'Missing hard grounded research review preflight.')
const hardGroundedReviewPreflightSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-preflight.mjs'), 'utf8')
for (const token of ['review-preflight.json', 'preflight_ready', 'reviewer_confidence', 'missing_fields']) {
  assert(hardGroundedReviewPreflightSource.includes(token), `Hard grounded review preflight is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-scale-plan.mjs')), 'Missing hard grounded research scale plan.')
const hardGroundedScalePlanSource = readFileSync(join(root, 'scripts/hard-grounded-research-scale-plan.mjs'), 'utf8')
for (const token of ['scale-plan.json', 'target_reviewed_items_per_category', 'additional_reviewed_items_needed', 'generation_strategy', 'source_datasets', 'expansion_batches', 'planned_review_rows', 'planned_not_generated', 'scale_ready']) {
  assert(hardGroundedScalePlanSource.includes(token), `Hard grounded scale plan is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-novelty-audit.mjs')), 'Missing hard grounded research novelty audit generator.')
const hardGroundedNoveltyAuditSource = readFileSync(join(root, 'scripts/hard-grounded-research-novelty-audit.mjs'), 'utf8')
for (const token of ['novelty-audit.json', 'completion_claim_allowed', 'high_novelty_risk_categories', 'OCC-RAG']) {
  assert(hardGroundedNoveltyAuditSource.includes(token), `Hard grounded novelty audit is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-quality-audit.mjs')), 'Missing hard grounded research item quality audit.')
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/benchmark-spec.json')),
  'Missing hard grounded research benchmark spec.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/NOVELTY_AUDIT.md')),
  'Missing hard grounded research novelty audit.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/rubrics.json')),
  'Missing hard grounded research rubrics.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/materialized-examples.json')),
  'Missing hard grounded research materialized examples.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/pilot-suite.json')),
  'Missing hard grounded research pilot suite.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/adjudication-queue.jsonl')),
  'Missing hard grounded research adjudication queue.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/adjudication-summary.json')),
  'Missing hard grounded research adjudication summary.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/adjudication-batches.json')),
  'Missing hard grounded research adjudication batch manifest.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ADJUDICATION_PACKET.md')),
  'Missing hard grounded research adjudication packet.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ADJUDICATION_BATCHES.md')),
  'Missing hard grounded research adjudication batch report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/review-workbooks/index.json')),
  'Missing hard grounded research review workbook index.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEW_WORKBOOKS.md')),
  'Missing hard grounded research review workbook report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/review-merge-report.json')),
  'Missing hard grounded research review merge report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEW_MERGE_REPORT.md')),
  'Missing hard grounded research review merge markdown report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/review-resolution-queue.jsonl')),
  'Missing hard grounded research review resolution queue.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEW_RESOLUTION_QUEUE.md')),
  'Missing hard grounded research review resolution markdown report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/baseline-report.json')),
  'Missing hard grounded research baseline report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/baseline-comparisons.json')),
  'Missing hard grounded research baseline comparisons.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/runs/local-rule-agent-v1/report.json')),
  'Missing hard grounded research local runner report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/gold-suite-summary.json')),
  'Missing hard grounded research gold readiness summary.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/calibration-suite.json')),
  'Missing hard grounded research calibration suite.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/calibration-baseline-report.json')),
  'Missing hard grounded research calibration baseline report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/runs/lexical-evidence-baseline-v1/report.json')),
  'Missing hard grounded research lexical baseline report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/runs/citation-aware-verifier-v1/report.json')),
  'Missing hard grounded research citation-aware verifier report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/runs/openai-grounded-baseline-v1/prompt-packet.jsonl')),
  'Missing hard grounded research OpenAI prompt packet.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/runs/openai-grounded-baseline-v1-calibration/prompt-packet.jsonl')),
  'Missing hard grounded research OpenAI calibration prompt packet.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/BASELINE_ANALYSIS.md')),
  'Missing hard grounded research baseline analysis report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ITEM_QUALITY_AUDIT.md')),
  'Missing hard grounded research item quality audit report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/license-review.json')),
  'Missing hard grounded research license review JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/LICENSE_REVIEW.md')),
  'Missing hard grounded research license review report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/public-package-manifest.json')),
  'Missing hard grounded research public package manifest JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/PUBLIC_PACKAGE_MANIFEST.md')),
  'Missing hard grounded research public package manifest report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/public-package/hard-grounded-research-public-suite.json')),
  'Missing hard grounded research sanitized public suite JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/public-package/hard-grounded-research-public-suite.jsonl')),
  'Missing hard grounded research sanitized public suite JSONL.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/release-gate.json')),
  'Missing hard grounded research release gate JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/RELEASE_GATE.md')),
  'Missing hard grounded research release gate report.',
)
assert(existsSync(join(root, 'scripts/gutenberg-acquire-corpus.mjs')), 'Missing real Gutenberg corpus acquisition script.')
assert(existsSync(join(root, 'scripts/gutenberg-real-benchmark.mjs')), 'Missing real Gutenberg medium benchmark runner.')
assert(existsSync(join(root, 'scripts/gutenberg-pipeline-lib.mjs')), 'Missing shared Gutenberg high-recall pipeline library.')
assert(existsSync(join(root, 'scripts/gutenberg-high-recall-candidates.mjs')), 'Missing Gutenberg high-recall candidate builder.')
assert(existsSync(join(root, 'scripts/gutenberg-openai-label-candidates.mjs')), 'Missing Gutenberg OpenAI labeler.')
assert(existsSync(join(root, 'scripts/gutenberg-openai-verify-labels.mjs')), 'Missing Gutenberg OpenAI verifier.')
assert(existsSync(join(root, 'scripts/gutenberg-synthesize-high-recall-results.mjs')), 'Missing Gutenberg high-recall synthesizer.')
assert(existsSync(join(root, 'scripts/gutenberg-openai-mock-smoke.mjs')), 'Missing Gutenberg mock OpenAI smoke script.')
const gutenbergAcquireSource = readFileSync(join(root, 'scripts/gutenberg-acquire-corpus.mjs'), 'utf8')
for (const token of [
  'pg_catalog.csv.gz',
  'Project Gutenberg',
  'stripGutenbergBoilerplate',
  'source-inventory.jsonl',
  'corpus-manifest.json',
  'target_works',
  'usable_works',
]) {
  assert(gutenbergAcquireSource.includes(token), `Gutenberg acquisition script is missing: ${token}`)
}
const gutenbergRunnerSource = readFileSync(join(root, 'scripts/gutenberg-semantic-benchmark.mjs'), 'utf8')
for (const token of [
  'scaleTargets',
  'medium',
  'minWorks: 5_000',
  'maxWorks: 20_000',
  'readRealInventory',
  'real_gutenberg_works_indexed',
  'mineTaskLabels',
  'real_gold_labels',
  'summarizeScaleDiagnostics',
  'deterministic_react_plus_verifier',
  'citation_faithfulness_rate',
  'hard_negative_acceptances',
]) {
  assert(gutenbergRunnerSource.includes(token), `Gutenberg medium-scale runner is missing: ${token}`)
}
const realGutenbergRunnerSource = readFileSync(join(root, 'scripts/gutenberg-real-benchmark.mjs'), 'utf8')
for (const token of [
  'source-inventory.jsonl',
  'Real Gutenberg Medium Error Analysis',
  "corpus_source: 'Project Gutenberg'",
  'synthetic_stress_works_indexed: 0',
  'mineLabels',
  'machine_mined_needs_human_review',
  'stats_pass_completed',
  'score_pass_completed',
]) {
  assert(realGutenbergRunnerSource.includes(token), `Real Gutenberg medium runner is missing: ${token}`)
}

const highRecallCandidateSource = readFileSync(join(root, 'scripts/gutenberg-high-recall-candidates.mjs'), 'utf8')
for (const token of [
  'source-inventory.jsonl',
  'Project Gutenberg',
  'candidate_pool.jsonl',
  'seeded_query',
  'semantic_signal',
  'near_miss_probe',
  'discovery_path',
]) {
  assert(highRecallCandidateSource.includes(token), `High-recall candidate builder is missing: ${token}`)
}
const highRecallLabelSource = readFileSync(join(root, 'scripts/gutenberg-openai-label-candidates.mjs'), 'utf8')
for (const token of [
  'gpt-5.5',
  'https://api.openai.com/v1',
  'OPENAI_BASE_URL',
  'json_schema',
  'llm_labels.jsonl',
  'needs_more_context',
  'suggested_query_terms',
  '--dry-run',
]) {
  assert(highRecallLabelSource.includes(token), `OpenAI labeler is missing: ${token}`)
}
const highRecallVerifySource = readFileSync(join(root, 'scripts/gutenberg-openai-verify-labels.mjs'), 'utf8')
for (const token of [
  'gpt-5.5',
  'llm_verifications.jsonl',
  'OPENAI_BASE_URL',
  'false_negative_risk',
  'needs_human_review',
  'json_schema',
]) {
  assert(highRecallVerifySource.includes(token), `OpenAI verifier is missing: ${token}`)
}
const highRecallSynthesisSource = readFileSync(join(root, 'scripts/gutenberg-synthesize-high-recall-results.mjs'), 'utf8')
for (const token of [
  'human_review_queue.md',
  'human_review_queue.jsonl',
  'next_query_variants.json',
  'final_candidate_labels.jsonl',
  'high_recall_summary.json',
]) {
  assert(highRecallSynthesisSource.includes(token), `High-recall synthesizer is missing: ${token}`)
}
const mockOpenAISmokeSource = readFileSync(join(root, 'scripts/gutenberg-openai-mock-smoke.mjs'), 'utf8')
for (const token of [
  'createServer',
  'OPENAI_BASE_URL',
  'gutenberg_label_verification',
  'gpt-5.5',
  'Mock OpenAI Gutenberg high-recall smoke passed.',
]) {
  assert(mockOpenAISmokeSource.includes(token), `Mock OpenAI smoke is missing: ${token}`)
}

for (const file of [
  'docs/experiments/gutenberg-semantic-benchmark/README.md',
  'docs/experiments/gutenberg-semantic-benchmark/schema.sql',
  'docs/experiments/gutenberg-semantic-benchmark/config/local.example.json',
  'docs/experiments/gutenberg-semantic-benchmark/data/task_items.jsonl',
  'docs/experiments/gutenberg-semantic-benchmark/data/gold_labels.jsonl',
]) {
  assert(existsSync(join(root, file)), `Missing Gutenberg semantic benchmark artifact: ${file}`)
}

const gutenbergTasks = readFileSync(join(root, 'docs/experiments/gutenberg-semantic-benchmark/data/task_items.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
assert(gutenbergTasks.length >= 10, 'Gutenberg pilot benchmark must include at least 10 task items.')
assert(new Set(gutenbergTasks.map((task) => task.family)).size >= 3, 'Gutenberg pilot benchmark must cover at least 3 task families.')

const gutenbergLabels = readFileSync(join(root, 'docs/experiments/gutenberg-semantic-benchmark/data/gold_labels.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
const firstPilotLabels = gutenbergLabels.filter((label) => label.task_id === 'death_ironic_humor_001')
assert(firstPilotLabels.filter((label) => label.label === 'positive').length >= 10, 'Gutenberg pilot task must include 10 positives.')
assert(firstPilotLabels.filter((label) => label.label === 'hard_negative').length >= 25, 'Gutenberg pilot task must include 25 hard negatives.')
assert(firstPilotLabels.filter((label) => label.label === 'ambiguous').length >= 5, 'Gutenberg pilot task must include 5 ambiguous examples.')

const remoteRunnerSource = readFileSync(join(root, 'src/remote-agent-runner-script.ts'), 'utf8')
for (const token of [
  'collect_deliverable_paths',
  'validate_research_artifact_bundle',
  'RESEARCH_ARTIFACT_BUNDLE',
  'report.html',
  'result.json',
  'dataset_coverage.json',
  'datasetCoverage',
  'missingDatasets',
  'work.md',
  'REPORT_REQUIRED_SECTIONS',
  'RESULT_REQUIRED_FIELDS',
  'WORK_REQUIRED_SECTIONS',
  'expected_primary_artifact_name',
  'bookkeeping artifacts do not count as completion',
  'Research artifact quality validation failed',
  'Remote agent run completed without required primary artifact',
  'deliverable artifact(s)',
  'OPENAI_PROXY_BASE_URL',
  'alpha-research-openai',
  'wire_api',
  'supports_websockets=false',
  'remote Codex runs must use the metered OpenAI proxy',
]) {
  assert(remoteRunnerSource.includes(token), `Remote runner completion guard is missing: ${token}`)
}
assert(
  remoteRunnerSource.includes('canonical-dataset-bootstrap') &&
    remoteRunnerSource.includes('validate_research_artifact_bundle') &&
    (
      remoteRunnerSource.includes('Canonical dataset bootstrap completed without required artifact') ||
      remoteRunnerSource.includes('Canonical dataset job completed without required artifact')
    ),
  'Research artifact bundle validation must preserve the canonical bootstrap exemption.',
)

for (const token of [
  '<h2>Executive Summary</h2>',
  '<h2>Data/Methods</h2>',
  '<h2>Evidence</h2>',
  '<h2>Limitations</h2>',
  '<h2>Next Steps</h2>',
  '## Commands Run',
  '## Intermediate Reasoning Summary',
  '## Blockers',
  '## Reproduction Notes',
  'sourceDatasetIds',
  'datasetCoverage',
  'dataset_coverage.json',
]) {
  assert(harnessSource.includes(token), `Harness completed run is missing artifact quality fixture token: ${token}`)
}

const workerSource = readFileSync(join(root, 'src/worker.ts'), 'utf8')
assert(
  workerSource.includes('proxyRemoteOpenAIRequest') &&
    workerSource.includes('remote_codex_runner') &&
    workerSource.includes('remote_codex_metering_failed'),
  'Worker must meter remote Codex OpenAI traffic before returning successful model responses.',
)
assert(workerSource.includes('async function datasetContentsForPrompt'), 'Assistant is missing dataset prompt context helper.')
assert(workerSource.includes('async function datasetsInventoryForPrompt'), 'Assistant is missing static dataset inventory prompt context.')
assert(workerSource.includes('async function buildAssistantModelContext'), 'Assistant is missing centralized model context builder.')
assert(
  workerSource.includes('assistant_request_trace') &&
    workerSource.includes('createAssistantTrace') &&
    workerSource.includes('traceMark'),
  'Assistant routes must emit structured request tracing.',
)
assert(
  workerSource.includes('text/event-stream') &&
    workerSource.includes('callResponsesApiStreaming') &&
    workerSource.includes("send('text_delta'"),
  'Assistant routes must support streaming text deltas.',
)
assert(
  workerSource.includes('scheduleAssistantSessionTitleUpdate') &&
    workerSource.includes('ctx.waitUntil(task)'),
  'Assistant title generation must run outside the critical path with Worker waitUntil.',
)
assert(
  workerSource.includes('RESEARCH_AGENT_REASONING_EFFORT') &&
    workerSource.includes("env.RESEARCH_AGENT_MODEL ?? 'gpt-5.5'") &&
    workerSource.includes("model.includes('gpt-5.5') || model.includes('gpt-5.2') || model.includes('gpt-5.1') ? 'none' : 'minimal'"),
  'Assistant should default to the lowest supported reasoning effort for lower first-token latency.',
)
assert(
  workerSource.includes('resetPreviousResponseId') &&
    workerSource.includes('compacted_session_history') &&
    workerSource.includes('SESSION_CONTEXT_RECENT_ENTRY_LIMIT'),
  'Assistant context builder must record proactive previous_response_id reset decisions.',
)
assert(
  workerSource.includes('Dataset context files:') &&
    workerSource.includes('dataset_briefing_markdown') &&
    workerSource.includes('dataset_profile_json') &&
    workerSource.includes('dataset_schema_json') &&
    workerSource.includes('dataset_sample_rows_json'),
  'Assistant dataset prompt context must include briefing/profile/schema/sample sections.',
)
assert(
  workerSource.includes('Use the dataset context above before asking the user for schema, coverage, field availability, briefing, or dataset identity details.'),
  'Assistant prompt must tell the model not to ask for dataset facts already present in prompt context.',
)
assert(workerSource.includes("name: 'plan_remote_run'"), 'Assistant is missing the remote run planning tool.')
assert(
  workerSource.includes('Write a prompt for a remote Alpha Research run based on this chat history.'),
  'Remote run planner must generate prompts from plain-text chat history.',
)
assert(
  workerSource.includes("content !== 'Calling plan_remote_run'"),
  'Remote run planner should use stored chat history without its own tool-call entry.',
)
assert(
  workerSource.includes('REMOTE_RUN_CHAT_HISTORY_LIMIT') &&
    workerSource.includes('entriesToPlainTextChatHistoryForPlanner'),
  'Remote run planner must use bounded chat history.',
)
assert(
  controlPlaneSource.includes('ASSISTANT_SESSION_CONTENT_STORAGE_LIMIT') &&
    controlPlaneSource.includes('boundedMetadataForStorage'),
  'Control plane must enforce assistant session entry storage bounds.',
)
assert(
  !workerSource.includes('MODEL_HIDDEN_RESEARCH_AGENT_TOOLS'),
  'Hidden duplicate remote execution tools should be deleted instead of filtered out.',
)
assert(
  !workerSource.includes("name: 'fetch_public_data'") &&
    !workerSource.includes("name: 'query_remote_dataset'") &&
    !workerSource.includes("name: 'aggregate_remote_dataset'") &&
    !workerSource.includes("name: 'start_remote_agent_run'") &&
    !workerSource.includes("name: 'run_remote_transformation'") &&
    !workerSource.includes("name: 'run_remote_labeling'"),
  'Duplicate remote execution tools must not be registered as assistant tools.',
)

const dashboardJourneySource = readFileSync(join(root, 'scripts/dashboard-journeys.mjs'), 'utf8')
for (const token of [
  'DASHBOARD_JOURNEYS',
  'Dashboard Orientation',
  'Dataset Inventory',
  'Completed Run Transcript And Artifacts',
  'User Mind',
  'Choose The Right Dataset',
  'Mobile Run Check-In',
  'Public Homepage Product Understanding',
  'Privacy And Trust Before Data Use',
]) {
  assert(dashboardJourneySource.includes(token), `Missing dashboard journey coverage: ${token}`)
}

for (const script of [
  'scripts/dashboard-journey-capture.mjs',
  'scripts/dashboard-journey-judge.mjs',
  'scripts/dashboard-journey-report.mjs',
  'scripts/dashboard-journey-remediate.mjs',
]) {
  assert(existsSync(join(root, script)), `Missing dashboard journey script: ${script}`)
}

const launchPostSource = readFileSync(join(root, 'public/blog/launching-alpha-research/index.html'), 'utf8')
for (const token of [
  'Try Alpha Book',
  'Open Dashboard',
  'What to do next',
  'CLI (RResearch)',
  'How the product surfaces fit together',
  'Typical path:',
]) {
  assert(launchPostSource.includes(token), `Launch post is missing required journey steering copy: ${token}`)
}

console.log('Harness contract validation passed.')
