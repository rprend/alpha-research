import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'supplement-index.json')
const reportMarkdownPath = join(experimentDir, 'SUPPLEMENT_INDEX.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  paperTables: join(generatedDir, 'paper-tables.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
  noveltyWatchlist: join(generatedDir, 'novelty-watchlist.json'),
  noveltyResolutionMatrix: join(generatedDir, 'novelty-resolution-matrix.json'),
  noveltyFinalizationPreflight: join(generatedDir, 'novelty-finalization-preflight.json'),
  noveltySourceReviewPackets: join(generatedDir, 'novelty-source-review-packets.json'),
  noveltyClaimRevisionPlan: join(generatedDir, 'novelty-claim-revision-plan.json'),
  noveltyLinkAudit: join(generatedDir, 'novelty-link-audit.json'),
  noveltyReplacementCandidates: join(generatedDir, 'novelty-replacement-candidates.json'),
  noveltyOverlapAdjudication: join(generatedDir, 'novelty-overlap-adjudication.json'),
  noveltyRefreshLedger: join(generatedDir, 'novelty-refresh-ledger.json'),
  dataStatement: join(generatedDir, 'data-statement.json'),
  publicPackageIntegrity: join(generatedDir, 'public-package-integrity.json'),
  publicPackageSchema: join(generatedDir, 'public-package-schema.json'),
  versionManifest: join(generatedDir, 'version-manifest.json'),
  modelReportingCard: join(generatedDir, 'model-reporting-card.json'),
  citationMetadata: join(generatedDir, 'citation-metadata.json'),
  reviewExecutionPlan: join(generatedDir, 'review-execution-plan.json'),
  reviewPacketAudit: join(generatedDir, 'review-packet-audit.json'),
  reviewReturnContract: join(generatedDir, 'review-return-contract.json'),
  reviewReturnPreflight: join(generatedDir, 'review-return-preflight.json'),
  reviewReturnChecklist: join(generatedDir, 'review-return-checklist.json'),
  reviewCollectionTracker: join(generatedDir, 'review-collection-tracker.json'),
  reviewWaveSchedule: join(generatedDir, 'review-wave-schedule.json'),
  reviewDropoffManifest: join(generatedDir, 'review-dropoff-manifest.json'),
  reviewIntakeValidator: join(generatedDir, 'review-intake-validator.json'),
  reviewAssignmentAudit: join(generatedDir, 'review-assignment-audit.json'),
  goldAdjudicationPlan: join(generatedDir, 'gold-adjudication-plan.json'),
  scaleAdjudicationPlan: join(generatedDir, 'scale-adjudication-plan.json'),
  scaleGapLedger: join(generatedDir, 'scale-gap-ledger.json'),
  sourceLineageLedger: join(generatedDir, 'source-lineage-ledger.json'),
  difficultyMechanismLedger: join(generatedDir, 'difficulty-mechanism-ledger.json'),
  hypothesisTestMatrix: join(generatedDir, 'hypothesis-test-matrix.json'),
  resultInterpretationGuide: join(generatedDir, 'result-interpretation-guide.json'),
  evidenceSufficiencyAudit: join(generatedDir, 'evidence-sufficiency-audit.json'),
  estimandRegistry: join(generatedDir, 'estimand-registry.json'),
  sensitivityAnalysisPlan: join(generatedDir, 'sensitivity-analysis-plan.json'),
  lookupContrastRegistry: join(generatedDir, 'lookup-contrast-registry.json'),
  statisticalReportingTemplate: join(generatedDir, 'statistical-reporting-template.json'),
  controlAblationPlan: join(generatedDir, 'control-ablation-plan.json'),
  reproductionCapsule: join(generatedDir, 'reproduction-capsule.json'),
  artifactChecklist: join(generatedDir, 'artifact-checklist.json'),
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
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

function buildIndex({ spec, releaseGate, paperTables, paperClaimLedger, noveltyWatchlist, noveltyResolutionMatrix, noveltyFinalizationPreflight, noveltySourceReviewPackets, noveltyClaimRevisionPlan, noveltyLinkAudit, noveltyReplacementCandidates, noveltyOverlapAdjudication, noveltyRefreshLedger, dataStatement, publicPackageIntegrity, publicPackageSchema, versionManifest, modelReportingCard, citationMetadata, reviewExecutionPlan, reviewPacketAudit, reviewReturnContract, reviewReturnPreflight, reviewReturnChecklist, reviewCollectionTracker, reviewWaveSchedule, reviewDropoffManifest, reviewIntakeValidator, reviewAssignmentAudit, goldAdjudicationPlan, scaleAdjudicationPlan, scaleGapLedger, sourceLineageLedger, difficultyMechanismLedger, hypothesisTestMatrix, resultInterpretationGuide, evidenceSufficiencyAudit, estimandRegistry, sensitivityAnalysisPlan, lookupContrastRegistry, statisticalReportingTemplate, controlAblationPlan, reproductionCapsule, artifactChecklist }) {
  const tableEntries = paperTables.tables.map((table) => ({
    id: table.id,
    title: table.title,
    source: 'generated/paper-tables.json',
    manuscript_use: table.caption,
  }))
  const claimEntries = paperClaimLedger.claims.map((claim) => ({
    id: claim.id,
    status: claim.status,
    claim: claim.claim,
    evidence: claim.evidence || [],
  }))
  const supplementSections = [
    {
      id: 'benchmark_definition',
      files: ['README.md', 'benchmark-spec.json', 'rubrics.json', 'CONSTRUCT_MAP.md', 'DIFFICULTY_MECHANISM_LEDGER.md'],
      purpose: 'Define the hard-grounded taxonomy, source datasets, rubrics, construct operationalization, and difficulty mechanisms.',
    },
    {
      id: 'data_package',
      files: ['DATASET_CARD.md', 'DATA_STATEMENT.md', 'SOURCE_LINEAGE_LEDGER.md', 'PUBLIC_PACKAGE_MANIFEST.md', 'PUBLIC_PACKAGE_INTEGRITY.md', 'VERSION_MANIFEST.md', 'CITATION.md'],
      purpose: 'Document composition, source lineage, licensing, package policy, package integrity, exact artifact hashes, and citation caveats.',
    },
    {
      id: 'evaluation_contract',
      files: ['SUBMISSION_CONTRACT.md', 'SCORING_CONTRACT.md', 'MODEL_REPORTING_CARD.md', 'ERROR_CODEBOOK.md', 'MODEL_BASELINES.md'],
      purpose: 'Define model input/output, scoring metrics, result reporting, qualitative error codes, and baseline import surfaces.',
    },
    {
      id: 'paper_evidence',
      files: ['PAPER_TABLES.md', 'PAPER_CLAIM_LEDGER.md', 'DIFFICULTY_MECHANISM_LEDGER.md', 'HYPOTHESIS_TEST_MATRIX.md', 'RESULT_INTERPRETATION_GUIDE.md', 'EVIDENCE_SUFFICIENCY_AUDIT.md', 'ESTIMAND_REGISTRY.md', 'SENSITIVITY_ANALYSIS_PLAN.md', 'LOOKUP_CONTRAST_REGISTRY.md', 'STATISTICAL_REPORTING_TEMPLATE.md', 'CONTROL_ABLATION_PLAN.md', 'NOVELTY_RESOLUTION_MATRIX.md', 'NOVELTY_FINALIZATION_PREFLIGHT.md', 'NOVELTY_SOURCE_REVIEW_PACKETS.md', 'NOVELTY_CLAIM_REVISION_PLAN.md', 'NOVELTY_LINK_AUDIT.md', 'NOVELTY_REPLACEMENT_CANDIDATES.md', 'NOVELTY_OVERLAP_ADJUDICATION.md', 'NOVELTY_REFRESH_LEDGER.md', 'ANALYSIS_PLAN.md', 'POWER_PLAN.md'],
      purpose: 'Tie manuscript tables and claims to current evidence and blocked claims.',
    },
    {
      id: 'review_and_release_gates',
      files: ['ANNOTATION_PROTOCOL.md', 'REVIEWER_HANDOFF.md', 'REVIEW_EXECUTION_PLAN.md', 'REVIEW_RETURN_PREFLIGHT.md', 'REVIEW_RETURN_CHECKLIST.md', 'REVIEW_COLLECTION_TRACKER.md', 'REVIEW_WAVE_SCHEDULE.md', 'REVIEW_DROPOFF_MANIFEST.md', 'REVIEW_INTAKE_VALIDATOR.md', 'REVIEW_ASSIGNMENT_AUDIT.md', 'GOLD_ADJUDICATION_PLAN.md', 'SCALE_ADJUDICATION_PLAN.md', 'SCALE_GAP_LEDGER.md', 'RELEASE_GATE.md', 'THREATS_TO_VALIDITY.md'],
      purpose: 'Expose reviewer workflow, remaining workload, acceptance gates, blockers, and validity risks.',
    },
    {
      id: 'artifact_reproduction',
      files: ['REPRODUCTION_CAPSULE.md', 'ARTIFACT_CHECKLIST.md', 'VERSION_MANIFEST.md', 'RELEASE_GATE.md'],
      purpose: 'Record start-here reproduction commands, package-critical hashes, and current release readiness state.',
    },
  ]

  return {
    benchmark_id: spec.id,
    supplement_index_ready:
      supplementSections.length >= 6 &&
      tableEntries.length === paperTables.summary.table_count &&
      claimEntries.length === paperClaimLedger.summary.claims &&
      noveltyWatchlist.novelty_watchlist_ready &&
      noveltyResolutionMatrix.novelty_resolution_matrix_ready &&
      noveltyFinalizationPreflight.novelty_finalization_preflight_ready &&
      noveltySourceReviewPackets.novelty_source_review_packets_ready &&
      noveltyClaimRevisionPlan.novelty_claim_revision_plan_ready &&
      noveltyLinkAudit.novelty_link_audit_ready &&
      noveltyReplacementCandidates.novelty_replacement_candidates_ready &&
      noveltyOverlapAdjudication.novelty_overlap_adjudication_ready &&
      noveltyRefreshLedger.novelty_refresh_ledger_ready &&
      versionManifest.summary?.artifact_count >= 20 &&
      dataStatement.data_statement_ready &&
      publicPackageIntegrity.public_package_integrity_ready &&
      publicPackageSchema.public_package_schema_ready &&
      modelReportingCard.model_reporting_card_ready &&
      citationMetadata.summary?.citation_caveats >= 4 &&
      reviewExecutionPlan.review_execution_plan_ready &&
      reviewPacketAudit.review_packet_audit_ready &&
      reviewReturnContract.review_return_contract_ready &&
      reviewReturnPreflight.review_return_preflight_ready &&
      reviewReturnChecklist.review_return_checklist_ready &&
      reviewCollectionTracker.review_collection_tracker_ready &&
      reviewWaveSchedule.review_wave_schedule_ready &&
      reviewDropoffManifest.review_dropoff_manifest_ready &&
      reviewIntakeValidator.review_intake_validator_ready &&
      reviewAssignmentAudit.review_assignment_audit_ready &&
      goldAdjudicationPlan.gold_adjudication_plan_ready &&
      scaleAdjudicationPlan.scale_adjudication_plan_ready &&
      scaleGapLedger.scale_gap_ledger_ready &&
      sourceLineageLedger.source_lineage_ledger_ready &&
      difficultyMechanismLedger.difficulty_mechanism_ledger_ready &&
      hypothesisTestMatrix.hypothesis_test_matrix_ready &&
      resultInterpretationGuide.result_interpretation_guide_ready &&
      evidenceSufficiencyAudit.evidence_sufficiency_audit_ready &&
      estimandRegistry.estimand_registry_ready &&
      sensitivityAnalysisPlan.sensitivity_analysis_plan_ready &&
      lookupContrastRegistry.lookup_contrast_registry_ready &&
      statisticalReportingTemplate.statistical_reporting_template_ready &&
      controlAblationPlan.control_ablation_plan_ready &&
      reproductionCapsule.summary?.validation_commands >= 3 &&
      artifactChecklist.summary?.artifact_classes_total >= 30,
    version: 'supplement-index-v2',
    generated_from: {
      release_gate: 'generated/release-gate.json',
      paper_tables: 'generated/paper-tables.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      novelty_watchlist: 'generated/novelty-watchlist.json',
      novelty_resolution_matrix: 'generated/novelty-resolution-matrix.json',
      novelty_finalization_preflight: 'generated/novelty-finalization-preflight.json',
      novelty_source_review_packets: 'generated/novelty-source-review-packets.json',
      novelty_claim_revision_plan: 'generated/novelty-claim-revision-plan.json',
      novelty_link_audit: 'generated/novelty-link-audit.json',
      novelty_replacement_candidates: 'generated/novelty-replacement-candidates.json',
      novelty_overlap_adjudication: 'generated/novelty-overlap-adjudication.json',
      novelty_refresh_ledger: 'generated/novelty-refresh-ledger.json',
      data_statement: 'generated/data-statement.json',
      public_package_integrity: 'generated/public-package-integrity.json',
      public_package_schema: 'generated/public-package-schema.json',
      version_manifest: 'generated/version-manifest.json',
      model_reporting_card: 'generated/model-reporting-card.json',
      citation_metadata: 'generated/citation-metadata.json',
      review_execution_plan: 'generated/review-execution-plan.json',
      review_packet_audit: 'generated/review-packet-audit.json',
      review_return_contract: 'generated/review-return-contract.json',
      review_return_preflight: 'generated/review-return-preflight.json',
      review_return_checklist: 'generated/review-return-checklist.json',
      review_collection_tracker: 'generated/review-collection-tracker.json',
      review_wave_schedule: 'generated/review-wave-schedule.json',
      review_dropoff_manifest: 'generated/review-dropoff-manifest.json',
      review_intake_validator: 'generated/review-intake-validator.json',
      review_assignment_audit: 'generated/review-assignment-audit.json',
      gold_adjudication_plan: 'generated/gold-adjudication-plan.json',
      scale_adjudication_plan: 'generated/scale-adjudication-plan.json',
      scale_gap_ledger: 'generated/scale-gap-ledger.json',
      source_lineage_ledger: 'generated/source-lineage-ledger.json',
      difficulty_mechanism_ledger: 'generated/difficulty-mechanism-ledger.json',
      hypothesis_test_matrix: 'generated/hypothesis-test-matrix.json',
      result_interpretation_guide: 'generated/result-interpretation-guide.json',
      evidence_sufficiency_audit: 'generated/evidence-sufficiency-audit.json',
      estimand_registry: 'generated/estimand-registry.json',
      sensitivity_analysis_plan: 'generated/sensitivity-analysis-plan.json',
      lookup_contrast_registry: 'generated/lookup-contrast-registry.json',
      statistical_reporting_template: 'generated/statistical-reporting-template.json',
      control_ablation_plan: 'generated/control-ablation-plan.json',
      reproduction_capsule: 'generated/reproduction-capsule.json',
      artifact_checklist: 'generated/artifact-checklist.json',
    },
    supplement_sections: supplementSections,
    paper_tables: tableEntries,
    claim_map: claimEntries,
    release_state: {
      status: releaseGate.status,
      passing_checks: releaseGate.checks.filter((check) => check.passed).length,
      total_checks: releaseGate.checks.length,
      blockers: releaseGate.checks.filter((check) => !check.passed).map((check) => check.id),
      completion_claim_allowed: false,
    },
    summary: {
      sections: supplementSections.length,
      paper_tables: tableEntries.length,
      claims: claimEntries.length,
      novelty_watchlist_sources: noveltyWatchlist.summary.watchlist_source_count,
      novelty_resolution_sources: noveltyResolutionMatrix.summary.watchlist_sources,
      novelty_resolution_unresolved_sources: noveltyResolutionMatrix.summary.unresolved_sources,
      novelty_finalization_unresolved_sources: noveltyFinalizationPreflight.summary.unresolved_sources,
      novelty_source_review_packets: noveltySourceReviewPackets.summary.packets,
      novelty_claim_revisions: noveltyClaimRevisionPlan.summary.revisions,
      novelty_link_quarantined_sources: noveltyLinkAudit.summary.quarantined_sources,
      novelty_replacement_candidates: noveltyReplacementCandidates.summary.candidates,
      novelty_overlap_pending_dispositions: noveltyOverlapAdjudication.summary.pending_dispositions,
      novelty_refresh_sources: noveltyRefreshLedger.summary.source_count,
      artifact_hashes: versionManifest.summary.artifact_count,
      public_package_findings: publicPackageIntegrity.summary.findings,
      public_package_schema_violations: publicPackageSchema.summary.schema_violations,
      artifact_classes: artifactChecklist.summary.artifact_classes_total,
      model_reporting_fields: modelReportingCard.summary.required_reporting_fields,
      citation_caveats: citationMetadata.summary.citation_caveats,
      review_rows_remaining: reviewExecutionPlan.summary.total_rows_remaining,
      review_packet_findings: reviewPacketAudit.summary.finding_count,
      review_return_findings: reviewReturnContract.summary.finding_count,
      review_return_missing_files: reviewReturnPreflight.summary.missing_return_files,
      review_return_checklist_packets: reviewReturnChecklist.summary.packets,
      review_collection_missing_packets: reviewCollectionTracker.summary.missing_packets,
      review_wave_schedule_waves: reviewWaveSchedule.summary.waves,
      review_dropoff_manifest_packets: reviewDropoffManifest.summary.packets,
      review_intake_blocked_packets: reviewIntakeValidator.summary.blocked_packets,
      review_assignment_audit_assignments: reviewAssignmentAudit.summary.total_assignments,
      gold_adjudication_missing_reviews: goldAdjudicationPlan.summary.missing_reviews,
      scale_adjudication_missing_review_rows: scaleAdjudicationPlan.summary.missing_review_rows,
      scale_gap_reviewed_item_deficit: scaleGapLedger.summary.reviewed_item_deficit,
      difficulty_mechanisms: difficultyMechanismLedger.summary.mechanisms,
      difficulty_failure_cases: difficultyMechanismLedger.summary.observed_failure_cases,
      hypothesis_test_matrix_hypotheses: hypothesisTestMatrix.summary.hypotheses,
      hypothesis_test_matrix_observed_signature_categories: hypothesisTestMatrix.summary.categories_with_observed_expected_failure_modes,
      result_interpretation_rules: resultInterpretationGuide.summary.interpretation_rules,
      reproduction_commands: reproductionCapsule.summary.reproduction_commands,
      release_blockers: releaseGate.checks.filter((check) => !check.passed).length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(index) {
  const sectionRows = index.supplement_sections.map((section) => [
    section.id,
    section.files.join('<br>'),
    section.purpose,
  ])
  const tableRows = index.paper_tables.map((table) => [
    table.id,
    table.title,
    table.source,
  ])
  const claimRows = index.claim_map.map((claim) => [
    claim.id,
    claim.status,
    claim.claim,
  ])

  return `# Hard Grounded Research Supplement Index

This generated index maps the manuscript-facing supplement to source artifacts, claim boundaries, paper tables, and checksumed package state. It is a navigation artifact for reviewers; it does not clear the human-review, scale, or novelty gates.

## Summary

- Supplement index ready: ${index.supplement_index_ready}
- Version: ${index.version}
- Sections: ${index.summary.sections}
- Paper tables: ${index.summary.paper_tables}
- Claims: ${index.summary.claims}
- Novelty watchlist sources: ${index.summary.novelty_watchlist_sources}
- Novelty resolution sources: ${index.summary.novelty_resolution_sources}
- Novelty resolution unresolved sources: ${index.summary.novelty_resolution_unresolved_sources}
- Novelty finalization unresolved sources: ${index.summary.novelty_finalization_unresolved_sources}
- Novelty source review packets: ${index.summary.novelty_source_review_packets}
- Novelty claim revisions: ${index.summary.novelty_claim_revisions}
- Novelty link quarantined sources: ${index.summary.novelty_link_quarantined_sources}
- Novelty replacement candidates: ${index.summary.novelty_replacement_candidates}
- Novelty overlap pending dispositions: ${index.summary.novelty_overlap_pending_dispositions}
- Novelty refresh sources: ${index.summary.novelty_refresh_sources}
- Version-manifest artifact hashes: ${index.summary.artifact_hashes}
- Public package findings: ${index.summary.public_package_findings}
- Artifact classes: ${index.summary.artifact_classes}
- Model reporting fields: ${index.summary.model_reporting_fields}
- Citation caveats: ${index.summary.citation_caveats}
- Review rows remaining: ${index.summary.review_rows_remaining}
- Review packet findings: ${index.summary.review_packet_findings}
- Review return findings: ${index.summary.review_return_findings}
- Review return missing files: ${index.summary.review_return_missing_files}
- Review return checklist packets: ${index.summary.review_return_checklist_packets}
- Review collection missing packets: ${index.summary.review_collection_missing_packets}
- Review wave schedule waves: ${index.summary.review_wave_schedule_waves}
- Review dropoff manifest packets: ${index.summary.review_dropoff_manifest_packets}
- Review intake blocked packets: ${index.summary.review_intake_blocked_packets}
- Review assignment audit assignments: ${index.summary.review_assignment_audit_assignments}
- Gold adjudication missing reviews: ${index.summary.gold_adjudication_missing_reviews}
- Scale adjudication missing review rows: ${index.summary.scale_adjudication_missing_review_rows}
- Scale gap reviewed item deficit: ${index.summary.scale_gap_reviewed_item_deficit}
- Reproduction commands: ${index.summary.reproduction_commands}
- Release checks: ${index.release_state.passing_checks}/${index.release_state.total_checks}
- Completion claim allowed: ${index.summary.completion_claim_allowed}

## Supplement Sections

${markdownTable(['Section', 'Files', 'Purpose'], sectionRows)}

## Paper Tables

${markdownTable(['Table', 'Title', 'Source'], tableRows)}

## Claim Map

${markdownTable(['Claim', 'Status', 'Text'], claimRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Missing supplement-index input ${name}: ${path}`)
}

const index = buildIndex({
  spec: readJson(inputs.spec),
  releaseGate: readJson(inputs.releaseGate),
  paperTables: readJson(inputs.paperTables),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  noveltyWatchlist: readJson(inputs.noveltyWatchlist),
  noveltyResolutionMatrix: readJson(inputs.noveltyResolutionMatrix),
  noveltyFinalizationPreflight: readJson(inputs.noveltyFinalizationPreflight),
  noveltySourceReviewPackets: readJson(inputs.noveltySourceReviewPackets),
  noveltyClaimRevisionPlan: readJson(inputs.noveltyClaimRevisionPlan),
  noveltyLinkAudit: readJson(inputs.noveltyLinkAudit),
  noveltyReplacementCandidates: readJson(inputs.noveltyReplacementCandidates),
  noveltyOverlapAdjudication: readJson(inputs.noveltyOverlapAdjudication),
  noveltyRefreshLedger: readJson(inputs.noveltyRefreshLedger),
  dataStatement: readJson(inputs.dataStatement),
  publicPackageIntegrity: readJson(inputs.publicPackageIntegrity),
  publicPackageSchema: readJson(inputs.publicPackageSchema),
  versionManifest: readJson(inputs.versionManifest),
  modelReportingCard: readJson(inputs.modelReportingCard),
  citationMetadata: readJson(inputs.citationMetadata),
  reviewExecutionPlan: readJson(inputs.reviewExecutionPlan),
  reviewPacketAudit: readJson(inputs.reviewPacketAudit),
  reviewReturnContract: readJson(inputs.reviewReturnContract),
  reviewReturnPreflight: readJson(inputs.reviewReturnPreflight),
  reviewReturnChecklist: readJson(inputs.reviewReturnChecklist),
  reviewCollectionTracker: readJson(inputs.reviewCollectionTracker),
  reviewWaveSchedule: readJson(inputs.reviewWaveSchedule),
  reviewDropoffManifest: readJson(inputs.reviewDropoffManifest),
  reviewIntakeValidator: readJson(inputs.reviewIntakeValidator),
  reviewAssignmentAudit: readJson(inputs.reviewAssignmentAudit),
  goldAdjudicationPlan: readJson(inputs.goldAdjudicationPlan),
  scaleAdjudicationPlan: readJson(inputs.scaleAdjudicationPlan),
  scaleGapLedger: readJson(inputs.scaleGapLedger),
  sourceLineageLedger: readJson(inputs.sourceLineageLedger),
  difficultyMechanismLedger: readJson(inputs.difficultyMechanismLedger),
  hypothesisTestMatrix: readJson(inputs.hypothesisTestMatrix),
  resultInterpretationGuide: readJson(inputs.resultInterpretationGuide),
  evidenceSufficiencyAudit: readJson(inputs.evidenceSufficiencyAudit),
  estimandRegistry: readJson(inputs.estimandRegistry),
  sensitivityAnalysisPlan: readJson(inputs.sensitivityAnalysisPlan),
  lookupContrastRegistry: readJson(inputs.lookupContrastRegistry),
  statisticalReportingTemplate: readJson(inputs.statisticalReportingTemplate),
  controlAblationPlan: readJson(inputs.controlAblationPlan),
  reproductionCapsule: readJson(inputs.reproductionCapsule),
  artifactChecklist: readJson(inputs.artifactChecklist),
})

writeJson(reportJsonPath, index)
writeText(reportMarkdownPath, renderMarkdown(index))

console.log(`Wrote hard grounded supplement index JSON to ${reportJsonPath}`)
console.log(`Wrote hard grounded supplement index report to ${reportMarkdownPath}`)
