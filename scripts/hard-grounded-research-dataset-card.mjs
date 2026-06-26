import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const datasetCardPath = join(experimentDir, 'DATASET_CARD.md')

const inputPaths = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  coverageMatrix: join(generatedDir, 'coverage-matrix.json'),
  itemQualityAudit: join(generatedDir, 'item-quality-audit.json'),
  reviewMergeReport: join(generatedDir, 'review-merge-report.json'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  failureAtlas: join(generatedDir, 'failure-atlas.json'),
  errorCodebook: join(generatedDir, 'error-codebook.json'),
  paperTables: join(generatedDir, 'paper-tables.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
  supplementIndex: join(generatedDir, 'supplement-index.json'),
  citationMetadata: join(generatedDir, 'citation-metadata.json'),
  reviewerFaq: join(generatedDir, 'reviewer-faq.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  modelReportingCard: join(generatedDir, 'model-reporting-card.json'),
  submissionContract: join(generatedDir, 'submission-contract.json'),
  scoringContract: join(generatedDir, 'scoring-contract.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  sourceDiversityPlan: join(generatedDir, 'source-diversity-plan.json'),
  sourceAcquisitionManifest: join(generatedDir, 'source-acquisition-manifest.json'),
  sourceAcquisitionPackets: join(generatedDir, 'source-acquisition-packets.json'),
  sourceAcquisitionAudit: join(generatedDir, 'source-acquisition-audit.json'),
  sourceAcquisitionFetchedRows: join(generatedDir, 'source-acquisition-fetched-rows.json'),
  sourceAcquisitionCandidates: join(generatedDir, 'source-acquisition-candidates.json'),
  sourceAcquisitionReviewWorkbooks: join(generatedDir, 'source-acquisition-review-workbooks/index.json'),
  sourceAcquisitionReviewPreflight: join(generatedDir, 'source-acquisition-review-preflight.json'),
  constructMap: join(generatedDir, 'construct-map.json'),
  artifactChecklist: join(generatedDir, 'artifact-checklist.json'),
  threatsValidity: join(generatedDir, 'threats-validity.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  noveltyAudit: join(generatedDir, 'novelty-audit.json'),
  noveltyWatchlist: join(generatedDir, 'novelty-watchlist.json'),
  noveltyResolutionMatrix: join(generatedDir, 'novelty-resolution-matrix.json'),
  noveltyFinalizationPreflight: join(generatedDir, 'novelty-finalization-preflight.json'),
  noveltySourceReviewPackets: join(generatedDir, 'novelty-source-review-packets.json'),
  noveltyClaimRevisionPlan: join(generatedDir, 'novelty-claim-revision-plan.json'),
  noveltyLinkAudit: join(generatedDir, 'novelty-link-audit.json'),
  noveltyReplacementCandidates: join(generatedDir, 'novelty-replacement-candidates.json'),
  noveltyOverlapAdjudication: join(generatedDir, 'novelty-overlap-adjudication.json'),
  licenseReview: join(generatedDir, 'license-review.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  publicPackageIntegrity: join(generatedDir, 'public-package-integrity.json'),
  publicPackageSchema: join(generatedDir, 'public-package-schema.json'),
  responsibleUse: join(generatedDir, 'responsible-use.json'),
  dataStatement: join(generatedDir, 'data-statement.json'),
  versionManifest: join(generatedDir, 'version-manifest.json'),
  reviewExecutionPlan: join(generatedDir, 'review-execution-plan.json'),
  reviewPacketAudit: join(generatedDir, 'review-packet-audit.json'),
  reviewReturnContract: join(generatedDir, 'review-return-contract.json'),
  reviewReturnPreflight: join(generatedDir, 'review-return-preflight.json'),
  reviewReturnChecklist: join(generatedDir, 'review-return-checklist.json'),
  reviewCollectionTracker: join(generatedDir, 'review-collection-tracker.json'),
  reviewWaveSchedule: join(generatedDir, 'review-wave-schedule.json'),
  reviewDropoffManifest: join(generatedDir, 'review-dropoff-manifest.json'),
  goldAdjudicationPlan: join(generatedDir, 'gold-adjudication-plan.json'),
  scaleAdjudicationPlan: join(generatedDir, 'scale-adjudication-plan.json'),
  reproductionCapsule: join(generatedDir, 'reproduction-capsule.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  annotationProtocol: join(generatedDir, 'annotation-protocol.json'),
  adjudicationReadiness: join(generatedDir, 'adjudication-readiness.json'),
  annotatorAgreement: join(generatedDir, 'annotator-agreement.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  reviewCalibration: join(generatedDir, 'review-calibration.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
  annotationImport: join(generatedDir, 'annotation-import/report.json'),
  annotationImportSmoke: join(generatedDir, 'annotation-import-smoke/report.json'),
  goldPromotionSmoke: join(generatedDir, 'gold-promotion-smoke/report.json'),
  expansionPromotionSmoke: join(generatedDir, 'expansion-promotion-smoke/report.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function datasetRows(spec) {
  return spec.datasets.map((dataset) => [
    dataset.id,
    dataset.license || 'unknown',
    dataset.url,
    dataset.covers.join('<br>'),
  ])
}

function categoryRows(coverageMatrix) {
  return coverageMatrix.map((row) => [
    row.category,
    String(row.dataset_count),
    String(row.task_count),
    row.datasets.join('<br>'),
  ])
}

function challengeRows(pilotSuite) {
  const counts = new Map()
  for (const item of pilotSuite.items) {
    const challengeType = item.challenge?.type || 'native_row'
    counts.set(challengeType, (counts.get(challengeType) || 0) + 1)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([challengeType, count]) => [challengeType, String(count)])
}

function checkDetail(releaseGate, id) {
  const check = releaseGate.checks.find((candidate) => candidate.id === id)
  return check ? `${check.passed ? 'pass' : 'block'} - ${check.detail}` : 'not reported'
}

function modelRows(modelRunIndex) {
  return modelRunIndex.runs
    .filter((run) => run.eligible_model_baseline)
    .map((run) => [
      run.system_id,
      run.evaluation_source,
      String(run.task_count),
      String(run.macro_answer_correct),
      run.report_present ? 'yes' : 'no',
    ])
}

function expansionSmokeTotals(expansionPromotionSmoke) {
  return Object.values(expansionPromotionSmoke.category_summary).reduce(
    (totals, row) => ({
      total: totals.total + row.total_items,
      mergeReady: totals.mergeReady + row.merge_ready_items,
    }),
    { total: 0, mergeReady: 0 },
  )
}

function renderCard({
  spec,
  pilotSuite,
  coverageMatrix,
  itemQualityAudit,
  reviewMergeReport,
  goldSummary,
  baselineAnalysis,
  failureAtlas,
  errorCodebook,
  paperTables,
  analysisPlan,
  paperClaimLedger,
  supplementIndex,
  citationMetadata,
  reviewerFaq,
  modelRunIndex,
  modelReportingCard,
  submissionContract,
  scoringContract,
  corpusAudit,
  sourceDiversityPlan,
  sourceAcquisitionManifest,
  sourceAcquisitionPackets,
  sourceAcquisitionAudit,
  sourceAcquisitionFetchedRows,
  sourceAcquisitionCandidates,
  sourceAcquisitionReviewWorkbooks,
  sourceAcquisitionReviewPreflight,
  constructMap,
  artifactChecklist,
  threatsValidity,
  powerPlan,
  noveltyAudit,
  noveltyWatchlist,
  noveltyResolutionMatrix,
  noveltyFinalizationPreflight,
  noveltySourceReviewPackets,
  noveltyClaimRevisionPlan,
  noveltyLinkAudit,
  noveltyReplacementCandidates,
  noveltyOverlapAdjudication,
  licenseReview,
  licenseClearance,
  packageManifest,
  publicPackageIntegrity,
  publicPackageSchema,
  responsibleUse,
  dataStatement,
  versionManifest,
  reviewExecutionPlan,
  reviewPacketAudit,
  reviewReturnContract,
  reviewReturnPreflight,
  reviewReturnChecklist,
  reviewCollectionTracker,
  reviewWaveSchedule,
  reviewDropoffManifest,
  goldAdjudicationPlan,
  scaleAdjudicationPlan,
  reproductionCapsule,
  releaseGate,
  annotationProtocol,
  adjudicationReadiness,
  annotatorAgreement,
  annotationExport,
  reviewCalibration,
  annotationQualityControl,
  annotationImport,
  annotationImportSmoke,
  goldPromotionSmoke,
  expansionPromotionSmoke,
}) {
  const expansionSmoke = expansionSmokeTotals(expansionPromotionSmoke)

  return `# Hard Grounded Research Dataset Card

Status: pilot benchmark card generated from repository artifacts. This is not a final public release card until gold review is complete.

## Dataset Summary

Hard Grounded Research is a pilot benchmark for grounded research QA failure modes that go beyond simple fact lookup. Items are derived from public Hugging Face datasets and transformed into tasks that test document-state reasoning, source authority, temporal validity, evidence sufficiency, table/text interpretation, citation overreach, entity disambiguation, and contradiction handling.

- Benchmark id: \`${spec.id}\`
- Pilot items: ${pilotSuite.items.length}
- Categories: ${spec.categories.length}
- Source Hugging Face datasets: ${spec.datasets.length}
- Scaled public source rows: ${corpusAudit.summary.scaled_public_source_rows}
- Scaled public evidence units: ${corpusAudit.summary.scaled_public_evidence_units}
- Source diversity target rows: ${sourceDiversityPlan.summary.current_distinct_source_rows}/${sourceDiversityPlan.summary.target_distinct_source_rows_total}
- Source diversity deficit: ${sourceDiversityPlan.summary.source_row_deficit_total}
- Source acquisition batches: ${sourceAcquisitionManifest.summary.acquisition_batches}
- Source acquisition target rows: ${sourceAcquisitionManifest.summary.target_new_distinct_source_rows}
- Source acquisition packets: ${sourceAcquisitionPackets.summary.packet_count}
- Source acquisition audit findings: ${sourceAcquisitionAudit.summary.finding_count}
- Source acquisition fetched rows: ${sourceAcquisitionFetchedRows.summary.fetched_rows}/${sourceAcquisitionFetchedRows.summary.requested_rows}
- Source acquisition candidates: ${sourceAcquisitionCandidates.summary.candidates}
- Source acquisition review rows: ${sourceAcquisitionReviewWorkbooks.total_review_rows}
- Source acquisition complete review rows: ${sourceAcquisitionReviewPreflight.complete_review_rows}/${sourceAcquisitionReviewPreflight.total_review_rows}
- Construct map ready: ${constructMap.construct_map_ready} (${constructMap.summary.ready_constructs}/${constructMap.summary.category_count} constructs)
- Artifact checklist ready: ${artifactChecklist.artifact_checklist_ready} (${artifactChecklist.summary.artifact_classes_ready}/${artifactChecklist.summary.artifact_classes_total} artifact classes)
- Threats-to-validity ready: ${threatsValidity.threats_validity_ready} (${threatsValidity.summary.threat_count} threats; ${threatsValidity.summary.high_severity_count} high severity)
- Failure atlas ready: ${failureAtlas.failure_atlas_ready} (${failureAtlas.summary.failure_case_count} cases; ${failureAtlas.summary.failure_mode_count} modes)
- Paper tables ready: ${paperTables.paper_tables_ready} (${paperTables.summary.table_count} tables)
- Analysis plan ready: ${analysisPlan.analysis_plan_ready} (${analysisPlan.summary.hypotheses} hypotheses; ${analysisPlan.summary.model_families} model families)
- Paper target reviewed items/category: ${powerPlan.assumptions.target_reviewed_items_per_category}
- Paper target reviewed items total: ${powerPlan.assumptions.target_reviewed_items_total}
- Novelty watchlist ready: ${noveltyWatchlist.novelty_watchlist_ready} (${noveltyWatchlist.summary.watchlist_source_count} sources)
- Novelty resolution matrix ready: ${noveltyResolutionMatrix.novelty_resolution_matrix_ready} (${noveltyResolutionMatrix.summary.unresolved_sources} unresolved sources)
- Novelty finalization preflight ready: ${noveltyFinalizationPreflight.novelty_finalization_preflight_ready} (${noveltyFinalizationPreflight.summary.unresolved_sources} unresolved sources)
- Novelty source review packets ready: ${noveltySourceReviewPackets.novelty_source_review_packets_ready} (${noveltySourceReviewPackets.summary.packets} packets)
- Novelty claim revision plan ready: ${noveltyClaimRevisionPlan.novelty_claim_revision_plan_ready} (${noveltyClaimRevisionPlan.summary.revisions} revisions)
- Novelty link audit ready: ${noveltyLinkAudit.novelty_link_audit_ready} (${noveltyLinkAudit.summary.quarantined_sources} quarantined sources)
- Novelty replacement candidates ready: ${noveltyReplacementCandidates.novelty_replacement_candidates_ready} (${noveltyReplacementCandidates.summary.candidates} candidates)
- Novelty overlap adjudication ready: ${noveltyOverlapAdjudication.novelty_overlap_adjudication_ready} (${noveltyOverlapAdjudication.summary.pending_dispositions} pending dispositions)
- Gold ready: ${goldSummary.gold_ready}
- Valid reviewed items: ${goldSummary.valid_reviewed_items}/${goldSummary.total_items}
- Release gate status: ${releaseGate.status}
- License review status: ${licenseReview.status}
- Public redistribution clearance ready: ${licenseClearance.public_redistribution_clearance_ready}
- Pointer-only package items: ${packageManifest.pointer_only_items}
- Public package integrity ready: ${publicPackageIntegrity.public_package_integrity_ready}
- Public package schema ready: ${publicPackageSchema.public_package_schema_ready}
- Eligible external model baselines: ${modelRunIndex.eligible_model_baseline_count}
- Model reporting card ready: ${modelReportingCard.model_reporting_card_ready}
- Review execution plan ready: ${reviewExecutionPlan.review_execution_plan_ready}
- Review packet audit ready: ${reviewPacketAudit.review_packet_audit_ready}
- Review return contract ready: ${reviewReturnContract.review_return_contract_ready}
- Review return preflight ready: ${reviewReturnPreflight.review_return_preflight_ready} (${reviewReturnPreflight.summary.present_return_files}/${reviewReturnPreflight.summary.expected_return_files} returned files present)
- Review return checklist ready: ${reviewReturnChecklist.review_return_checklist_ready} (${reviewReturnChecklist.summary.missing_packets} packets missing)
- Review collection tracker ready: ${reviewCollectionTracker.review_collection_tracker_ready} (${reviewCollectionTracker.summary.missing_packets} packets missing)
- Review wave schedule ready: ${reviewWaveSchedule.review_wave_schedule_ready} (${reviewWaveSchedule.summary.waves} waves; ${reviewWaveSchedule.summary.scheduled_missing_packets} packets scheduled)
- Review dropoff manifest ready: ${reviewDropoffManifest.review_dropoff_manifest_ready} (${reviewDropoffManifest.summary.packets} packets; ${reviewDropoffManifest.summary.export_hashes} hashes)
- Gold adjudication plan ready: ${goldAdjudicationPlan.gold_adjudication_plan_ready} (${goldAdjudicationPlan.summary.missing_reviews} missing reviews)
- Scale adjudication plan ready: ${scaleAdjudicationPlan.scale_adjudication_plan_ready} (${scaleAdjudicationPlan.summary.missing_review_rows} missing review rows)

## Intended Uses

- Evaluate grounded research QA systems under adversarial evidence-use conditions.
- Diagnose whether failures come from answer selection, citation coverage, conclusion support, abstention, temporal validity, or contradiction handling.
- Support a benchmark/position paper about what makes grounded research hard beyond lookup.

## Out-of-Scope Uses

- Do not treat the current pilot as final gold data.
- Do not use mechanically seeded labels as human-validated truth.
- Do not compare production systems as a leaderboard until double review, disagreement resolution, and novelty refresh are complete.

## Source Datasets

${markdownTable(['Dataset', 'License', 'HF URL', 'Benchmark roles'], datasetRows(spec))}

## Category Coverage

${markdownTable(['Category', 'Datasets', 'Seed tasks', 'Dataset ids'], categoryRows(coverageMatrix))}

The generated construct map links each category to rubric dimensions, pilot examples, challenge payloads, scoring metrics, novelty risk, and review status. High novelty-risk constructs: ${constructMap.summary.high_novelty_risk_constructs}; constructs with reviewed gold: ${constructMap.summary.constructs_with_reviewed_gold}. See \`CONSTRUCT_MAP.md\`.

## Source Diversity

The current scaled public package has ${sourceDiversityPlan.summary.current_distinct_source_rows} distinct source rows against a paper target of ${sourceDiversityPlan.summary.target_distinct_source_rows_total}. The generated source-diversity plan records a ${sourceDiversityPlan.summary.source_row_deficit_total}-row deficit and category-level acquisition targets so large-corpus claims cannot rely on cloned seed rows. See \`SOURCE_DIVERSITY_PLAN.md\`.

The generated source acquisition manifest converts that deficit into ${sourceAcquisitionManifest.summary.acquisition_batches} Hugging Face sampling batches covering ${sourceAcquisitionManifest.summary.target_new_distinct_source_rows} target new distinct source rows. Known-license target rows: ${sourceAcquisitionManifest.summary.known_license_target_rows}; pointer-only target rows: ${sourceAcquisitionManifest.summary.pointer_only_target_rows}. See \`SOURCE_ACQUISITION_MANIFEST.md\`.

The generated acquisition packet set materializes ${sourceAcquisitionPackets.summary.packet_count} JSONL packet files with ${sourceAcquisitionPackets.summary.target_new_distinct_source_rows} target row slots under \`generated/source-acquisition-packets/\`. See \`SOURCE_ACQUISITION_PACKETS.md\`.

The generated packet audit validates ${sourceAcquisitionAudit.summary.audited_rows}/${sourceAcquisitionAudit.summary.expected_rows} packet rows with ${sourceAcquisitionAudit.summary.finding_count} findings. See \`SOURCE_ACQUISITION_AUDIT.md\`.

The generated source acquisition fetch report executes the packets against Hugging Face and records ${sourceAcquisitionFetchedRows.summary.fetched_rows}/${sourceAcquisitionFetchedRows.summary.requested_rows} distinct source-row records with ${sourceAcquisitionFetchedRows.summary.finding_count} findings. These fetched rows still require task materialization, deduplication against final public artifacts, reviewer export, double review, and adjudication before source-diversity targets can support paper claims. See \`SOURCE_ACQUISITION_FETCHED_ROWS.md\`.

The generated source acquisition candidate suite materializes those fetched rows into ${sourceAcquisitionCandidates.summary.candidates} review-pending task drafts requiring ${sourceAcquisitionCandidates.summary.required_review_rows} independent review rows. It remains blocked from gold promotion. See \`SOURCE_ACQUISITION_CANDIDATES.md\`.

The generated source acquisition review workbook index creates ${sourceAcquisitionReviewWorkbooks.workbook_count} workbooks with ${sourceAcquisitionReviewWorkbooks.total_review_rows} review rows. Pointer-only review rows: ${sourceAcquisitionReviewWorkbooks.pointer_only_review_rows}. See \`SOURCE_ACQUISITION_REVIEW_WORKBOOKS.md\`.

The generated source acquisition review preflight checks those workbooks and currently reports ${sourceAcquisitionReviewPreflight.complete_review_rows}/${sourceAcquisitionReviewPreflight.total_review_rows} complete review rows. It defines the returned-review validation target while keeping promotion blocked. See \`SOURCE_ACQUISITION_REVIEW_PREFLIGHT.md\`.

## Challenge-Type Coverage

${markdownTable(['Challenge type', 'Pilot items'], challengeRows(pilotSuite))}

## Annotation And Review

- Annotation protocol: \`ANNOTATION_PROTOCOL.md\`
- Review workbooks: \`generated/review-workbooks/*.jsonl\`
- Annotation export: ${annotationExport.export_ready ? 'ready' : 'not ready'} (${annotationExport.totals.row_count} rows across ${annotationExport.totals.file_count} files)
- Reviewer calibration: ${reviewCalibration.review_calibration_ready ? 'ready' : 'not ready'} (${reviewCalibration.sentinel_count} sentinels; minimum accuracy=${reviewCalibration.acceptance_policy.minimum_accuracy}; gold promotion allowed=${reviewCalibration.gold_promotion_allowed})
- Annotation quality control: ${annotationQualityControl.annotation_quality_control_ready ? 'ready' : 'not ready'} (${annotationQualityControl.workload.total_review_rows} governed review rows; sentinel rows in gold=${annotationQualityControl.thresholds.allow_sentinel_rows_in_gold})
- Annotation import path: ${annotationImport.annotation_import_ready ? 'ready' : 'not ready'} (${annotationImport.rows_importable}/${annotationImport.rows_checked} fixture rows importable; applied=${annotationImport.applied_to_workbooks})
- Annotation import smoke: ${annotationImportSmoke.annotation_import_smoke_ready ? 'ready' : 'not ready'} (${annotationImportSmoke.rows_checked} returned fixture rows checked; findings=${annotationImportSmoke.finding_count})
- Adjudication readiness: ${adjudicationReadiness.adjudication_readiness_ready ? 'ready' : 'not ready'} (pilot queue=${adjudicationReadiness.summary.pilot_resolution_queue_items}; expansion queue=${adjudicationReadiness.summary.expansion_resolution_queue_items}; promotion_allowed=${adjudicationReadiness.release_promotion_allowed})
- Annotator agreement: ${annotatorAgreement.annotator_agreement_ready ? 'ready' : 'not ready'} (completed metric pairs=${annotatorAgreement.summary.completed_metric_pairs}; claim_allowed=${annotatorAgreement.summary.agreement_claim_allowed})
- Independent reviews required per item: 2
- Required reviewer fields: ${annotationProtocol.required_reviewer_fields.map((field) => `\`${field}\``).join(', ')}
- Missing-review items: ${reviewMergeReport.missing_review_items}
- Disagreement items: ${reviewMergeReport.disagreement_items}
- Repair-before-gold items: ${itemQualityAudit.repair_before_gold}
- Review-carefully items: ${itemQualityAudit.review_carefully}
- Exact agreement rate: ${reviewMergeReport.agreement?.exact_agreement_rate ?? 'n/a'}
- Label agreement rate: ${reviewMergeReport.agreement?.label_agreement_rate ?? 'n/a'}

## Promotion Rehearsals

- Pilot gold promotion smoke: ${goldPromotionSmoke.gold_promotion_smoke_ready ? 'ready' : 'not ready'} (${goldPromotionSmoke.gold_summary.valid_reviewed_items}/${goldPromotionSmoke.gold_summary.total_items} fixture gold items; release_eligible=${goldPromotionSmoke.fixture_release_eligible})
- Scaled expansion promotion smoke: ${expansionPromotionSmoke.expansion_promotion_smoke_ready ? 'ready' : 'not ready'} (${expansionSmoke.mergeReady}/${expansionSmoke.total} fixture expansion items merge-ready; release_eligible=${expansionPromotionSmoke.fixture_release_eligible})
- These rehearsals use fixture reviewer fields only. They prove the mechanics of merge and promotion; they do not clear human-review blockers.

## Scoring

The evaluator reports answer correctness, evidence recall, citation precision, citation faithfulness, conclusion support, and abstention quality. Challenge-type diagnostics are present for ${baselineAnalysis.systems.length} scored baseline systems in \`generated/baseline-analysis.json\`.

## Failure Atlas

The generated failure atlas summarizes ${failureAtlas.summary.failure_case_count} pilot failure cases across ${failureAtlas.summary.failure_mode_count} failure modes from ${failureAtlas.summary.scored_systems} scored systems. It is qualitative diagnostic evidence only and remains blocked from completion claims while release status is \`${failureAtlas.summary.release_gate_status}\`. See \`FAILURE_ATLAS.md\`.

The generated error codebook defines ${errorCodebook.summary.code_count} qualitative error codes and ${errorCodebook.summary.reviewer_rule_count} reviewer coding rules for pilot and future gold analysis. It keeps qualitative claims diagnostic-only until human review, scale, and novelty gates pass. See \`ERROR_CODEBOOK.md\`.

## Paper Tables

The generated paper table pack materializes ${paperTables.summary.table_count} synchronized tables for taxonomy, baseline results, challenge diagnostics, failure modes, novelty boundaries, and release blockers. See \`PAPER_TABLES.md\` and \`generated/paper-tables.json\`.

## Analysis Plan

The generated analysis plan pre-specifies ${analysisPlan.summary.hypotheses} hypotheses, ${analysisPlan.summary.model_families} model families, and ${analysisPlan.summary.covariates} covariates for testing what makes grounded research hard beyond lookup. It keeps category-level and final novelty claims blocked until reviewed gold and final literature gates pass. See \`ANALYSIS_PLAN.md\`.

The generated novelty watchlist records ${noveltyWatchlist.summary.watchlist_source_count} live-search related-work sources, including ${noveltyWatchlist.summary.high_risk_source_count} high-risk sources, that must be resolved before final novelty claims. It keeps completion claims blocked. See \`NOVELTY_WATCHLIST.md\`.

The generated novelty resolution matrix maps those watchlist sources to source-level claim impacts: ${noveltyResolutionMatrix.summary.watchlist_sources} sources, ${noveltyResolutionMatrix.summary.unresolved_sources} unresolved, and ${noveltyResolutionMatrix.summary.high_risk_sources} high-risk. See \`NOVELTY_RESOLUTION_MATRIX.md\`.

The generated novelty finalization preflight records the exact remaining work before any final novelty claim: ${noveltyFinalizationPreflight.summary.unresolved_sources} unresolved watchlist sources, ${noveltyFinalizationPreflight.summary.high_risk_unresolved_sources} high-risk unresolved sources, and ${noveltyFinalizationPreflight.summary.novelty_release_blockers} novelty release blockers. See \`NOVELTY_FINALIZATION_PREFLIGHT.md\`.

The generated novelty source review packets turn unresolved watchlist sources into ${noveltySourceReviewPackets.summary.packets} related-work adjudication tasks, including ${noveltySourceReviewPackets.summary.high_risk_packets} high-risk packet. See \`NOVELTY_SOURCE_REVIEW_PACKETS.md\`.

The generated novelty claim revision plan maps those packets into ${noveltyClaimRevisionPlan.summary.revisions} manuscript revision actions across ${noveltyClaimRevisionPlan.summary.linked_claims} linked claims. It preserves the final novelty and completion blockers until source dispositions and boundary language are resolved. See \`NOVELTY_CLAIM_REVISION_PLAN.md\`.

The generated novelty link audit quarantines ${noveltyLinkAudit.summary.quarantined_sources}/${noveltyLinkAudit.summary.checked_sources} unresolved related-work links whose recorded URL is missing, mismatched, or not verified as a primary source. See \`NOVELTY_LINK_AUDIT.md\`.

The generated novelty replacement-candidate report maps quarantined sources to ${noveltyReplacementCandidates.summary.candidates} related-work candidates, including ${noveltyReplacementCandidates.summary.verified_title_match_candidates} verified title matches and ${noveltyReplacementCandidates.summary.candidate_title_conflicts} explicitly caveated title conflict. See \`NOVELTY_REPLACEMENT_CANDIDATES.md\`.

The generated novelty overlap adjudication worksheet maps those candidates to ${noveltyOverlapAdjudication.summary.high_overlap_candidates} high-overlap and ${noveltyOverlapAdjudication.summary.medium_overlap_candidates} medium-overlap review rows with ${noveltyOverlapAdjudication.summary.pending_dispositions} pending reviewer dispositions. See \`NOVELTY_OVERLAP_ADJUDICATION.md\`.

## Paper Claim Ledger

The generated claim ledger maps ${paperClaimLedger.summary.claims} manuscript claims to current evidence and release gates: ${paperClaimLedger.summary.allowed_claims} allowed, ${paperClaimLedger.summary.diagnostic_only_claims} diagnostic-only, and ${paperClaimLedger.summary.prohibited_claims} prohibited until gates pass. See \`PAPER_CLAIM_LEDGER.md\`.

## Supplement Index

The generated supplement index maps ${supplementIndex.summary.sections} supplement sections, ${supplementIndex.summary.paper_tables} paper tables, and ${supplementIndex.summary.claims} claims to source artifacts for reviewer navigation. See \`SUPPLEMENT_INDEX.md\`.

## Citation Metadata

The generated citation metadata defines \`${citationMetadata.citation_key}\`, records ${citationMetadata.summary.citation_caveats} citation caveats, and ties the citation to ${citationMetadata.summary.artifact_hashes} version-manifest artifact hashes. It keeps completion and leaderboard claims blocked in citation text. See \`CITATION.md\`.

## Reviewer FAQ

The generated reviewer FAQ answers ${reviewerFaq.summary.questions} likely reviewer objections using current release blockers, novelty boundaries, data-package facts, and validity risks. See \`REVIEWER_FAQ.md\`.

## Statistical Scale Plan

The current pilot supports diagnostic analysis only. The generated power plan targets ${powerPlan.assumptions.target_reviewed_items_per_category} double-reviewed items per category (${powerPlan.assumptions.target_reviewed_items_total} total) before category-level paper claims. At the category target, the worst-case 95% half-width for bounded task metrics is ${powerPlan.sample_size_scenarios.find((scenario) => scenario.scope === 'paper_target_per_category')?.ci95_half_width_worst_case}; at the overall target it is ${powerPlan.sample_size_scenarios.find((scenario) => scenario.scope === 'paper_target_overall')?.ci95_half_width_worst_case}. See \`POWER_PLAN.md\`.

## Reproducibility Artifact Checklist

The generated artifact checklist records ${artifactChecklist.summary.reproduction_commands} reproduction commands, ${artifactChecklist.summary.artifact_classes_ready}/${artifactChecklist.summary.artifact_classes_total} ready artifact classes, and ${artifactChecklist.summary.release_blockers} release blockers. It keeps completion claims blocked while release status is \`${artifactChecklist.paper_readiness.release_gate_status}\`. See \`ARTIFACT_CHECKLIST.md\`.

The generated reproduction capsule records ${reproductionCapsule.summary.reproduction_commands} ordered reproduction commands, ${reproductionCapsule.summary.validation_commands} validation commands, ${reproductionCapsule.summary.artifact_hashes} package artifact hashes, and ${reproductionCapsule.summary.release_blockers} expected release blockers. Use it as the reviewer start-here artifact for reproducing the current package state. See \`REPRODUCTION_CAPSULE.md\`.

## Human Review Execution

The generated review execution plan records ${reviewExecutionPlan.summary.total_rows_remaining} reviewer rows remaining, an estimated ${reviewExecutionPlan.summary.reviewer_hours_with_reserve} reviewer-hours with adjudication reserve, and ${reviewExecutionPlan.summary.blocking_review_checks} blocking review checks. It is a workload and acceptance-gate plan, not completed review. See \`REVIEW_EXECUTION_PLAN.md\`.

The generated review packet audit checks ${reviewPacketAudit.summary.files_checked} first-wave export files, ${reviewPacketAudit.summary.rows_checked} reviewer rows, and ${reviewPacketAudit.summary.categories_with_expansion_first_wave} expansion categories before returned annotations are collected. Current packet findings: ${reviewPacketAudit.summary.finding_count}. See \`REVIEW_PACKET_AUDIT.md\`.

The generated review return contract defines ${reviewReturnContract.summary.expected_return_files} expected returned files, ${reviewReturnContract.summary.expected_return_rows} rows, and ${reviewReturnContract.summary.rejection_rule_count} rejection rules for real reviewer annotations. Current return-contract findings: ${reviewReturnContract.summary.finding_count}. See \`REVIEW_RETURN_CONTRACT.md\`.

The generated review return preflight checks the real returns directory before import/apply. Current returned packets present: ${reviewReturnPreflight.summary.present_return_files}/${reviewReturnPreflight.summary.expected_return_files}; missing files: ${reviewReturnPreflight.summary.missing_return_files}; latest import ready: ${reviewReturnPreflight.summary.latest_import_ready}. See \`REVIEW_RETURN_PREFLIGHT.md\`.

The generated review return checklist converts the first-wave handoff into ${reviewReturnChecklist.summary.packets} exact returned-packet work units covering ${reviewReturnChecklist.summary.expected_rows} rows. Current missing returned packets: ${reviewReturnChecklist.summary.missing_packets}. See \`REVIEW_RETURN_CHECKLIST.md\`.

The generated review collection tracker prioritizes those missing returns into pilot-gold and scale collection queues: ${reviewCollectionTracker.summary.missing_packets} missing packets, ${reviewCollectionTracker.summary.pilot_missing_packets} pilot missing packets, and ${reviewCollectionTracker.summary.expansion_missing_packets} expansion missing packets. See \`REVIEW_COLLECTION_TRACKER.md\`.

The generated review wave schedule orders collection into ${reviewWaveSchedule.summary.waves} waves across ${reviewWaveSchedule.summary.packets} exact returned-packet files, with ${reviewWaveSchedule.summary.scheduled_missing_packets} packets still scheduled for collection. See \`REVIEW_WAVE_SCHEDULE.md\`.

The generated review drop-off manifest binds those packets to ${reviewDropoffManifest.summary.export_hashes} source export hashes and exact drop-off paths before import. See \`REVIEW_DROPOFF_MANIFEST.md\`.

The generated gold adjudication plan maps all ${goldAdjudicationPlan.summary.pilot_items} pilot items to category coverage, missing reviews, required adjudicator fields, and promotion gates. It currently records ${goldAdjudicationPlan.summary.missing_reviews} missing reviews and ${goldAdjudicationPlan.summary.promotion_ready_items} promotion-ready items. See \`GOLD_ADJUDICATION_PLAN.md\`.

The generated scale adjudication plan maps ${scaleAdjudicationPlan.summary.expansion_batches} expansion batches and ${scaleAdjudicationPlan.summary.planned_new_items} planned new items to category-scale targets, first-wave collection status, and adjudication gates. It currently records ${scaleAdjudicationPlan.summary.missing_review_rows} missing expansion review rows and ${scaleAdjudicationPlan.summary.merge_ready_items} merge-ready expansion items. See \`SCALE_ADJUDICATION_PLAN.md\`.

## Threats To Validity

The generated threats-to-validity report tracks ${threatsValidity.summary.threat_count} risks across construct, internal, statistical, external, artifact, evaluation, novelty, and measurement validity. High-severity threats: ${threatsValidity.summary.high_severity_count}. See \`THREATS_TO_VALIDITY.md\`.

## External Model Baselines

The generated submission contract defines \`${submissionContract.version}\` with ${submissionContract.schema.answer_required_fields.length} required answer fields and ${submissionContract.validation_rules.length} validation rules. Public leaderboard use remains ${submissionContract.public_leaderboard_allowed ? 'allowed' : 'disallowed'}. See \`SUBMISSION_CONTRACT.md\`.

The generated scoring contract defines \`${scoringContract.version}\` with ${scoringContract.summary.metric_count} metric formulas and ${scoringContract.validation_rules.length} validation rules. It explicitly separates citation faithfulness, conclusion support, and abstention quality so true cited facts cannot support unsupported conclusions. See \`SCORING_CONTRACT.md\`.

The generated model reporting card defines \`${modelReportingCard.version}\` with ${modelReportingCard.summary.required_reporting_fields} required reporting fields and ${modelReportingCard.summary.reporting_rules} rules. It requires prompt-packet provenance, contract versions, abstention and citation-policy disclosure, and keeps pilot model scores out of public leaderboard use. See \`MODEL_REPORTING_CARD.md\`.

${markdownTable(['System', 'Evaluation source', 'Tasks', 'Macro answer correct', 'Report present'], modelRows(modelRunIndex))}

## Data Provenance And Licensing Notes

This benchmark stores normalized evidence snippets and metadata from upstream Hugging Face datasets. Upstream dataset licenses are mixed and include unknown-license sources, so a public release must either preserve attribution and license notices, replace unknown-license sources, or release only pointers/transforms where required. See \`LICENSE_REVIEW.md\`, \`generated/license-review.json\`, \`PUBLIC_PACKAGE_MANIFEST.md\`, and \`generated/public-package-manifest.json\` for the generated blocker and pointer-only packaging lists.

Packaged redistribution clearance is currently ${licenseClearance.public_redistribution_clearance_ready ? 'ready' : 'not ready'} for the generated public package: ${licenseClearance.remediated_replacement_count} impacted scaled candidates are replaced with known-license alternatives, ${licenseClearance.pointer_only_candidate_count} are pointer-only, and ${licenseClearance.package_mode_counts.redistributable_known_license_evidence} use redistributable known-license evidence. Raw upstream source-license status is still tracked separately from package clearance.

The generated public package integrity report checks ${publicPackageIntegrity.summary.suites_checked} public suites, ${publicPackageIntegrity.summary.total_items} JSON items, ${publicPackageIntegrity.summary.total_jsonl_rows} JSONL rows, and ${publicPackageIntegrity.summary.pointer_only_evidence_units} pointer-only evidence units. Current integrity findings: ${publicPackageIntegrity.summary.findings}; pointer-only text leaks: ${publicPackageIntegrity.summary.pointer_only_text_leaks}. See \`PUBLIC_PACKAGE_INTEGRITY.md\`.

The generated public package schema report checks ${publicPackageSchema.summary.suites_checked} public suites, ${publicPackageSchema.summary.items_checked} items, and ${publicPackageSchema.summary.evidence_units_checked} evidence units for required evaluator fields and pointer-only text rules. Current schema violations: ${publicPackageSchema.summary.schema_violations}. See \`PUBLIC_PACKAGE_SCHEMA.md\`.

## Responsible Use

The generated responsible-use policy records ${responsibleUse.summary.policy_rules} rules and ${responsibleUse.summary.active_restrictions} active restrictions. Public leaderboards and completion claims remain disallowed while review, scale, and novelty gates are incomplete. See \`RESPONSIBLE_USE.md\`.

## Data Statement

The generated data statement records ${dataStatement.summary.source_dataset_count} source datasets, ${dataStatement.composition.scaled_public_items} scaled public items, and ${dataStatement.package_policy.pointer_only_items} pointer-only package items. It keeps package-facing composition, licensing, intended-use, out-of-scope-use, and review-state claims synchronized with generated artifacts. See \`DATA_STATEMENT.md\`.

## Version Manifest

The generated version manifest records SHA-256 digests for ${versionManifest.summary.artifact_count} package-critical artifacts and carries ${versionManifest.summary.release_blockers} active release blockers. Use it to identify the exact benchmark package state cited by a paper draft. See \`VERSION_MANIFEST.md\`.

## Known Limitations

1. Current scale is ${pilotSuite.items.length} pilot items, not the target 30-50 reviewed items per category.
2. Gold labels are blocked until independent review and disagreement resolution are complete.
3. Some challenge items are synthetic transformations of existing rows and require human review before publication.
4. The novelty audit is ${noveltyAudit.status} and records ${noveltyAudit.refresh_summary?.query_count ?? 0} June 2026 refresh queries; it still must become final before any completion claim.
5. Unknown-license upstream datasets must remain pointer-only or be replaced before any package that redistributes source text.

## Release Gate

See \`RELEASE_GATE.md\` and \`generated/release-gate.json\`. Current blockers: ${releaseGate.blockers.length}.

Key release checks:

- Gold review: ${checkDetail(releaseGate, 'gold_review_complete')}
- Review preflight: ${checkDetail(releaseGate, 'review_preflight_ready')}
- Reviewer handoff: ${checkDetail(releaseGate, 'reviewer_handoff_ready')}
- Review progress: ${checkDetail(releaseGate, 'review_progress_ready')}
- Adjudication readiness: ${checkDetail(releaseGate, 'adjudication_readiness_ready')}
- Annotator agreement: ${checkDetail(releaseGate, 'annotator_agreement_ready')}
- Corpus audit: ${checkDetail(releaseGate, 'corpus_audit_ready')}
- Source diversity: ${checkDetail(releaseGate, 'source_diversity_plan_ready')}
- Source acquisition: ${checkDetail(releaseGate, 'source_acquisition_manifest_ready')}
- Source acquisition packets: ${checkDetail(releaseGate, 'source_acquisition_packets_ready')}
- Source acquisition audit: ${checkDetail(releaseGate, 'source_acquisition_audit_ready')}
- Source acquisition fetch report: ${checkDetail(releaseGate, 'source_acquisition_fetch_report_ready')}
- Source acquisition full fetch: ${checkDetail(releaseGate, 'source_acquisition_fetch_full_ready')}
- Source acquisition candidates: ${checkDetail(releaseGate, 'source_acquisition_candidates_ready')}
- Source acquisition review workbooks: ${checkDetail(releaseGate, 'source_acquisition_review_workbooks_ready')}
- Source acquisition review preflight: ${checkDetail(releaseGate, 'source_acquisition_review_preflight_report_ready')}
- Construct map: ${checkDetail(releaseGate, 'construct_map_ready')}
- Artifact checklist: ${checkDetail(releaseGate, 'artifact_checklist_ready')}
- Version manifest: ${checkDetail(releaseGate, 'version_manifest_ready')}
- Threats to validity: ${checkDetail(releaseGate, 'threats_validity_ready')}
- Failure atlas: ${checkDetail(releaseGate, 'failure_atlas_ready')}
- Error codebook: ${checkDetail(releaseGate, 'error_codebook_ready')}
- Paper tables: ${checkDetail(releaseGate, 'paper_tables_ready')}
- Analysis plan: ${checkDetail(releaseGate, 'analysis_plan_ready')}
- Supplement index: ${checkDetail(releaseGate, 'supplement_index_ready')}
- Reviewer FAQ: ${checkDetail(releaseGate, 'reviewer_faq_ready')}
- Submission contract: ${checkDetail(releaseGate, 'submission_contract_ready')}
- Scoring contract: ${checkDetail(releaseGate, 'scoring_contract_ready')}
- Data statement: ${checkDetail(releaseGate, 'data_statement_ready')}
- Power plan: ${checkDetail(releaseGate, 'power_plan_ready')}
- Novelty refresh ledger: ${checkDetail(releaseGate, 'novelty_refresh_ledger_ready')}
- Novelty claim boundaries: ${checkDetail(releaseGate, 'novelty_claim_boundaries_ready')}
- Annotation export: ${checkDetail(releaseGate, 'annotation_export_ready')}
- Annotation return readiness: ${checkDetail(releaseGate, 'annotation_return_readiness_ready')}
- Reviewer calibration: ${checkDetail(releaseGate, 'review_calibration_ready')}
- Annotation quality control: ${checkDetail(releaseGate, 'annotation_quality_control_ready')}
- Annotation import path: ${checkDetail(releaseGate, 'annotation_import_path_ready')}
- Pilot promotion smoke: ${checkDetail(releaseGate, 'gold_promotion_smoke_ready')}
- Expansion promotion smoke: ${checkDetail(releaseGate, 'expansion_promotion_smoke_ready')}
- Public package clearance: ${checkDetail(releaseGate, 'unknown_license_resolved')}
- External model baselines: ${checkDetail(releaseGate, 'frontier_or_open_model_results_present')}
- Paper claim ledger: ${checkDetail(releaseGate, 'paper_claim_ledger_ready')}
- Responsible use: ${checkDetail(releaseGate, 'responsible_use_ready')}
- Novelty audit: ${checkDetail(releaseGate, 'novelty_audit_final')}
`
}

for (const [name, path] of Object.entries(inputPaths)) {
  assert(existsSync(path), `Missing dataset card input ${name}: ${path}`)
}

writeText(
  datasetCardPath,
  renderCard({
    spec: readJson(inputPaths.spec),
    pilotSuite: readJson(inputPaths.pilotSuite),
    coverageMatrix: readJson(inputPaths.coverageMatrix),
    itemQualityAudit: readJson(inputPaths.itemQualityAudit),
    reviewMergeReport: readJson(inputPaths.reviewMergeReport),
    goldSummary: readJson(inputPaths.goldSummary),
    baselineAnalysis: readJson(inputPaths.baselineAnalysis),
    failureAtlas: readJson(inputPaths.failureAtlas),
    errorCodebook: readJson(inputPaths.errorCodebook),
    paperTables: readJson(inputPaths.paperTables),
    analysisPlan: readJson(inputPaths.analysisPlan),
    paperClaimLedger: readJson(inputPaths.paperClaimLedger),
    supplementIndex: readJson(inputPaths.supplementIndex),
    citationMetadata: readJson(inputPaths.citationMetadata),
    reviewerFaq: readJson(inputPaths.reviewerFaq),
    modelRunIndex: readJson(inputPaths.modelRunIndex),
    modelReportingCard: readJson(inputPaths.modelReportingCard),
    submissionContract: readJson(inputPaths.submissionContract),
    scoringContract: readJson(inputPaths.scoringContract),
    corpusAudit: readJson(inputPaths.corpusAudit),
    sourceDiversityPlan: readJson(inputPaths.sourceDiversityPlan),
    sourceAcquisitionManifest: readJson(inputPaths.sourceAcquisitionManifest),
    sourceAcquisitionPackets: readJson(inputPaths.sourceAcquisitionPackets),
    sourceAcquisitionAudit: readJson(inputPaths.sourceAcquisitionAudit),
    sourceAcquisitionFetchedRows: readJson(inputPaths.sourceAcquisitionFetchedRows),
    sourceAcquisitionCandidates: readJson(inputPaths.sourceAcquisitionCandidates),
    sourceAcquisitionReviewWorkbooks: readJson(inputPaths.sourceAcquisitionReviewWorkbooks),
    sourceAcquisitionReviewPreflight: readJson(inputPaths.sourceAcquisitionReviewPreflight),
    constructMap: readJson(inputPaths.constructMap),
    artifactChecklist: readJson(inputPaths.artifactChecklist),
    threatsValidity: readJson(inputPaths.threatsValidity),
    powerPlan: readJson(inputPaths.powerPlan),
    noveltyAudit: readJson(inputPaths.noveltyAudit),
    noveltyWatchlist: readJson(inputPaths.noveltyWatchlist),
    noveltyResolutionMatrix: readJson(inputPaths.noveltyResolutionMatrix),
    noveltyFinalizationPreflight: readJson(inputPaths.noveltyFinalizationPreflight),
    noveltySourceReviewPackets: readJson(inputPaths.noveltySourceReviewPackets),
    noveltyClaimRevisionPlan: readJson(inputPaths.noveltyClaimRevisionPlan),
    noveltyLinkAudit: readJson(inputPaths.noveltyLinkAudit),
    noveltyReplacementCandidates: readJson(inputPaths.noveltyReplacementCandidates),
    noveltyOverlapAdjudication: readJson(inputPaths.noveltyOverlapAdjudication),
    licenseReview: readJson(inputPaths.licenseReview),
    licenseClearance: readJson(inputPaths.licenseClearance),
    packageManifest: readJson(inputPaths.packageManifest),
    publicPackageIntegrity: readJson(inputPaths.publicPackageIntegrity),
    publicPackageSchema: readJson(inputPaths.publicPackageSchema),
    responsibleUse: readJson(inputPaths.responsibleUse),
    dataStatement: readJson(inputPaths.dataStatement),
    versionManifest: readJson(inputPaths.versionManifest),
    reviewExecutionPlan: readJson(inputPaths.reviewExecutionPlan),
    reviewPacketAudit: readJson(inputPaths.reviewPacketAudit),
    reviewReturnContract: readJson(inputPaths.reviewReturnContract),
    reviewReturnPreflight: readJson(inputPaths.reviewReturnPreflight),
    reviewReturnChecklist: readJson(inputPaths.reviewReturnChecklist),
    reviewCollectionTracker: readJson(inputPaths.reviewCollectionTracker),
    reviewWaveSchedule: readJson(inputPaths.reviewWaveSchedule),
    reviewDropoffManifest: readJson(inputPaths.reviewDropoffManifest),
    goldAdjudicationPlan: readJson(inputPaths.goldAdjudicationPlan),
    scaleAdjudicationPlan: readJson(inputPaths.scaleAdjudicationPlan),
    reproductionCapsule: readJson(inputPaths.reproductionCapsule),
    releaseGate: readJson(inputPaths.releaseGate),
    annotationProtocol: readJson(inputPaths.annotationProtocol),
    adjudicationReadiness: readJson(inputPaths.adjudicationReadiness),
    annotatorAgreement: readJson(inputPaths.annotatorAgreement),
    annotationExport: readJson(inputPaths.annotationExport),
    reviewCalibration: readJson(inputPaths.reviewCalibration),
    annotationQualityControl: readJson(inputPaths.annotationQualityControl),
    annotationImport: readJson(inputPaths.annotationImport),
    annotationImportSmoke: readJson(inputPaths.annotationImportSmoke),
    goldPromotionSmoke: readJson(inputPaths.goldPromotionSmoke),
    expansionPromotionSmoke: readJson(inputPaths.expansionPromotionSmoke),
  }),
)

console.log(`Wrote hard grounded research dataset card to ${datasetCardPath}`)
