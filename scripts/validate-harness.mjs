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
  'benchmark:hard-grounded:annotation-export',
  'benchmark:hard-grounded:annotation-import-smoke',
  'benchmark:hard-grounded:import-annotations',
  'benchmark:hard-grounded:gold-promotion-smoke',
  'benchmark:hard-grounded:expansion-promotion-smoke',
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
assert(existsSync(join(root, 'scripts/hard-grounded-research-anthropic-baseline.mjs')), 'Missing hard grounded research Anthropic baseline.')
const anthropicBaselineSource = readFileSync(join(root, 'scripts/hard-grounded-research-anthropic-baseline.mjs'), 'utf8')
for (const token of ['--calibration', '--gold', 'ANTHROPIC_API_KEY', 'messages']) {
  assert(anthropicBaselineSource.includes(token), `Hard grounded Anthropic baseline is missing source-aware token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-report.mjs')), 'Missing hard grounded research baseline report builder.')
const hardGroundedReportSource = readFileSync(join(root, 'scripts/hard-grounded-research-report.mjs'), 'utf8')
for (const token of ['challengeTypeSummary', 'by_challenge_type', 'Challenge-Type Diagnostics', 'model-run-index.json', 'external_model_baselines', 'External Model Baselines']) {
  assert(hardGroundedReportSource.includes(token), `Hard grounded report is missing challenge diagnostic token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-paper-draft.mjs')), 'Missing hard grounded research paper draft builder.')
const hardGroundedPaperDraftSource = readFileSync(join(root, 'scripts/hard-grounded-research-paper-draft.mjs'), 'utf8')
for (const token of ['PAPER_DRAFT.md', 'Challenge-Type Results', 'External Model Baselines', 'Review Execution Readiness', 'Release Gate Snapshot', 'Adversarial Related-Work Comparison', 'Construct Validity Map', 'construct-map.json', 'Scale And Power Plan', 'power-plan.json', 'claim_boundaries', 'search_queries', 'license-clearance.json', 'annotator-agreement.json', 'corpus-audit.json', 'gold-promotion-smoke/report.json', 'expansion-promotion-smoke/report.json', 'Required Before Submission']) {
  assert(hardGroundedPaperDraftSource.includes(token), `Hard grounded paper draft is missing manuscript token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-dataset-card.mjs')), 'Missing hard grounded research dataset card builder.')
const hardGroundedDatasetCardSource = readFileSync(join(root, 'scripts/hard-grounded-research-dataset-card.mjs'), 'utf8')
for (const token of ['DATASET_CARD.md', 'Intended Uses', 'Data Provenance And Licensing Notes', 'Promotion Rehearsals', 'External Model Baselines', 'Statistical Scale Plan', 'power-plan.json', 'power_plan_ready', 'construct-map.json', 'construct_map_ready', 'adjudication-readiness.json', 'Adjudication readiness', 'annotator-agreement.json', 'Annotator agreement', 'corpus-audit.json', 'Corpus audit', 'novelty_claim_boundaries_ready', 'Novelty claim boundaries', 'annotation_return_readiness_ready', 'Annotation return readiness', 'annotation-export/manifest.json', 'license-clearance.json', 'gold-promotion-smoke/report.json', 'expansion-promotion-smoke/report.json']) {
  assert(hardGroundedDatasetCardSource.includes(token), `Hard grounded dataset card is missing release token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-license-review.mjs')), 'Missing hard grounded research license review builder.')
const hardGroundedLicenseReviewSource = readFileSync(join(root, 'scripts/hard-grounded-research-license-review.mjs'), 'utf8')
for (const token of ['license-review.json', 'pointer_only_or_replace_before_public_release', 'Pavithree/eli5']) {
  assert(hardGroundedLicenseReviewSource.includes(token), `Hard grounded license review is missing license token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-license-impact.mjs')), 'Missing hard grounded research license impact builder.')
const hardGroundedLicenseImpactSource = readFileSync(join(root, 'scripts/hard-grounded-research-license-impact.mjs'), 'utf8')
for (const token of ['license-impact.json', 'impacted_candidate_count', 'replacement_or_pointer_only_required', 'replace_source_or_pointer_only_before_public_release']) {
  assert(hardGroundedLicenseImpactSource.includes(token), `Hard grounded license impact is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-license-remediation-plan.mjs')), 'Missing hard grounded research license remediation plan builder.')
const hardGroundedLicenseRemediationSource = readFileSync(join(root, 'scripts/hard-grounded-research-license-remediation-plan.mjs'), 'utf8')
for (const token of ['license-remediation-plan.json', 'replace_blocked_sources_with_known_license_sources', 'pointer_only_public_package_until_source_replacement']) {
  assert(hardGroundedLicenseRemediationSource.includes(token), `Hard grounded license remediation plan is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-remediated-expansion-candidates.mjs')), 'Missing hard grounded research remediated expansion candidates builder.')
const hardGroundedRemediatedExpansionSource = readFileSync(join(root, 'scripts/hard-grounded-research-remediated-expansion-candidates.mjs'), 'utf8')
for (const token of ['license-remediated-expansion-candidates.json', 'license_remediated_candidate', 'known_license_sources_only']) {
  assert(hardGroundedRemediatedExpansionSource.includes(token), `Hard grounded remediated expansion candidates builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-license-clearance.mjs')), 'Missing hard grounded research license clearance builder.')
const hardGroundedLicenseClearanceSource = readFileSync(join(root, 'scripts/hard-grounded-research-license-clearance.mjs'), 'utf8')
for (const token of ['license-clearance.json', 'public_redistribution_clearance_ready', 'pointer_only_text_stripped', 'unknown_license_text_stripped']) {
  assert(hardGroundedLicenseClearanceSource.includes(token), `Hard grounded license clearance builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-annotation-protocol.mjs')), 'Missing hard grounded research annotation protocol builder.')
const hardGroundedAnnotationProtocolSource = readFileSync(join(root, 'scripts/hard-grounded-research-annotation-protocol.mjs'), 'utf8')
for (const token of ['annotation-protocol.json', 'final_labels', 'category_fit', 'generation_defect', 'annotation_protocol_ready']) {
  assert(hardGroundedAnnotationProtocolSource.includes(token), `Hard grounded annotation protocol builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-release-gate.mjs')), 'Missing hard grounded research release gate builder.')
const hardGroundedReleaseGateSource = readFileSync(join(root, 'scripts/hard-grounded-research-release-gate.mjs'), 'utf8')
for (const token of ['release-gate.json', 'annotation-protocol.json', 'license-review.json', 'license-impact.json', 'license-clearance.json', 'license-remediation-plan.json', 'license-remediated-expansion-candidates.json', 'public-package-manifest.json', 'public-package-integrity.json', 'public-package-schema.json', 'responsible-use.json', 'data-statement.json', 'version-manifest.json', 'scaled-summary.json', 'model-baseline-packets.json', 'model-reporting-card.json', 'review-execution-plan.json', 'review-packet-audit.json', 'review-return-contract.json', 'review-return-preflight.json', 'review-return-checklist.json', 'review-collection-tracker.json', 'gold-adjudication-plan.json', 'scale-adjudication-plan.json', 'reproduction-capsule.json', 'citation-metadata.json', 'submission-contract.json', 'scoring-contract.json', 'error-codebook.json', 'baseline-uncertainty.json', 'failure-atlas.json', 'paper-tables.json', 'analysis-plan.json', 'paper-claim-ledger.json', 'supplement-index.json', 'reviewer-faq.json', 'source-diversity-plan.json', 'source-acquisition-manifest.json', 'source-acquisition-packets.json', 'source-acquisition-audit.json', 'source-acquisition-fetched-rows.json', 'source-acquisition-candidates.json', 'source-acquisition-review-workbooks/index.json', 'source-acquisition-review-preflight.json', 'review-calibration.json', 'annotation-quality-control.json', 'power-plan.json', 'construct-map.json', 'artifact-checklist.json', 'threats-validity.json', 'novelty-evidence.json', 'novelty-watchlist.json', 'novelty-resolution-matrix.json', 'novelty-finalization-preflight.json', 'novelty-source-review-packets.json', 'novelty-claim-revision-plan.json', 'review-operations.json', 'reviewer-handoff.json', 'review-progress.json', 'adjudication-readiness.json', 'annotator-agreement.json', 'corpus-audit.json', 'annotation-export/manifest.json', 'annotation-import-smoke/report.json', 'annotation-import/report.json', 'gold-promotion-smoke/report.json', 'expansion-promotion-smoke/report.json', 'annotation_protocol_present', 'review_preflight_ready', 'review_operations_ready', 'reviewer_handoff_ready', 'review_progress_ready', 'review_execution_plan_ready', 'review_packet_audit_ready', 'review_return_contract_ready', 'review_return_preflight_ready', 'review_return_checklist_ready', 'review_collection_tracker_ready', 'gold_adjudication_plan_ready', 'scale_adjudication_plan_ready', 'reproduction_capsule_ready', 'citation_metadata_ready', 'adjudication_readiness_ready', 'annotator_agreement_ready', 'corpus_audit_ready', 'public_package_integrity_ready', 'public_package_schema_ready', 'source_diversity_plan_ready', 'source_acquisition_manifest_ready', 'source_acquisition_packets_ready', 'source_acquisition_audit_ready', 'source_acquisition_fetch_report_ready', 'source_acquisition_fetch_full_ready', 'source_acquisition_candidates_ready', 'source_acquisition_review_workbooks_ready', 'source_acquisition_review_preflight_report_ready', 'review_calibration_ready', 'annotation_quality_control_ready', 'paper_claim_ledger_ready', 'supplement_index_ready', 'reviewer_faq_ready', 'responsible_use_ready', 'data_statement_ready', 'version_manifest_ready', 'model_reporting_card_ready', 'submission_contract_ready', 'scoring_contract_ready', 'error_codebook_ready', 'construct_map_ready', 'artifact_checklist_ready', 'threats_validity_ready', 'failure_atlas_ready', 'paper_tables_ready', 'analysis_plan_ready', 'power_plan_ready', 'novelty_claim_boundaries_ready', 'novelty_watchlist_ready', 'novelty_resolution_matrix_ready', 'novelty_finalization_preflight_ready', 'novelty_source_review_packets_ready', 'novelty_claim_revision_plan_ready', 'annotation_export_ready', 'annotation_return_readiness_ready', 'annotation_import_smoke_ready', 'annotation_import_path_ready', 'gold_promotion_smoke_ready', 'expansion_promotion_smoke_ready', 'expansion_review_preflight_ready', 'expansion_review_merge_ready', 'license_impact_clear', 'license_remediation_plan_present', 'license_remediated_expansion_candidates_present', 'scaled_public_package_present', 'baseline_uncertainty_present', 'model_baseline_packets_present', 'model_reporting_card_ready', 'novelty_evidence_registry_present', 'sanitized_public_suite_present', 'unknown_license_resolved', 'novelty_audit_json', 'completion_claim_allowed', 'novelty_audit_final']) {
  assert(hardGroundedReleaseGateSource.includes(token), `Hard grounded release gate is missing release token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-corpus-audit.mjs')), 'Missing hard grounded research corpus audit builder.')
const hardGroundedCorpusAuditSource = readFileSync(join(root, 'scripts/hard-grounded-research-corpus-audit.mjs'), 'utf8')
for (const token of ['corpus-audit.json', 'CORPUS_AUDIT.md', 'corpus_audit_ready', 'scaled_public_source_rows', 'package_policy_matches_summaries']) {
  assert(hardGroundedCorpusAuditSource.includes(token), `Hard grounded corpus audit is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-power-plan.mjs')), 'Missing hard grounded research power plan builder.')
const hardGroundedPowerPlanSource = readFileSync(join(root, 'scripts/hard-grounded-research-power-plan.mjs'), 'utf8')
for (const token of ['power-plan.json', 'POWER_PLAN.md', 'power_plan_ready', 'target_reviewed_items_per_category', 'conservative_detectable_delta_80_power']) {
  assert(hardGroundedPowerPlanSource.includes(token), `Hard grounded power plan is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-construct-map.mjs')), 'Missing hard grounded research construct map builder.')
const hardGroundedConstructMapSource = readFileSync(join(root, 'scripts/hard-grounded-research-construct-map.mjs'), 'utf8')
for (const token of ['construct-map.json', 'CONSTRUCT_MAP.md', 'construct_map_ready', 'baseline_metric_ranges', 'novelty_risk']) {
  assert(hardGroundedConstructMapSource.includes(token), `Hard grounded construct map is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-artifact-checklist.mjs')), 'Missing hard grounded research artifact checklist builder.')
const hardGroundedArtifactChecklistSource = readFileSync(join(root, 'scripts/hard-grounded-research-artifact-checklist.mjs'), 'utf8')
for (const token of ['artifact-checklist.json', 'ARTIFACT_CHECKLIST.md', 'artifact_checklist_ready', 'reproduction_commands', 'paper_readiness']) {
  assert(hardGroundedArtifactChecklistSource.includes(token), `Hard grounded artifact checklist is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-source-acquisition-fetch.mjs')), 'Missing hard grounded source acquisition fetch builder.')
const hardGroundedSourceAcquisitionFetchSource = readFileSync(join(root, 'scripts/hard-grounded-research-source-acquisition-fetch.mjs'), 'utf8')
for (const token of ['source-acquisition-fetched-rows.json', 'source-acquisition-fetched-rows.jsonl', 'SOURCE_ACQUISITION_FETCHED_ROWS.md', 'datasets-server.huggingface.co/rows', 'source_acquisition_fetch_report_ready', 'pointer_only']) {
  assert(hardGroundedSourceAcquisitionFetchSource.includes(token), `Hard grounded source acquisition fetch is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-source-acquisition-candidates.mjs')), 'Missing hard grounded source acquisition candidate builder.')
const hardGroundedSourceAcquisitionCandidateSource = readFileSync(join(root, 'scripts/hard-grounded-research-source-acquisition-candidates.mjs'), 'utf8')
for (const token of ['source-acquisition-candidates.json', 'source-acquisition-candidates.jsonl', 'SOURCE_ACQUISITION_CANDIDATES.md', 'source_acquisition_candidates_ready', 'required_review_rows', 'candidate_materialized_from_source_row_needs_review_workbook']) {
  assert(hardGroundedSourceAcquisitionCandidateSource.includes(token), `Hard grounded source acquisition candidate builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-source-acquisition-review-workbooks.mjs')), 'Missing hard grounded source acquisition review workbook builder.')
const hardGroundedSourceAcquisitionReviewWorkbookSource = readFileSync(join(root, 'scripts/hard-grounded-research-source-acquisition-review-workbooks.mjs'), 'utf8')
for (const token of ['source-acquisition-review-workbooks', 'SOURCE_ACQUISITION_REVIEW_WORKBOOKS.md', 'source_acquisition_review_workbooks_ready', 'pointer_only_text_must_remain_blank', 'reviewer_fields']) {
  assert(hardGroundedSourceAcquisitionReviewWorkbookSource.includes(token), `Hard grounded source acquisition review workbook builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-source-acquisition-review-preflight.mjs')), 'Missing hard grounded source acquisition review preflight builder.')
const hardGroundedSourceAcquisitionReviewPreflightSource = readFileSync(join(root, 'scripts/hard-grounded-research-source-acquisition-review-preflight.mjs'), 'utf8')
for (const token of ['source-acquisition-review-preflight.json', 'SOURCE_ACQUISITION_REVIEW_PREFLIGHT.md', 'source_acquisition_review_preflight_report_ready', 'pointer_only_text_must_remain_blank', 'preflight_ready']) {
  assert(hardGroundedSourceAcquisitionReviewPreflightSource.includes(token), `Hard grounded source acquisition review preflight builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-calibration.mjs')), 'Missing hard grounded reviewer calibration builder.')
const hardGroundedReviewCalibrationSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-calibration.mjs'), 'utf8')
for (const token of ['review-calibration.json', 'REVIEW_CALIBRATION.md', 'review_calibration_ready', 'minimum_accuracy', 'gold_promotion_allowed']) {
  assert(hardGroundedReviewCalibrationSource.includes(token), `Hard grounded reviewer calibration builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-annotation-quality-control.mjs')), 'Missing hard grounded annotation quality-control builder.')
const hardGroundedAnnotationQualityControlSource = readFileSync(join(root, 'scripts/hard-grounded-research-annotation-quality-control.mjs'), 'utf8')
for (const token of ['annotation-quality-control.json', 'ANNOTATION_QUALITY_CONTROL.md', 'annotation_quality_control_ready', 'allow_sentinel_rows_in_gold', 'adjudication_sampling']) {
  assert(hardGroundedAnnotationQualityControlSource.includes(token), `Hard grounded annotation quality-control builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-paper-claim-ledger.mjs')), 'Missing hard grounded paper claim ledger builder.')
const hardGroundedPaperClaimLedgerSource = readFileSync(join(root, 'scripts/hard-grounded-research-paper-claim-ledger.mjs'), 'utf8')
for (const token of ['paper-claim-ledger.json', 'PAPER_CLAIM_LEDGER.md', 'paper_claim_ledger_ready', 'diagnostic_only', 'prohibited_until_gates_pass']) {
  assert(hardGroundedPaperClaimLedgerSource.includes(token), `Hard grounded paper claim ledger builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-supplement-index.mjs')), 'Missing hard grounded supplement index builder.')
const hardGroundedSupplementIndexSource = readFileSync(join(root, 'scripts/hard-grounded-research-supplement-index.mjs'), 'utf8')
for (const token of ['supplement-index.json', 'SUPPLEMENT_INDEX.md', 'supplement_index_ready', 'paper_tables', 'claim_map']) {
  assert(hardGroundedSupplementIndexSource.includes(token), `Hard grounded supplement index builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-reviewer-faq.mjs')), 'Missing hard grounded reviewer FAQ builder.')
const hardGroundedReviewerFaqSource = readFileSync(join(root, 'scripts/hard-grounded-research-reviewer-faq.mjs'), 'utf8')
for (const token of ['reviewer-faq.json', 'REVIEWER_FAQ.md', 'reviewer_faq_ready', 'is_this_gold_ready', 'what_is_novel']) {
  assert(hardGroundedReviewerFaqSource.includes(token), `Hard grounded reviewer FAQ builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-model-reporting-card.mjs')), 'Missing hard grounded model reporting card builder.')
const hardGroundedModelReportingCardSource = readFileSync(join(root, 'scripts/hard-grounded-research-model-reporting-card.mjs'), 'utf8')
for (const token of ['model-reporting-card.json', 'MODEL_REPORTING_CARD.md', 'model_reporting_card_ready', 'required_reporting_fields', 'prompt_packet_hash_or_manifest']) {
  assert(hardGroundedModelReportingCardSource.includes(token), `Hard grounded model reporting card builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-execution-plan.mjs')), 'Missing hard grounded review execution plan builder.')
const hardGroundedReviewExecutionPlanSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-execution-plan.mjs'), 'utf8')
for (const token of ['review-execution-plan.json', 'REVIEW_EXECUTION_PLAN.md', 'review_execution_plan_ready', 'reviewer_hours_with_reserve', 'acceptance_gates']) {
  assert(hardGroundedReviewExecutionPlanSource.includes(token), `Hard grounded review execution plan builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-packet-audit.mjs')), 'Missing hard grounded review packet audit builder.')
const hardGroundedReviewPacketAuditSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-packet-audit.mjs'), 'utf8')
for (const token of ['review-packet-audit.json', 'REVIEW_PACKET_AUDIT.md', 'review_packet_audit_ready', 'finding_count', 'required_reviewer_fields']) {
  assert(hardGroundedReviewPacketAuditSource.includes(token), `Hard grounded review packet audit builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-return-contract.mjs')), 'Missing hard grounded review return contract builder.')
const hardGroundedReviewReturnContractSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-return-contract.mjs'), 'utf8')
for (const token of ['review-return-contract.json', 'REVIEW_RETURN_CONTRACT.md', 'review_return_contract_ready', 'rejection_rules', 'expected_return_files']) {
  assert(hardGroundedReviewReturnContractSource.includes(token), `Hard grounded review return contract builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-return-preflight.mjs')), 'Missing hard grounded review return preflight builder.')
const hardGroundedReviewReturnPreflightSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-return-preflight.mjs'), 'utf8')
for (const token of ['review-return-preflight.json', 'REVIEW_RETURN_PREFLIGHT.md', 'review_return_preflight_ready', 'missing_return_files', 'present_return_files']) {
  assert(hardGroundedReviewReturnPreflightSource.includes(token), `Hard grounded review return preflight builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-return-checklist.mjs')), 'Missing hard grounded review return checklist builder.')
const hardGroundedReviewReturnChecklistSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-return-checklist.mjs'), 'utf8')
for (const token of ['review-return-checklist.json', 'REVIEW_RETURN_CHECKLIST.md', 'review_return_checklist_ready', 'expected_return_file', 'missing_packets']) {
  assert(hardGroundedReviewReturnChecklistSource.includes(token), `Hard grounded review return checklist builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-collection-tracker.mjs')), 'Missing hard grounded review collection tracker builder.')
const hardGroundedReviewCollectionTrackerSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-collection-tracker.mjs'), 'utf8')
for (const token of ['review-collection-tracker.json', 'REVIEW_COLLECTION_TRACKER.md', 'review_collection_tracker_ready', 'pilot_gold_first', 'scale_first_wave', 'completion_claim_allowed: false']) {
  assert(hardGroundedReviewCollectionTrackerSource.includes(token), `Hard grounded review collection tracker builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-gold-adjudication-plan.mjs')), 'Missing hard grounded gold adjudication plan builder.')
const hardGroundedGoldAdjudicationPlanSource = readFileSync(join(root, 'scripts/hard-grounded-research-gold-adjudication-plan.mjs'), 'utf8')
for (const token of ['gold-adjudication-plan.json', 'GOLD_ADJUDICATION_PLAN.md', 'gold_adjudication_plan_ready', 'required_adjudicator_fields', 'promotion_ready_items', 'completion_claim_allowed: false']) {
  assert(hardGroundedGoldAdjudicationPlanSource.includes(token), `Hard grounded gold adjudication plan builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-scale-adjudication-plan.mjs')), 'Missing hard grounded scale adjudication plan builder.')
const hardGroundedScaleAdjudicationPlanSource = readFileSync(join(root, 'scripts/hard-grounded-research-scale-adjudication-plan.mjs'), 'utf8')
for (const token of ['scale-adjudication-plan.json', 'SCALE_ADJUDICATION_PLAN.md', 'scale_adjudication_plan_ready', 'first_wave_exported', 'remaining_items_to_scale_target', 'completion_claim_allowed: false']) {
  assert(hardGroundedScaleAdjudicationPlanSource.includes(token), `Hard grounded scale adjudication plan builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-reproduction-capsule.mjs')), 'Missing hard grounded reproduction capsule builder.')
const hardGroundedReproductionCapsuleSource = readFileSync(join(root, 'scripts/hard-grounded-research-reproduction-capsule.mjs'), 'utf8')
for (const token of ['reproduction-capsule.json', 'REPRODUCTION_CAPSULE.md', 'reproduction_capsule_ready', 'validation_commands', 'expected_blockers']) {
  assert(hardGroundedReproductionCapsuleSource.includes(token), `Hard grounded reproduction capsule builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-citation-metadata.mjs')), 'Missing hard grounded citation metadata builder.')
const hardGroundedCitationMetadataSource = readFileSync(join(root, 'scripts/hard-grounded-research-citation-metadata.mjs'), 'utf8')
for (const token of ['citation-metadata.json', 'CITATION.md', 'citation_metadata_ready', 'citation_caveats', 'bibtex']) {
  assert(hardGroundedCitationMetadataSource.includes(token), `Hard grounded citation metadata builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-public-package-integrity.mjs')), 'Missing hard grounded public package integrity builder.')
const hardGroundedPublicPackageIntegritySource = readFileSync(join(root, 'scripts/hard-grounded-research-public-package-integrity.mjs'), 'utf8')
for (const token of ['public-package-integrity.json', 'PUBLIC_PACKAGE_INTEGRITY.md', 'public_package_integrity_ready', 'pointer_only_text_leaks', 'jsonl_rows']) {
  assert(hardGroundedPublicPackageIntegritySource.includes(token), `Hard grounded public package integrity builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-public-package-schema.mjs')), 'Missing hard grounded public package schema builder.')
const hardGroundedPublicPackageSchemaSource = readFileSync(join(root, 'scripts/hard-grounded-research-public-package-schema.mjs'), 'utf8')
for (const token of ['public-package-schema.json', 'PUBLIC_PACKAGE_SCHEMA.md', 'public_package_schema_ready', 'schema_violations', 'required_item_fields']) {
  assert(hardGroundedPublicPackageSchemaSource.includes(token), `Hard grounded public package schema builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-responsible-use.mjs')), 'Missing hard grounded responsible-use builder.')
const hardGroundedResponsibleUseSource = readFileSync(join(root, 'scripts/hard-grounded-research-responsible-use.mjs'), 'utf8')
for (const token of ['responsible-use.json', 'RESPONSIBLE_USE.md', 'responsible_use_ready', 'public_leaderboard_allowed', 'no_public_leaderboard_before_gold']) {
  assert(hardGroundedResponsibleUseSource.includes(token), `Hard grounded responsible-use builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-data-statement.mjs')), 'Missing hard grounded data statement builder.')
const hardGroundedDataStatementSource = readFileSync(join(root, 'scripts/hard-grounded-research-data-statement.mjs'), 'utf8')
for (const token of ['data-statement.json', 'DATA_STATEMENT.md', 'data_statement_ready', 'out_of_scope_use', 'public_redistribution_clearance_ready']) {
  assert(hardGroundedDataStatementSource.includes(token), `Hard grounded data statement builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-version-manifest.mjs')), 'Missing hard grounded version manifest builder.')
const hardGroundedVersionManifestSource = readFileSync(join(root, 'scripts/hard-grounded-research-version-manifest.mjs'), 'utf8')
for (const token of ['version-manifest.json', 'VERSION_MANIFEST.md', 'version_manifest_ready', 'sha256', 'artifact_count']) {
  assert(hardGroundedVersionManifestSource.includes(token), `Hard grounded version manifest builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-submission-contract.mjs')), 'Missing hard grounded submission contract builder.')
const hardGroundedSubmissionContractSource = readFileSync(join(root, 'scripts/hard-grounded-research-submission-contract.mjs'), 'utf8')
for (const token of ['submission-contract.json', 'SUBMISSION_CONTRACT.md', 'submission_contract_ready', 'evidence_assessment', 'public_leaderboard_allowed']) {
  assert(hardGroundedSubmissionContractSource.includes(token), `Hard grounded submission contract builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-scoring-contract.mjs')), 'Missing hard grounded scoring contract builder.')
const hardGroundedScoringContractSource = readFileSync(join(root, 'scripts/hard-grounded-research-scoring-contract.mjs'), 'utf8')
for (const token of ['scoring-contract.json', 'SCORING_CONTRACT.md', 'scoring_contract_ready', 'citation_faithfulness', 'abstention_quality']) {
  assert(hardGroundedScoringContractSource.includes(token), `Hard grounded scoring contract builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-error-codebook.mjs')), 'Missing hard grounded error codebook builder.')
const hardGroundedErrorCodebookSource = readFileSync(join(root, 'scripts/hard-grounded-research-error-codebook.mjs'), 'utf8')
for (const token of ['error-codebook.json', 'ERROR_CODEBOOK.md', 'error_codebook_ready', 'citation_does_not_support_conclusion', 'temporal_scope_failure']) {
  assert(hardGroundedErrorCodebookSource.includes(token), `Hard grounded error codebook builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-threats-validity.mjs')), 'Missing hard grounded research threats-to-validity builder.')
const hardGroundedThreatsValiditySource = readFileSync(join(root, 'scripts/hard-grounded-research-threats-validity.mjs'), 'utf8')
for (const token of ['threats-validity.json', 'THREATS_TO_VALIDITY.md', 'threats_validity_ready', 'release_check_ids', 'completion_claim_allowed']) {
  assert(hardGroundedThreatsValiditySource.includes(token), `Hard grounded threats-to-validity report is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-failure-atlas.mjs')), 'Missing hard grounded research failure atlas builder.')
const hardGroundedFailureAtlasSource = readFileSync(join(root, 'scripts/hard-grounded-research-failure-atlas.mjs'), 'utf8')
for (const token of ['failure-atlas.json', 'FAILURE_ATLAS.md', 'failure_atlas_ready', 'failure_mode_summary', 'representative_cases']) {
  assert(hardGroundedFailureAtlasSource.includes(token), `Hard grounded failure atlas is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-paper-tables.mjs')), 'Missing hard grounded research paper tables builder.')
const hardGroundedPaperTablesSource = readFileSync(join(root, 'scripts/hard-grounded-research-paper-tables.mjs'), 'utf8')
for (const token of ['paper-tables.json', 'PAPER_TABLES.md', 'paper_tables_ready', 'taxonomy_constructs', 'challenge_type_heatmap', 'novelty_claim_boundaries']) {
  assert(hardGroundedPaperTablesSource.includes(token), `Hard grounded paper tables builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-analysis-plan.mjs')), 'Missing hard grounded research analysis plan builder.')
const hardGroundedAnalysisPlanSource = readFileSync(join(root, 'scripts/hard-grounded-research-analysis-plan.mjs'), 'utf8')
for (const token of ['analysis-plan.json', 'ANALYSIS_PLAN.md', 'analysis_plan_ready', 'hypotheses', 'model_families', 'claim_gates']) {
  assert(hardGroundedAnalysisPlanSource.includes(token), `Hard grounded analysis plan builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-source-diversity-plan.mjs')), 'Missing hard grounded research source diversity plan builder.')
const hardGroundedSourceDiversityPlanSource = readFileSync(join(root, 'scripts/hard-grounded-research-source-diversity-plan.mjs'), 'utf8')
for (const token of ['source-diversity-plan.json', 'SOURCE_DIVERSITY_PLAN.md', 'source_diversity_plan_ready', 'source_row_deficit_total', 'category_source_plan']) {
  assert(hardGroundedSourceDiversityPlanSource.includes(token), `Hard grounded source diversity plan builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-source-acquisition-manifest.mjs')), 'Missing hard grounded research source acquisition manifest builder.')
const hardGroundedSourceAcquisitionManifestSource = readFileSync(join(root, 'scripts/hard-grounded-research-source-acquisition-manifest.mjs'), 'utf8')
for (const token of ['source-acquisition-manifest.json', 'SOURCE_ACQUISITION_MANIFEST.md', 'source_acquisition_manifest_ready', 'acquisition_batches', 'target_new_distinct_source_rows']) {
  assert(hardGroundedSourceAcquisitionManifestSource.includes(token), `Hard grounded source acquisition manifest builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-source-acquisition-packets.mjs')), 'Missing hard grounded research source acquisition packets builder.')
const hardGroundedSourceAcquisitionPacketsSource = readFileSync(join(root, 'scripts/hard-grounded-research-source-acquisition-packets.mjs'), 'utf8')
for (const token of ['source-acquisition-packets.json', 'SOURCE_ACQUISITION_PACKETS.md', 'source_acquisition_packets_ready', 'packet_summaries', 'exclude_source_row_ids']) {
  assert(hardGroundedSourceAcquisitionPacketsSource.includes(token), `Hard grounded source acquisition packets builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-source-acquisition-audit.mjs')), 'Missing hard grounded research source acquisition audit builder.')
const hardGroundedSourceAcquisitionAuditSource = readFileSync(join(root, 'scripts/hard-grounded-research-source-acquisition-audit.mjs'), 'utf8')
for (const token of ['source-acquisition-audit.json', 'SOURCE_ACQUISITION_AUDIT.md', 'source_acquisition_audit_ready', 'packet_audits', 'finding_count']) {
  assert(hardGroundedSourceAcquisitionAuditSource.includes(token), `Hard grounded source acquisition audit builder is missing token: ${token}`)
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
assert(existsSync(join(root, 'scripts/hard-grounded-research-scaled-public-package.mjs')), 'Missing hard grounded research scaled public package builder.')
const hardGroundedScaledPublicPackageSource = readFileSync(join(root, 'scripts/hard-grounded-research-scaled-public-package.mjs'), 'utf8')
for (const token of ['hard-grounded-research-scaled-public-suite.json', 'license_remediated_replacement', 'pointer_only_unknown_license_evidence', 'Pointer-only evidence leaked text']) {
  assert(hardGroundedScaledPublicPackageSource.includes(token), `Hard grounded scaled public package builder is missing packaging token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-import-model-results.mjs')), 'Missing hard grounded research model result importer.')
const hardGroundedModelImportSource = readFileSync(join(root, 'scripts/hard-grounded-research-import-model-results.mjs'), 'utf8')
for (const token of ['--system-id', 'custom_id', 'raw_output_parse_error', 'hard-grounded-research-evaluate.mjs']) {
  assert(hardGroundedModelImportSource.includes(token), `Hard grounded model importer is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-model-baseline-packets.mjs')), 'Missing hard grounded research model baseline packet builder.')
const hardGroundedModelBaselinePacketsSource = readFileSync(join(root, 'scripts/hard-grounded-research-model-baseline-packets.mjs'), 'utf8')
for (const token of ['model-baseline-packets.json', 'frontier-api-grounded-baseline-v1', 'open-weight-grounded-baseline-v1', 'expected-output-template.jsonl']) {
  assert(hardGroundedModelBaselinePacketsSource.includes(token), `Hard grounded model baseline packet builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-baseline-uncertainty.mjs')), 'Missing hard grounded research baseline uncertainty builder.')
const hardGroundedBaselineUncertaintySource = readFileSync(join(root, 'scripts/hard-grounded-research-baseline-uncertainty.mjs'), 'utf8')
for (const token of ['baseline-uncertainty.json', 'baseline-analysis.json', 'paired_comparisons', 'ci95_low', 'uncertainty_ready']) {
  assert(hardGroundedBaselineUncertaintySource.includes(token), `Hard grounded baseline uncertainty builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-novelty-evidence.mjs')), 'Missing hard grounded research novelty evidence builder.')
const hardGroundedNoveltyEvidenceSource = readFileSync(join(root, 'scripts/hard-grounded-research-novelty-evidence.mjs'), 'utf8')
for (const token of ['novelty-evidence.json', 'claim_guidance', 'comparison_dimensions', 'claim_boundaries', 'search_queries', 'temprageval-2025', 'multihop-rag-2024', 'magic-2025', 'faitheval-2024', 'step-context-faithfulness-2026', 'tdbench-2025', 'knowledge-drift-2025', 'plausibly_differentiated_pending_final_audit', 'completion_claim_allowed: false']) {
  assert(hardGroundedNoveltyEvidenceSource.includes(token), `Hard grounded novelty evidence builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-novelty-watchlist.mjs')), 'Missing hard grounded research novelty watchlist builder.')
const hardGroundedNoveltyWatchlistSource = readFileSync(join(root, 'scripts/hard-grounded-research-novelty-watchlist.mjs'), 'utf8')
for (const token of ['novelty-watchlist.json', 'NOVELTY_WATCHLIST.md', 'novelty_watchlist_ready', 'faithjudge-2026', 'faithfulness-qa-2026', 'completion_claim_allowed: false']) {
  assert(hardGroundedNoveltyWatchlistSource.includes(token), `Hard grounded novelty watchlist builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-novelty-resolution-matrix.mjs')), 'Missing hard grounded research novelty resolution matrix builder.')
const hardGroundedNoveltyResolutionMatrixSource = readFileSync(join(root, 'scripts/hard-grounded-research-novelty-resolution-matrix.mjs'), 'utf8')
for (const token of ['novelty-resolution-matrix.json', 'NOVELTY_RESOLUTION_MATRIX.md', 'novelty_resolution_matrix_ready', 'required_boundary_change', 'final_audit_disposition']) {
  assert(hardGroundedNoveltyResolutionMatrixSource.includes(token), `Hard grounded novelty resolution matrix builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-novelty-finalization-preflight.mjs')), 'Missing hard grounded research novelty finalization preflight builder.')
const hardGroundedNoveltyFinalizationPreflightSource = readFileSync(join(root, 'scripts/hard-grounded-research-novelty-finalization-preflight.mjs'), 'utf8')
for (const token of ['novelty-finalization-preflight.json', 'NOVELTY_FINALIZATION_PREFLIGHT.md', 'novelty_finalization_preflight_ready', 'finalization_requirements', 'blocking_conditions', 'final_novelty_claim_allowed: false']) {
  assert(hardGroundedNoveltyFinalizationPreflightSource.includes(token), `Hard grounded novelty finalization preflight builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-novelty-source-review-packets.mjs')), 'Missing hard grounded research novelty source review packets builder.')
const hardGroundedNoveltySourceReviewPacketsSource = readFileSync(join(root, 'scripts/hard-grounded-research-novelty-source-review-packets.mjs'), 'utf8')
for (const token of ['novelty-source-review-packets.json', 'NOVELTY_SOURCE_REVIEW_PACKETS.md', 'novelty_source_review_packets_ready', 'required_reviewer_outputs', 'overlap_assessment']) {
  assert(hardGroundedNoveltySourceReviewPacketsSource.includes(token), `Hard grounded novelty source review packets builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-novelty-claim-revision-plan.mjs')), 'Missing hard grounded research novelty claim revision plan builder.')
const hardGroundedNoveltyClaimRevisionPlanSource = readFileSync(join(root, 'scripts/hard-grounded-research-novelty-claim-revision-plan.mjs'), 'utf8')
for (const token of ['novelty-claim-revision-plan.json', 'NOVELTY_CLAIM_REVISION_PLAN.md', 'novelty_claim_revision_plan_ready', 'required_boundary_language', 'disposition_required']) {
  assert(hardGroundedNoveltyClaimRevisionPlanSource.includes(token), `Hard grounded novelty claim revision plan builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-model-run-index.mjs')), 'Missing hard grounded research model run index.')
const hardGroundedModelRunIndexSource = readFileSync(join(root, 'scripts/hard-grounded-research-model-run-index.mjs'), 'utf8')
for (const token of ['model-run-index.json', 'model-baseline-packets.json', 'eligible_model_baseline', 'import-manifest.json', 'run_requested', 'fixture']) {
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
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-operations.mjs')), 'Missing hard grounded research review operations builder.')
const hardGroundedReviewOperationsSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-operations.mjs'), 'utf8')
for (const token of ['review-operations.json', 'review-triage.json', 'next_work_batches', 'review_operations_ready', 'expansion_review']) {
  assert(hardGroundedReviewOperationsSource.includes(token), `Hard grounded review operations builder is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-triage.mjs')), 'Missing hard grounded research review triage builder.')
const hardGroundedReviewTriageSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-triage.mjs'), 'utf8')
for (const token of ['review-triage.json', 'review_triage_ready', 'eligible_model_baselines', 'all_models_answer_incorrect']) {
  assert(hardGroundedReviewTriageSource.includes(token), `Hard grounded review triage is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-annotation-assignments.mjs')), 'Missing hard grounded research annotation assignments builder.')
const hardGroundedAnnotationAssignmentsSource = readFileSync(join(root, 'scripts/hard-grounded-research-annotation-assignments.mjs'), 'utf8')
for (const token of ['annotation-assignments.json', 'assignment_plan_ready', 'pilot_triage_wave_1', 'expansion_balance_wave_1']) {
  assert(hardGroundedAnnotationAssignmentsSource.includes(token), `Hard grounded annotation assignments is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-annotation-export.mjs')), 'Missing hard grounded research annotation export builder.')
const hardGroundedAnnotationExportSource = readFileSync(join(root, 'scripts/hard-grounded-research-annotation-export.mjs'), 'utf8')
for (const token of ['annotation-export', 'export_ready', 'reviewer_fields_only', 'return_readiness', 'expected_return_row_count', 'return_packet_checks', 'sha256']) {
  assert(hardGroundedAnnotationExportSource.includes(token), `Hard grounded annotation export is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-reviewer-handoff.mjs')), 'Missing hard grounded research reviewer handoff builder.')
const hardGroundedReviewerHandoffSource = readFileSync(join(root, 'scripts/hard-grounded-research-reviewer-handoff.mjs'), 'utf8')
for (const token of ['reviewer-handoff.json', 'REVIEWER_HANDOFF.md', 'acceptance_gates', 'return_readiness', 'return_readiness_present', 'hard-grounded-research-import-annotations.mjs', 'hard-grounded-research-review-merge.mjs']) {
  assert(hardGroundedReviewerHandoffSource.includes(token), `Hard grounded reviewer handoff is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-review-progress.mjs')), 'Missing hard grounded research review progress builder.')
const hardGroundedReviewProgressSource = readFileSync(join(root, 'scripts/hard-grounded-research-review-progress.mjs'), 'utf8')
for (const token of ['review-progress.json', 'REVIEW_PROGRESS.md', 'review_progress_ready', 'pilot_complete_percent', 'reviewed_items_remaining']) {
  assert(hardGroundedReviewProgressSource.includes(token), `Hard grounded review progress is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-adjudication-readiness.mjs')), 'Missing hard grounded research adjudication readiness builder.')
const hardGroundedAdjudicationReadinessSource = readFileSync(join(root, 'scripts/hard-grounded-research-adjudication-readiness.mjs'), 'utf8')
for (const token of ['adjudication-readiness.json', 'ADJUDICATION_READINESS.md', 'adjudication_readiness_ready', 'promotion_preconditions', 'review-resolution-queue.jsonl', 'expansion-review-resolution-queue.jsonl']) {
  assert(hardGroundedAdjudicationReadinessSource.includes(token), `Hard grounded adjudication readiness is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-annotator-agreement.mjs')), 'Missing hard grounded research annotator agreement builder.')
const hardGroundedAnnotatorAgreementSource = readFileSync(join(root, 'scripts/hard-grounded-research-annotator-agreement.mjs'), 'utf8')
for (const token of ['annotator-agreement.json', 'ANNOTATOR_AGREEMENT.md', 'annotator_agreement_ready', 'cohen_kappa', 'agreement_claim_allowed']) {
  assert(hardGroundedAnnotatorAgreementSource.includes(token), `Hard grounded annotator agreement is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-annotation-import-smoke.mjs')), 'Missing hard grounded research annotation import smoke.')
const hardGroundedAnnotationImportSmokeSource = readFileSync(join(root, 'scripts/hard-grounded-research-annotation-import-smoke.mjs'), 'utf8')
for (const token of ['annotation-import-smoke', 'annotation_import_smoke_ready', 'immutable_fields_checked', 'fixture_not_human_review', 'IN_CATEGORY', 'NONE']) {
  assert(hardGroundedAnnotationImportSmokeSource.includes(token), `Hard grounded annotation import smoke is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-import-annotations.mjs')), 'Missing hard grounded research annotation importer.')
const hardGroundedAnnotationImporterSource = readFileSync(join(root, 'scripts/hard-grounded-research-import-annotations.mjs'), 'utf8')
for (const token of ['annotation-import', '--apply', '--allow-fixture', 'annotation_import_ready', 'fixture_annotation_rejected', 'invalid_final_label', 'unknown_required_citation_id', 'invalid_category_fit', 'invalid_generation_defect']) {
  assert(hardGroundedAnnotationImporterSource.includes(token), `Hard grounded annotation importer is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-gold-promotion-smoke.mjs')), 'Missing hard grounded research gold promotion smoke.')
const hardGroundedGoldPromotionSmokeSource = readFileSync(join(root, 'scripts/hard-grounded-research-gold-promotion-smoke.mjs'), 'utf8')
for (const token of ['gold-promotion-smoke', 'gold_promotion_smoke_ready', 'fixture_release_eligible: false', 'gold-suite.fixture.json']) {
  assert(hardGroundedGoldPromotionSmokeSource.includes(token), `Hard grounded gold promotion smoke is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-expansion-promotion-smoke.mjs')), 'Missing hard grounded research expansion promotion smoke.')
const hardGroundedExpansionPromotionSmokeSource = readFileSync(join(root, 'scripts/hard-grounded-research-expansion-promotion-smoke.mjs'), 'utf8')
for (const token of ['expansion-promotion-smoke', 'expansion_promotion_smoke_ready', 'fixture_release_eligible: false', 'unique_items === 270']) {
  assert(hardGroundedExpansionPromotionSmokeSource.includes(token), `Hard grounded expansion promotion smoke is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-scale-plan.mjs')), 'Missing hard grounded research scale plan.')
const hardGroundedScalePlanSource = readFileSync(join(root, 'scripts/hard-grounded-research-scale-plan.mjs'), 'utf8')
for (const token of ['scale-plan.json', 'target_reviewed_items_per_category', 'additional_reviewed_items_needed', 'generation_strategy', 'source_datasets', 'expansion_batches', 'planned_review_rows', 'planned_not_generated', 'scale_ready']) {
  assert(hardGroundedScalePlanSource.includes(token), `Hard grounded scale plan is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-expansion-manifest.mjs')), 'Missing hard grounded research expansion manifest.')
const hardGroundedExpansionManifestSource = readFileSync(join(root, 'scripts/hard-grounded-research-expansion-manifest.mjs'), 'utf8')
for (const token of ['expansion-manifest.json', 'ready_for_generation', 'required_output_schema', 'acceptance_checks', 'source_row_id']) {
  assert(hardGroundedExpansionManifestSource.includes(token), `Hard grounded expansion manifest is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-expansion-candidates.mjs')), 'Missing hard grounded research expansion candidates.')
const hardGroundedExpansionCandidatesSource = readFileSync(join(root, 'scripts/hard-grounded-research-expansion-candidates.mjs'), 'utf8')
for (const token of ['expansion-candidates.json', 'machine_expansion_needs_human_review', 'gold_promotion_allowed: false', 'source_row_ids']) {
  assert(hardGroundedExpansionCandidatesSource.includes(token), `Hard grounded expansion candidates are missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-expansion-review-workbooks.mjs')), 'Missing hard grounded research expansion review workbooks.')
const hardGroundedExpansionReviewWorkbookSource = readFileSync(join(root, 'scripts/hard-grounded-research-expansion-review-workbooks.mjs'), 'utf8')
for (const token of ['expansion-review-workbooks', 'reviewer_a', 'reviewer_b', 'gold_promotion_allowed_before_merge: false', 'category_fit']) {
  assert(hardGroundedExpansionReviewWorkbookSource.includes(token), `Hard grounded expansion review workbooks are missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-expansion-review-preflight.mjs')), 'Missing hard grounded research expansion review preflight.')
const hardGroundedExpansionReviewPreflightSource = readFileSync(join(root, 'scripts/hard-grounded-research-expansion-review-preflight.mjs'), 'utf8')
for (const token of ['expansion-review-preflight.json', 'preflight_ready', 'category_fit', 'generation_defect', 'gold_promotion_allowed']) {
  assert(hardGroundedExpansionReviewPreflightSource.includes(token), `Hard grounded expansion review preflight is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-expansion-review-merge.mjs')), 'Missing hard grounded research expansion review merge.')
const hardGroundedExpansionReviewMergeSource = readFileSync(join(root, 'scripts/hard-grounded-research-expansion-review-merge.mjs'), 'utf8')
for (const token of ['expansion-review-merge-report.json', 'category_fit_agreement_rate', 'generation_defect_agreement_rate', 'gold_promotion_allowed: false']) {
  assert(hardGroundedExpansionReviewMergeSource.includes(token), `Hard grounded expansion review merge is missing token: ${token}`)
}
assert(existsSync(join(root, 'scripts/hard-grounded-research-novelty-audit.mjs')), 'Missing hard grounded research novelty audit generator.')
const hardGroundedNoveltyAuditSource = readFileSync(join(root, 'scripts/hard-grounded-research-novelty-audit.mjs'), 'utf8')
for (const token of ['novelty-audit.json', 'completion_claim_allowed', 'high_novelty_risk_categories', 'claim_boundaries', 'search_queries', 'refresh_provenance', 'refresh_summary', 'TEMPRAGEVAL', 'MultiHop-RAG', 'MAGIC', 'FaithEval', 'OCC-RAG']) {
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
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/novelty-watchlist.json')),
  'Missing hard grounded research novelty watchlist JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/NOVELTY_WATCHLIST.md')),
  'Missing hard grounded research novelty watchlist markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/novelty-resolution-matrix.json')),
  'Missing hard grounded research novelty resolution matrix JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/NOVELTY_RESOLUTION_MATRIX.md')),
  'Missing hard grounded research novelty resolution matrix markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/novelty-finalization-preflight.json')),
  'Missing hard grounded research novelty finalization preflight JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/NOVELTY_FINALIZATION_PREFLIGHT.md')),
  'Missing hard grounded research novelty finalization preflight markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/novelty-source-review-packets.json')),
  'Missing hard grounded research novelty source review packets JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/NOVELTY_SOURCE_REVIEW_PACKETS.md')),
  'Missing hard grounded research novelty source review packets markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/novelty-claim-revision-plan.json')),
  'Missing hard grounded research novelty claim revision plan JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/NOVELTY_CLAIM_REVISION_PLAN.md')),
  'Missing hard grounded research novelty claim revision plan markdown.',
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
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/annotation-export/manifest.json')),
  'Missing hard grounded research annotation export manifest.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ANNOTATION_EXPORT.md')),
  'Missing hard grounded research annotation export report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/reviewer-handoff.json')),
  'Missing hard grounded research reviewer handoff JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEWER_HANDOFF.md')),
  'Missing hard grounded research reviewer handoff markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/review-progress.json')),
  'Missing hard grounded research review progress JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEW_PROGRESS.md')),
  'Missing hard grounded research review progress markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/adjudication-readiness.json')),
  'Missing hard grounded research adjudication readiness JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ADJUDICATION_READINESS.md')),
  'Missing hard grounded research adjudication readiness markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/annotator-agreement.json')),
  'Missing hard grounded research annotator agreement JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ANNOTATOR_AGREEMENT.md')),
  'Missing hard grounded research annotator agreement markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/corpus-audit.json')),
  'Missing hard grounded research corpus audit JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/CORPUS_AUDIT.md')),
  'Missing hard grounded research corpus audit markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/power-plan.json')),
  'Missing hard grounded research power plan JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/POWER_PLAN.md')),
  'Missing hard grounded research power plan markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/construct-map.json')),
  'Missing hard grounded research construct map JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/CONSTRUCT_MAP.md')),
  'Missing hard grounded research construct map markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/artifact-checklist.json')),
  'Missing hard grounded research artifact checklist JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ARTIFACT_CHECKLIST.md')),
  'Missing hard grounded research artifact checklist markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/threats-validity.json')),
  'Missing hard grounded research threats-to-validity JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/THREATS_TO_VALIDITY.md')),
  'Missing hard grounded research threats-to-validity markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/failure-atlas.json')),
  'Missing hard grounded research failure atlas JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/FAILURE_ATLAS.md')),
  'Missing hard grounded research failure atlas markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/paper-tables.json')),
  'Missing hard grounded research paper tables JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/PAPER_TABLES.md')),
  'Missing hard grounded research paper tables markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/analysis-plan.json')),
  'Missing hard grounded research analysis plan JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ANALYSIS_PLAN.md')),
  'Missing hard grounded research analysis plan markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/source-diversity-plan.json')),
  'Missing hard grounded research source diversity plan JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SOURCE_DIVERSITY_PLAN.md')),
  'Missing hard grounded research source diversity plan markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/source-acquisition-manifest.json')),
  'Missing hard grounded research source acquisition manifest JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SOURCE_ACQUISITION_MANIFEST.md')),
  'Missing hard grounded research source acquisition manifest markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/source-acquisition-packets.json')),
  'Missing hard grounded research source acquisition packets JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SOURCE_ACQUISITION_PACKETS.md')),
  'Missing hard grounded research source acquisition packets markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/source-acquisition-packets/source_acq_001.jsonl')),
  'Missing hard grounded research source acquisition packet JSONL.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/source-acquisition-audit.json')),
  'Missing hard grounded research source acquisition audit JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SOURCE_ACQUISITION_AUDIT.md')),
  'Missing hard grounded research source acquisition audit markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/source-acquisition-fetched-rows.json')),
  'Missing hard grounded research source acquisition fetched rows JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/source-acquisition-fetched-rows.jsonl')),
  'Missing hard grounded research source acquisition fetched rows JSONL.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SOURCE_ACQUISITION_FETCHED_ROWS.md')),
  'Missing hard grounded research source acquisition fetched rows markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/source-acquisition-candidates.json')),
  'Missing hard grounded research source acquisition candidates JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/source-acquisition-candidates.jsonl')),
  'Missing hard grounded research source acquisition candidates JSONL.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SOURCE_ACQUISITION_CANDIDATES.md')),
  'Missing hard grounded research source acquisition candidates markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/source-acquisition-review-workbooks/index.json')),
  'Missing hard grounded research source acquisition review workbook index.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SOURCE_ACQUISITION_REVIEW_WORKBOOKS.md')),
  'Missing hard grounded research source acquisition review workbook markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/source-acquisition-review-preflight.json')),
  'Missing hard grounded research source acquisition review preflight JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SOURCE_ACQUISITION_REVIEW_PREFLIGHT.md')),
  'Missing hard grounded research source acquisition review preflight markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/review-calibration.json')),
  'Missing hard grounded research review calibration JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEW_CALIBRATION.md')),
  'Missing hard grounded research review calibration markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/annotation-quality-control.json')),
  'Missing hard grounded research annotation quality-control JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ANNOTATION_QUALITY_CONTROL.md')),
  'Missing hard grounded research annotation quality-control markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/paper-claim-ledger.json')),
  'Missing hard grounded research paper claim ledger JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/PAPER_CLAIM_LEDGER.md')),
  'Missing hard grounded research paper claim ledger markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/supplement-index.json')),
  'Missing hard grounded research supplement index JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SUPPLEMENT_INDEX.md')),
  'Missing hard grounded research supplement index markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/reviewer-faq.json')),
  'Missing hard grounded research reviewer FAQ JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEWER_FAQ.md')),
  'Missing hard grounded research reviewer FAQ markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/model-reporting-card.json')),
  'Missing hard grounded research model reporting card JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/MODEL_REPORTING_CARD.md')),
  'Missing hard grounded research model reporting card markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/review-execution-plan.json')),
  'Missing hard grounded research review execution plan JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEW_EXECUTION_PLAN.md')),
  'Missing hard grounded research review execution plan markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/review-packet-audit.json')),
  'Missing hard grounded research review packet audit JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEW_PACKET_AUDIT.md')),
  'Missing hard grounded research review packet audit markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/review-return-contract.json')),
  'Missing hard grounded research review return contract JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEW_RETURN_CONTRACT.md')),
  'Missing hard grounded research review return contract markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/review-return-preflight.json')),
  'Missing hard grounded research review return preflight JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEW_RETURN_PREFLIGHT.md')),
  'Missing hard grounded research review return preflight markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/review-return-checklist.json')),
  'Missing hard grounded research review return checklist JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEW_RETURN_CHECKLIST.md')),
  'Missing hard grounded research review return checklist markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/review-collection-tracker.json')),
  'Missing hard grounded research review collection tracker JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REVIEW_COLLECTION_TRACKER.md')),
  'Missing hard grounded research review collection tracker markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/gold-adjudication-plan.json')),
  'Missing hard grounded research gold adjudication plan JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/GOLD_ADJUDICATION_PLAN.md')),
  'Missing hard grounded research gold adjudication plan markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/scale-adjudication-plan.json')),
  'Missing hard grounded research scale adjudication plan JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SCALE_ADJUDICATION_PLAN.md')),
  'Missing hard grounded research scale adjudication plan markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/reproduction-capsule.json')),
  'Missing hard grounded research reproduction capsule JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/REPRODUCTION_CAPSULE.md')),
  'Missing hard grounded research reproduction capsule markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/citation-metadata.json')),
  'Missing hard grounded research citation metadata JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/CITATION.md')),
  'Missing hard grounded research citation metadata markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/public-package-integrity.json')),
  'Missing hard grounded research public package integrity JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/PUBLIC_PACKAGE_INTEGRITY.md')),
  'Missing hard grounded research public package integrity markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/public-package-schema.json')),
  'Missing hard grounded research public package schema JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/PUBLIC_PACKAGE_SCHEMA.md')),
  'Missing hard grounded research public package schema markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/responsible-use.json')),
  'Missing hard grounded research responsible-use JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/RESPONSIBLE_USE.md')),
  'Missing hard grounded research responsible-use markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/data-statement.json')),
  'Missing hard grounded research data statement JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/DATA_STATEMENT.md')),
  'Missing hard grounded research data statement markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/version-manifest.json')),
  'Missing hard grounded research version manifest JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/VERSION_MANIFEST.md')),
  'Missing hard grounded research version manifest markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/submission-contract.json')),
  'Missing hard grounded research submission contract JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SUBMISSION_CONTRACT.md')),
  'Missing hard grounded research submission contract markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/scoring-contract.json')),
  'Missing hard grounded research scoring contract JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/SCORING_CONTRACT.md')),
  'Missing hard grounded research scoring contract markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/error-codebook.json')),
  'Missing hard grounded research error codebook JSON.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ERROR_CODEBOOK.md')),
  'Missing hard grounded research error codebook markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/report.json')),
  'Missing hard grounded research annotation import smoke report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ANNOTATION_IMPORT_SMOKE.md')),
  'Missing hard grounded research annotation import smoke markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/annotation-import/report.json')),
  'Missing hard grounded research annotation import report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/ANNOTATION_IMPORT.md')),
  'Missing hard grounded research annotation import markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/gold-promotion-smoke/report.json')),
  'Missing hard grounded research gold promotion smoke report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/GOLD_PROMOTION_SMOKE.md')),
  'Missing hard grounded research gold promotion smoke markdown.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/generated/expansion-promotion-smoke/report.json')),
  'Missing hard grounded research expansion promotion smoke report.',
)
assert(
  existsSync(join(root, 'docs/experiments/hard-grounded-research-benchmark/EXPANSION_PROMOTION_SMOKE.md')),
  'Missing hard grounded research expansion promotion smoke markdown.',
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
