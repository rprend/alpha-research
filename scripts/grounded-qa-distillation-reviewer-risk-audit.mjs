import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const experimentDir = path.join(rootDir, "docs", "experiments", "grounded-qa-distillation");
const runDir = path.join(experimentDir, "runs");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? "reviewer-risk-audit-2026-06-27-v2";
const outputDir = path.join(runDir, runId);

await fs.mkdir(outputDir, { recursive: true });

const readiness = await readResult("paper-readiness-gate-2026-06-26-v1");
const evidenceMap = await readResult("manuscript-evidence-map-2026-06-27-v2");
const corpusRealism = await readResult("corpus-realism-private-kb-gap-audit-2026-06-26-v1");
const versionedKbPrototype = await readResult("versioned-private-kb-prototype-git-docs-2026-06-26-v1");
const versionedKbEval = await readResult("versioned-private-kb-eval-versioned-private-kb-prototype-git-docs-2026-06-26-v1");
const versionedWritebackDiagnostic = await readResult("versioned-kb-writeback-diagnostic-versioned-private-kb-prototype-git-docs-2026-06-26-v1");
const versionedKbNaturalnessAudit = await readResult("versioned-kb-naturalness-audit-versioned-private-kb-prototype-git-docs-2026-06-26-v1");
const versionedKbNaturalQuestions = await readResult("versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2");
const versionedKbNaturalQuestionEval = await readResult("versioned-kb-natural-question-eval-versioned-kb-natural-questions-versioned-private-kb-prototype-git-docs-2026-06-26-v2");
const draft = await readResult("manuscript-draft-2026-06-27-v2");
const novelty = await readResult("novelty-watchlist-2026-06-27-v2");
const noveltyDelta = await readResult("novelty-delta-matrix-2026-06-27-v1");
const faithfulContextQa = await readResult("faithful-context-qa-comparison-2026-06-27-v1");
const citationGroundingMemory = await readResult("citation-grounding-memory-comparison-2026-06-27-v1");
const citationFaithfulness = await readResult("citation-faithfulness-neighbor-comparison-2026-06-27-v1");
const faithfulnessRankingControl = await readResult("faithfulness-ranking-control-final-window-2026-06-27-v1");
const remoteSmoke = await readResult("joint-action-remote-smoke-plan-joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2");
const postSmoke = await readResult("qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1");
const judgeCalibration = await readResult("judge-calibration-audit-2026-06-26-v1");
const judgeAdjudication = await readResult("judge-adjudication-packet-2026-06-26-v1");
const judgeSecondPass = await readResult("judge-reliability-second-pass-plan-2026-06-26-v1");
const judgeSecondPassRun = await readResult("judge-reliability-second-pass-run-2026-06-26-v2");
const abstentionReliability = await readResult("abstention-boundary-reliability-audit-2026-06-26-v1");
const judgeDisagreementTaxonomy = await readResult("judge-disagreement-taxonomy-judge-reliability-second-pass-run-2026-06-26-v2");
const judgeReliabilityClaimGate = await readResult("judge-reliability-claim-gate-2026-06-27-v1");
const costCoveragePareto = await readResult("cost-coverage-support-pareto-2026-06-26-v1");
const amortizationBreakEven = await readResult("amortization-break-even-qwen3b-2026-06-26-v1");
const distillationLossAccounting = await readResult("distillation-loss-accounting-2026-06-27-v1");
const policyAblation = await readResult("post-training-policy-ablation-2026-06-26-v1");
const coverageFrontier = await readResult("coverage-constrained-support-frontier-2026-06-26-v1");
const candidatePoolOracle = await readResult("candidate-pool-oracle-final-window-2026-06-27-v1");
const unsupportedRepairability = await readResult("unsupported-answer-repairability-audit-final-window-2026-06-27-v1");
const modelScaleAudit = await readResult("model-scale-adequacy-audit-2026-06-26-v1");
const packetQualityAudit = await readResult("joint-action-packet-quality-audit-curriculum-2026-06-27-v1");
const scriptContractAudit = await readResult("joint-action-script-contract-audit-curriculum-2026-06-27-v1");
const smokeLedgerFinalizer = await readResult("joint-action-smoke-ledger-finalizer-joint-action-qwen3b-smoke-eval-v1");
const primeRunbook = await readResult("prime-qwen3b-smoke-runbook-2026-06-26-v1");
const qwenResultIntegration = await readResult("qwen3b-result-integration-joint-action-smoke-2026-06-26-v1");
const qwenOutcomeDecisionPolicy = await readResult("qwen3b-outcome-decision-policy-2026-06-27-v1");
const finalClaimAcceptance = await readResult("final-claim-acceptance-matrix-2026-06-27-v1");
const qwenIntegrationFixtureAudit = await readResult("qwen3b-integration-fixture-audit-2026-06-26-v1");
const qwenSyntaxOnlyRejectionAudit = await readResult("qwen3b-syntax-only-rejection-audit-2026-06-26-v1");
const qwenLocalControlNonSubstitutionAudit = await readResult("qwen3b-local-control-non-substitution-audit-2026-06-26-v1");
const primeCliAuthRecheck = await readResult("prime-cli-upgrade-auth-recheck-2026-06-26-v1");
const primeAuthRepairHandoff = await readResult("prime-auth-repair-handoff-2026-06-27-v1");
const primeAuthPriceGate = await readResult("prime-auth-price-gate-qwen3b-smoke-2026-06-26-v1");
const finalEvidenceChecklist = await readResult("final-evidence-checklist-qwen3b-2026-06-26-v1");
const remoteProvenanceGate = await readResult("qwen3b-remote-provenance-gate-joint-action-qwen3b-smoke-eval-v1");
const hfLaunchAttempt = await readResult("huggingface-qwen3b-smoke-launch-attempt-2026-06-26-v1");
const remoteBackendGate = await readResult("remote-backend-readiness-gate-qwen3b-smoke-2026-06-26-v1");
const budget = await readJson(path.join(experimentDir, "spend", "budget.json"));

const risks = [
  {
    id: "R1_missing_trained_qwen3b_result",
    severity: "critical",
    status: "blocking",
    reviewer_objection: "The paper question asks whether expensive grounded behavior can be distilled into a cheaper trained model or scaffold, but the final Qwen 3B joint-action student has not been trained/evaluated.",
    current_evidence: [
      readiness.run_id,
      remoteSmoke.run_id,
      packetQualityAudit.run_id,
      scriptContractAudit.run_id,
      qwenResultIntegration.run_id,
      qwenOutcomeDecisionPolicy.run_id,
      finalClaimAcceptance.run_id,
      qwenIntegrationFixtureAudit.run_id,
      qwenLocalControlNonSubstitutionAudit.run_id,
      modelScaleAudit.run_id,
      finalEvidenceChecklist.run_id,
      remoteProvenanceGate.run_id,
      unsupportedRepairability.run_id,
      evidenceMap.qwen3b_required_final_result.remote_smoke_plan_run_id,
    ],
    mitigation_done: `The dataset packet, bounded GPU runner, adapter eval, smoke manifest, and budgeted launch command are prepared and validated. ${packetQualityAudit.run_id} verifies ${packetQualityAudit.aggregate.sft.rows} SFT rows and ${packetQualityAudit.aggregate.dpo.rows} DPO rows with both repair and abstain preferences, no missing inline citations in grounded targets, and no train/eval paper overlap. ${unsupportedRepairability.run_id} audits the final-window unsupported direct answers and finds only ${unsupportedRepairability.aggregate.citation_repair_candidate_rows}/${unsupportedRepairability.aggregate.unsupported_answer_rows} citation-repair candidates, with ${unsupportedRepairability.aggregate.answer_repair_or_regeneration_needed_rows} needing answer repair/regeneration and ${unsupportedRepairability.aggregate.reference_insufficient_rows} needing abstention. ${scriptContractAudit.run_id} runs zero-cost local compile, packet-validator, Bash syntax, bounded-command, and judge-ready artifact checks. ${modelScaleAudit.run_id} shows tiny/local students are not adequate final evidence and justifies the bounded Qwen 3B smoke over either tiny-model labelers or an open-ended cutting-edge GPU run. ${qwenLocalControlNonSubstitutionAudit.run_id} invokes the production integrity/provenance gates against the local Qwen base and citation-repair controls and confirms both are rejected as final trained-smoke substitutes. ${remoteProvenanceGate.run_id} requires pod status, remote environment, bootstrap manifest, and bounded smoke manifest provenance before any paid judge or Pareto claim. ${qwenResultIntegration.run_id} will compare the judged Qwen result against direct and 70% coverage-constrained targets before any Pareto claim; ${qwenIntegrationFixtureAudit.run_id} verifies its negative/minimum-positive/strong-positive status logic, and ${qwenSyntaxOnlyRejectionAudit.run_id} verifies that perfect inline citation syntax alone is rejected. ${qwenOutcomeDecisionPolicy.run_id} pre-registers what negative, minimum-positive, and strong-positive outcomes mean and blocks model escalation after a negative smoke until a failure-mode audit and budget recheck exist. ${finalEvidenceChecklist.run_id} enumerates the exact final artifacts that must exist before this blocker can close. ${finalClaimAcceptance.run_id} now condenses those requirements into a final claim matrix and currently blocks: ${finalClaimAcceptance.summary.blocking_failures.join(", ")}.`,
    required_next_evidence: [
      "runs/joint-action-qwen3b-smoke-eval-v1/predictions.jsonl",
      "runs/joint-action-qwen3b-smoke-eval-v1/result.json",
      "runs/joint-action-qwen3b-smoke-eval-v1/smoke_manifest.json",
      "runs/joint-action-qwen3b-smoke-eval-v1/prime_pod_status.json",
      "runs/joint-action-qwen3b-smoke-eval-v1/remote_environment.txt",
      "runs/joint-action-qwen3b-smoke-eval-v1/remote_smoke_bootstrap_manifest.json",
    ],
  },
  {
    id: "R2_missing_grounded_correctness_judge_for_student",
    severity: "critical",
    status: "blocking",
    reviewer_objection: "No paper-ready claim can be made about citation-grounded correctness until the trained student's predictions are judged for support and abstention correctness.",
    current_evidence: [
      readiness.run_id,
      postSmoke.run_id,
      finalEvidenceChecklist.run_id,
      "qwen3b-prediction-integrity-gate-joint-action-qwen3b-smoke-eval-v1",
    ],
    mitigation_done: "A fail-closed post-smoke pipeline now runs prediction integrity checks and dry judging before any paid OpenAI judge call.",
    required_next_evidence: [
      "Integrity gate status ready_for_paid_judge",
      "Dry judge covers all 69 final-window examples",
      "Paid openai-judge run with positive calls_made and examples_judged",
      "Qwen result integration status ready_for_pareto_update",
    ],
  },
  {
    id: "R3_private_kb_claim_overreach",
    severity: "high",
    status: "managed_but_not_closed",
    reviewer_objection: "The motivating claim says private evolving KBs, while the current evaluation is a public QASPER/arXiv proxy.",
    current_evidence: [
      evidenceMap.dataset_and_temporal_claims.trusted_snapshot_run_id,
      corpusRealism.run_id,
      versionedKbPrototype.run_id,
      versionedKbEval.run_id,
      versionedKbNaturalnessAudit.run_id,
      versionedKbNaturalQuestions.run_id,
      versionedKbNaturalQuestionEval.run_id,
      "extended_temporal_future_holdout-manifest.json",
    ],
    mitigation_done: `${corpusRealism.run_id} makes the boundary executable: it allows an evolving public domain-KB proxy claim, rejects private-enterprise proof and WriteBack-memory-baseline claims, and lists the required versioned private-KB upgrade evidence. ${versionedKbPrototype.run_id} makes that upgrade path concrete by producing ${versionedKbPrototype.examples.total} deterministic examples from immutable repo git snapshots, including stale-snapshot abstentions, while still marking private-enterprise proof as unsupported. ${versionedKbEval.run_id} evaluates that slice and shows naive citation-copy fails stale-snapshot abstentions while a snapshot-aware prefix retriever solves the deterministic prototype. ${versionedKbNaturalnessAudit.run_id} measures the original natural-benchmark gap: ${(100 * versionedKbNaturalnessAudit.aggregate.template_question_rate).toFixed(1)}% template question wording and ${(100 * versionedKbNaturalnessAudit.aggregate.prefix_leakage_rate).toFixed(1)}% quoted-prefix leakage. ${versionedKbNaturalQuestions.run_id} runs a ledgered natural-question authoring probe for ${versionedKbNaturalQuestions.examples_written} examples at $${versionedKbNaturalQuestions.run_cost_usd.toFixed(6)}, reducing template wording to ${(100 * versionedKbNaturalQuestions.aggregate.template_question_rate).toFixed(1)}%, snapshot labels to ${(100 * versionedKbNaturalQuestions.aggregate.snapshot_label_rate).toFixed(1)}%, and prefix leakage to ${(100 * versionedKbNaturalQuestions.aggregate.prefix_leakage_rate).toFixed(1)}%. ${versionedKbNaturalQuestionEval.run_id} then evaluates that natural-question surface with zero calls: naive citation-copy remains at ${(100 * versionedKbNaturalQuestionEval.systems.find((row) => row.id === "copy_first_evidence").overall_correct_rate).toFixed(1)}% overall correctness and fails stale-snapshot abstentions, while the lexical snapshot guard reaches ${(100 * versionedKbNaturalQuestionEval.systems.find((row) => row.id === "lexical_retriever_snapshot_guard").overall_correct_rate).toFixed(1)}% overall correctness with one stable-question retrieval miss. Natural/private benchmark claims remain false until retrieval packs, natural insufficiency cases, and private/enterprise semantics are added. The manuscript evidence map and draft restrict the claim to a trusted dated public proxy and explicitly prohibit private-KB proof language.`,
    required_next_evidence: [
      "Keep the manuscript caveat unless a versioned private/domain corpus is added.",
      "Replace deterministic line-prefix questions with natural questions and snapshot-specific retrieval packs before claiming a natural versioned-KB benchmark.",
      "If adding a private KB, create train-time and final-time snapshots with immutable date provenance.",
      "If comparing write-back memory, allow writes only from prior snapshots and preserve derived-record provenance.",
    ],
  },
  {
    id: "R4_novelty_pressure_from_rag_distillation_and_citation_sft",
    severity: "high",
    status: "managed_but_needs_final_refresh",
    reviewer_objection: "The contribution may be perceived as generic RAG distillation, generic citation SFT, or KB write-back memory rather than a sharper grounded-correctness amortization result.",
    current_evidence: [
      novelty.run_id,
      noveltyDelta.run_id,
      "drag-like-rag-distillation-comparison-2026-06-26-v1",
      "longcite-style-citation-sft-comparison-2026-06-26-v1",
      faithfulContextQa.run_id,
      citationGroundingMemory.run_id,
      citationFaithfulness.run_id,
      faithfulnessRankingControl.run_id,
      "writeback-kb-amortization-scoped-exclusion-2026-06-26-v1",
      versionedWritebackDiagnostic.run_id,
    ],
    mitigation_done: `Current artifacts isolate the support/abstention/citation-grounding axis and scope out full WriteBack retrieval on QASPER until leakage-safe memory snapshots exist. ${noveltyDelta.run_id} converts the watchlist into a claim-level matrix: ${noveltyDelta.summary.broad_claims_rejected} broad novelty families are rejected, and only ${noveltyDelta.summary.surviving_claims} core claim survives conditionally on Qwen 3B plus grounded judging. ${faithfulContextQa.run_id} adds the compact faithful-context-QA positioning demanded by the refreshed novelty watchlist: the project must not claim to be the first compact faithful context QA model, and a true OCC-RAG-like baseline would need to run on the same compact evidence packs and update-heldout KB windows. ${citationGroundingMemory.run_id} adds the citation-grounding and compact-memory positioning: the paper must separate citation existence, support/relevance, and temporal validity from inline syntax and treat compact/federated QA memories as a competing memory-side amortization path. ${citationFaithfulness.run_id} adds the QDRAG/CiteRAG/faithfulness-ranking/generate-then-verify boundary: retrieval-side decomposition/ranking and online verification are neighboring strategies, and any comparison must report online verification cost separately from amortized student/scaffold inference. ${faithfulnessRankingControl.run_id} adds the same-window lexical faithfulness-ranking control: the train-selected threshold makes ${faithfulnessRankingControl.eval_metrics.suppressions} final-window suppressions and changes support-oracle correctness by ${faithfulnessRankingControl.eval_metrics.delta_correct} rows, so simple lexical cited-evidence ranking does not replace trained repair/regeneration. ${versionedWritebackDiagnostic.run_id} adds a small versioned-domain diagnostic: leak-safe train-only write-back reaches ${(100 * versionedWritebackDiagnostic.systems.find((row) => row.id === "leak_safe_train_writeback_only").overall_correct_rate).toFixed(1)}% overall correctness but 0.0% correctness on eval-update questions, train write-back plus live snapshot reaches ${(100 * versionedWritebackDiagnostic.systems.find((row) => row.id === "leak_safe_train_writeback_plus_live_snapshot").overall_correct_rate).toFixed(1)}% on the deterministic slice, and the leaky eval-written upper bound answers ${(100 * versionedWritebackDiagnostic.systems.find((row) => row.id === "leaky_eval_writeback_upper_bound").by_type.stale_snapshot_abstention.answer_rate).toFixed(1)}% of stale-snapshot queries with 0.0% correctness. That supports the claim boundary: compact faithful-context QA, citation-grounding metrics, compact QA memories, citation-faithfulness retrieval/verification methods, and WriteBack are close neighbors, but fair comparisons require same evidence packs, update snapshots, temporal/citation support, and cost metrics.`,
    required_next_evidence: [
      "Refresh web/paper search immediately before any submission claim.",
      "Update related-work notes with any June 2026 or newer direct overlaps.",
      "If reviewer pressure remains high, run a true compact faithful-context-QA baseline on the final update-heldout windows.",
      "If reviewer pressure remains high, add a compact-memory or citation-grounding metric baseline/non-comparability artifact.",
    ],
  },
  {
    id: "R5_model_judge_reliability",
    severity: "medium_high",
    status: "open",
    reviewer_objection: "A model-based grounded-correctness judge can be biased, under-calibrated, or insufficient as the only correctness authority.",
    current_evidence: [
      judgeCalibration.run_id,
      judgeAdjudication.run_id,
      judgeSecondPass.run_id,
      judgeSecondPassRun.run_id,
      abstentionReliability.run_id,
      judgeDisagreementTaxonomy.run_id,
      judgeReliabilityClaimGate.run_id,
      "claim-entailment-guard-validation-240-389-v1",
    ],
    mitigation_done: `The judge artifacts store structured support verdicts, ${judgeCalibration.run_id} samples ${judgeCalibration.summary.audit_queue_rows} hard rows from ${judgeCalibration.summary.judgments_loaded} existing judgments, ${judgeAdjudication.run_id} joins those rows to questions/evidence/predictions with ${judgeAdjudication.join_warnings.length} join warnings, ${judgeSecondPass.run_id} prepares ${judgeSecondPass.request_rows} blind second-pass request rows, ${judgeSecondPassRun.run_id} completes ${judgeSecondPassRun.calls_made} blind second-pass case judgments with ${judgeSecondPassRun.schema_violations} schema violations and ${(100 * judgeSecondPassRun.agreement.exact_agreement_rate).toFixed(1)}% exact agreement, and ${abstentionReliability.run_id} flags questionable abstentions as unstable. ${judgeDisagreementTaxonomy.run_id} classifies the ${(100 * judgeDisagreementTaxonomy.source_summary.disagreement_rate).toFixed(1)}% disagreement slice: ${judgeDisagreementTaxonomy.taxonomy.abstention_boundary_reversal.disagreements} abstention-boundary reversals, ${judgeDisagreementTaxonomy.taxonomy.partial_vs_supported_granularity.disagreements} partial/support granularity reversals, and ${judgeDisagreementTaxonomy.taxonomy.unsupported_to_supported_reversal.disagreements} unsupported-to-supported reversals. ${judgeReliabilityClaimGate.run_id} converts that into a claim gate with ${judgeReliabilityClaimGate.priority_adjudication.rows_total} priority adjudication rows, keeps human-validated correctness claims disallowed, and requires Qwen 3B support metrics to be labeled model-judged unless human or stronger independent adjudication closes the gate.`,
    required_next_evidence: [
      "Manually adjudicate the P0 abstention-boundary queue or run a stronger independent judge before claiming abstention calibration is solved.",
      "Spot-adjudicate P1 support-boundary rows before treating unsupported/support rates as human truth.",
      "Report judge prompts, schemas, abstention criteria, and disagreement examples.",
    ],
  },
  {
    id: "R6_coverage_support_tradeoff",
    severity: "medium_high",
    status: "open",
    reviewer_objection: "The strongest completed scaffold results improve support largely by suppressing risky answers, so correctness gains may hide poor answer coverage.",
    current_evidence: [
      "risk-gate-transfer-synthesis-240-389-v1",
      "claim-entailment-guard-validation-240-389-v1",
      costCoveragePareto.run_id,
      amortizationBreakEven.run_id,
      distillationLossAccounting.run_id,
      finalClaimAcceptance.run_id,
      candidatePoolOracle.run_id,
      unsupportedRepairability.run_id,
      policyAblation.run_id,
      coverageFrontier.run_id,
      qwenResultIntegration.run_id,
      draft.run_id,
    ],
    mitigation_done: `${costCoveragePareto.run_id} maps ${costCoveragePareto.systems.length} current systems across answer rate, answer support, judged correctness, citation recall, and online calls/query; ${amortizationBreakEven.run_id} converts the planned Qwen GPU+judge estimate into explicit break-even accounting under the $100 cap while preserving the claim boundary that economics are not quality evidence; ${distillationLossAccounting.run_id} states what each cheaper system preserves and loses, including the citation-format/support gap and the coverage/support tradeoff; ${finalClaimAcceptance.run_id} makes answer support, citation support, temporal validity, coverage, cost, provenance, novelty, and paper-readiness requirements a single fail-closed matrix; ${candidatePoolOracle.run_id} gives a selection-only upper bound on the final window and still answers only ${(100 * candidatePoolOracle.oracle.answer_rate).toFixed(1)}% when restricted to supported answer candidates, below the 70% target; ${unsupportedRepairability.run_id} shows why selection/citation repair is not enough: only ${unsupportedRepairability.aggregate.citation_repair_candidate_rows} unsupported direct answer is citation-repairable, while ${unsupportedRepairability.aggregate.answer_repair_or_regeneration_needed_rows} require answer repair/regeneration and ${unsupportedRepairability.aggregate.reference_insufficient_rows} should abstain; ${policyAblation.run_id} aggregates existing judged post-training/data policies and shows support-risk gated labels are strongest by judged correctness/support but answer only ${(100 * policyAblation.families.find((row) => row.id === "support_risk_gated_labels").aggregate.answer_rate).toFixed(1)}% of rows; ${coverageFrontier.run_id} replays thresholds and shows the 70% answer-rate operating point reaches ${(100 * coverageFrontier.coverage_constrained_operating_points.find((row) => row.min_answer_rate === 0.7).selected.answer_support_rate).toFixed(1)}% answer support and ${(100 * coverageFrontier.coverage_constrained_operating_points.find((row) => row.min_answer_rate === 0.7).selected.overall_judged_correct_rate).toFixed(1)}% judged correctness; the draft frames coverage as a central metric.`,
    required_next_evidence: [
      "Report answer rate, abstention correctness, support, and utility together.",
      "Compare trained Qwen 3B against zero-call gates on both correctness and coverage.",
      "Use qwen3b-result-integration to decide whether the result meets the minimum target or is a negative result.",
    ],
  },
  {
    id: "R7_remote_compute_reproducibility_and_auth",
    severity: "medium",
    status: "operational_blocker",
    reviewer_objection: "The paper-critical run depends on external GPU execution, while Prime auth and HF credits are currently unavailable.",
    current_evidence: [
      "prime-auth-diagnosis",
      primeCliAuthRecheck.run_id,
      finalEvidenceChecklist.run_id,
      remoteSmoke.run_id,
      scriptContractAudit.run_id,
      smokeLedgerFinalizer.run_id,
      primeRunbook.run_id,
      primeAuthRepairHandoff.run_id,
      primeAuthPriceGate.run_id,
      hfLaunchAttempt.run_id,
      remoteBackendGate.run_id,
      remoteProvenanceGate.run_id,
    ],
    mitigation_done: `The remote command is single-step and bounded; ${scriptContractAudit.run_id} verifies the script contract without spend; ${smokeLedgerFinalizer.run_id} is ready to append an actual external-compute row only after smoke artifacts exist and backend cost is known; ${primeRunbook.run_id} adds explicit Prime auth, live-price, pod-create, sync, bootstrap, fetch, cost-finalize, and terminate steps; ${primeAuthRepairHandoff.run_id} adds the executable hidden-input handoff for PRIME_API_KEY, requires --apply=true before writing ~/.prime/config.json, refreshes read-only gates after repair, and currently reports ${primeAuthRepairHandoff.status}; ${remoteProvenanceGate.run_id} currently reports ${remoteProvenanceGate.status} and will fail closed until provider/pod/GPU/environment provenance is fetched; ${primeCliAuthRecheck.run_id} upgraded/rechecked Prime CLI ${primeCliAuthRecheck.cli_version} and still found API-key authorization failures before pricing or balance checks; ${primeAuthPriceGate.run_id} is the executable Prime read-only gate and currently reports ${primeAuthPriceGate.status}. ${hfLaunchAttempt.run_id} attempted the same bounded smoke on Hugging Face Jobs and failed before creation because the active token lacks job.write permission; it incurred $${hfLaunchAttempt.budget.actual_cost_usd.toFixed(0)}. ${remoteBackendGate.run_id} combines the current budget, Prime CLI state, and HF Jobs permission evidence and currently reports ${remoteBackendGate.status}; Prime is ${remoteBackendGate.backends.prime_intellect.status}, HF Jobs is ${remoteBackendGate.backends.huggingface_jobs.status}, and both backend estimates remain under budget if auth is repaired. All actual spend is tracked under the $100 budget with $0 external compute spend so far.`,
    required_next_evidence: [
      "Install a valid Prime key through hidden input using prime-auth-repair-handoff-2026-06-27-v1, or use a Hugging Face token with job.write plus available billing.",
      "Rerun the Prime auth/price gate and remote backend readiness gate; require remote_backend_ready_for_qwen3b_smoke before pod or job creation.",
      "If using Hugging Face Jobs, rerun the bounded a10g-large launch and record either backend job id or failed-before-creation reason.",
      "Record provider, GPU type, wall time, backend run id, actual cost, and command transcript for the smoke.",
      "Fetch prime_pod_status.json, remote_environment.txt, remote_smoke_bootstrap_manifest.json, and smoke_manifest.json.",
      "Run the remote provenance gate and require remote_provenance_ready_for_judge before paid judging.",
      "Run the smoke ledger finalizer with --record=true after artifacts and backend cost are known.",
    ],
  },
  {
    id: "R8_model_scale_and_gpu_choice",
    severity: "medium_high",
    status: "managed_but_waiting_for_qwen3b",
    reviewer_objection: "The paper may be underpowered if the student model is too small, or wasteful if it jumps to an expensive cutting-edge model without first testing the minimal credible trained student.",
    current_evidence: [
      modelScaleAudit.run_id,
      qwenLocalControlNonSubstitutionAudit.run_id,
      policyAblation.run_id,
      coverageFrontier.run_id,
      packetQualityAudit.run_id,
      primeAuthPriceGate.run_id,
    ],
    mitigation_done: `${modelScaleAudit.run_id} compares direct mini RAG, zero-call gates, local distilled scaffolds, Qwen 0.5B SFT, the local Qwen 3B base-control, and a zero-call Qwen 3B citation-repair control. It records that Qwen 0.5B has high citation formatting but only ${(100 * modelScaleAudit.systems.find((row) => row.id === "local_qwen05b_sft_answer_repeat2").answer_support_rate).toFixed(1)}% answer support, while Qwen 3B base inference answers many prompts but has weak inline-citation contract adherence. The deterministic repair reaches 100.0% inline citation rate without proving support. ${qwenLocalControlNonSubstitutionAudit.run_id} then verifies those local controls also fail the production final-smoke gates because they lack the canonical run id, trained adapter, full 69-example final window, smoke manifest, and remote provenance. Together these audits reject tiny/base/syntax-repaired outputs as final students or ground-truth labelers and select a bounded Qwen 3B joint-action LoRA smoke as the next minimum credible trained-student experiment under the $100 cap.`,
    required_next_evidence: [
      "Run the bounded Qwen 3B smoke only after auth_and_live_price_verified.",
      "If Qwen 3B fails the 70% coverage-constrained target, report that negative result before escalating to a larger model.",
      "Do not use tiny local model outputs as ground-truth labels.",
    ],
  },
];

const criticalBlockers = risks.filter((risk) => risk.severity === "critical" && risk.status === "blocking").map((risk) => risk.id);

const result = {
  run_id: runId,
  generated_at: new Date().toISOString(),
  artifact_type: "reviewer_risk_audit",
  status: "not_submission_ready",
  purpose: "Name the most likely reviewer objections and required evidence before treating the grounded-QA distillation project as paper-ready.",
  readiness_context: {
    gate_run_id: readiness.run_id,
    passed_requirements: readiness.summary.passed,
    failed_requirements: readiness.summary.failed,
    status: readiness.summary.current_status,
    blockers: readiness.top_blockers.map((row) => row.id),
  },
  critical_blockers: criticalBlockers,
  risks,
  acceptance_path: [
    "Repair Prime auth or HF credits without exceeding the $100 total budget.",
    "Run the one-command bounded Qwen 3B SFT/DPO smoke and produce complete predictions.",
    "Record actual GPU cost with the smoke ledger finalizer and regenerate total budget.",
    "Run the remote provenance gate and require pod status, remote environment, bootstrap manifest, and bounded smoke manifest before judging.",
    "Run the Qwen 3B prediction integrity gate and default post-smoke dry judge.",
    "Run the paid grounded-correctness judge only after the dry gate passes.",
    "Run Qwen result integration and update the Pareto/frontier table with the actual judged row.",
    "Regenerate amortization break-even accounting with the actual GPU and judge spend.",
    "Regenerate distillation-loss accounting with the actual Qwen preservation/loss row.",
    "Refresh the novelty watchlist/web search immediately before making a submission-ready claim.",
    "Regenerate the evidence map, manuscript draft, readiness gate, and this risk audit.",
  ],
  budget: {
    max_budget_usd: budget.max_budget_usd,
    actual_total_spend_usd: budget.spend_usd.total_actual,
    remaining_budget_usd: budget.spend_usd.remaining,
    external_compute_actual_usd: budget.spend_usd.external_compute,
  },
  llm_budget: {
    openai_llm_calls: 0,
    openai_cost_usd: 0,
    external_compute_cost_usd: 0,
    note: "This reviewer-risk audit reads local artifacts only.",
  },
};

await fs.writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, "report.md"), renderReport(result));
console.log(JSON.stringify(result, null, 2));

async function readResult(id) {
  return readJson(path.join(runDir, id, "result.json"));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function renderReport(result) {
  return `# Reviewer Risk Audit

Generated: ${result.generated_at}

Status: \`${result.status}\`

Readiness gate: \`${result.readiness_context.gate_run_id}\` (${result.readiness_context.passed_requirements}/${result.readiness_context.passed_requirements + result.readiness_context.failed_requirements} passing)

## Critical Blockers

${result.critical_blockers.map((id) => `- \`${id}\``).join("\n")}

## Risks

| ID | Severity | Status | Reviewer objection | Required next evidence |
| --- | --- | --- | --- | --- |
${result.risks.map((risk) => `| ${risk.id} | ${risk.severity} | ${risk.status} | ${risk.reviewer_objection} | ${risk.required_next_evidence.join("<br>")} |`).join("\n")}

## Acceptance Path

${result.acceptance_path.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Budget

- Actual total spend: $${result.budget.actual_total_spend_usd.toFixed(6)}
- External compute spend: $${result.budget.external_compute_actual_usd.toFixed(6)}
- Remaining: $${result.budget.remaining_budget_usd.toFixed(6)}

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
`;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
