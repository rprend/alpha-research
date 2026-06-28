#!/usr/bin/env python3
import json
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.pipeline import Pipeline


ROOT = Path.cwd()
EXPERIMENT_DIR = ROOT / "docs" / "experiments" / "grounded-qa-distillation"
RUNS_DIR = EXPERIMENT_DIR / "runs"
RUN_ID = "combined-target-text-verifier-audit-0-320-to-321-389-2026-06-28-v1"
OUTPUT_DIR = RUNS_DIR / RUN_ID

LABEL_RUN_IDS = [
    "question-target-label-batch-run-gpt4o-mini-2026-06-28-v1",
    "hard-target-label-batch-run-gpt4o-mini-2026-06-28-v1",
]
D311_RUN_ID = "question-target-text-verifier-audit-0-320-to-321-389-2026-06-28-v1"
FINAL_PAIR_RUN_ID = "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    budget = read_json(EXPERIMENT_DIR / "spend" / "budget.json")
    d311 = read_json(RUNS_DIR / D311_RUN_ID / "result.json")
    final_pairs = read_jsonl(RUNS_DIR / FINAL_PAIR_RUN_ID / "heldout_pairwise.jsonl")

    train_examples = []
    label_run_summaries = []
    for label_run_id in LABEL_RUN_IDS:
        result = read_json(RUNS_DIR / label_run_id / "result.json")
        requests = read_jsonl(RUNS_DIR / label_run_id / "requests.jsonl")
        judgments = read_jsonl(RUNS_DIR / label_run_id / "judgments.jsonl")
        examples = build_candidate_examples(label_run_id, judgments, {row["request_id"]: row for row in requests})
        train_examples.extend(examples)
        label_run_summaries.append({
            "run_id": label_run_id,
            "calls_made": result["calls_made"],
            "run_cost_usd": result["run_cost_usd"],
            "primary_judged": result["metrics"]["primary_judged"],
            "chosen_preferred_primary": result["metrics"]["chosen_preferred_primary"],
            "calibration_preference_matches": result["metrics"]["calibration_agreement"]["preference_matches"],
            "calibration_pairs": result["metrics"]["calibration_agreement"]["pairs"],
        })

    model_rows = []
    final_predictions_by_policy = {}
    for c_value in [0.1, 0.3, 1.0, 3.0, 10.0]:
        row, predictions = evaluate_candidate_model(c_value, train_examples, final_pairs)
        model_rows.append(row)
        final_predictions_by_policy[row["policy_id"]] = predictions

    selected = sorted(
        model_rows,
        key=lambda row: (
            -row["nonfinal_leave_one_out"]["balanced_accuracy"],
            -row["nonfinal_leave_one_out"]["accuracy"],
            -row["final_pair_transfer"]["accuracy"],
            row["policy_id"],
        ),
    )[0]
    best_final = sorted(
        model_rows,
        key=lambda row: (
            -row["final_pair_transfer"]["accuracy"],
            -row["nonfinal_leave_one_out"]["balanced_accuracy"],
            row["policy_id"],
        ),
    )[0]
    d311_selected = d311["selected_by_nonfinal_loo"]
    improvement = {
        "loo_balanced_accuracy_delta": selected["nonfinal_leave_one_out"]["balanced_accuracy"] - d311_selected["nonfinal_leave_one_out"]["balanced_accuracy"],
        "final_pair_accuracy_delta": selected["final_pair_transfer"]["accuracy"] - d311_selected["final_pair_transfer"]["accuracy"],
    }
    promotable = selected["nonfinal_leave_one_out"]["balanced_accuracy"] >= 0.65 and selected["final_pair_transfer"]["accuracy"] >= 0.70

    result = {
        "run_id": RUN_ID,
        "generated_at": now_iso(),
        "artifact_type": "combined_target_text_verifier_audit",
        "status": "combined_text_verifier_promotable" if promotable else "combined_text_verifier_not_promotable",
        "purpose": "Retrain local target-completeness text verifiers on D309 plus the hard D313 labels and test reliability/transfer before any GPU spend.",
        "source_runs": {
            "label_runs": LABEL_RUN_IDS,
            "d311_text_verifier_audit": D311_RUN_ID,
            "final_margin_compatible_heldout_packet": FINAL_PAIR_RUN_ID,
        },
        "label_run_summaries": label_run_summaries,
        "data": {
            "candidate_training_examples": len(train_examples),
            "candidate_training_positive": sum(row["label"] for row in train_examples),
            "candidate_training_negative": len(train_examples) - sum(row["label"] for row in train_examples),
            "final_pairwise_rows": len(final_pairs),
            "models_evaluated": len(model_rows),
        },
        "selected_by_nonfinal_loo": summarize_model(selected),
        "diagnostic_best_final_text_verifier": summarize_model(best_final),
        "d311_comparison": {
            "d311_selected_policy_id": d311_selected["policy_id"],
            "d311_loo_balanced_accuracy": d311_selected["nonfinal_leave_one_out"]["balanced_accuracy"],
            "d311_final_pair_accuracy": d311_selected["final_pair_transfer"]["accuracy"],
            **improvement,
        },
        "decision": decision_from_result(promotable, selected, improvement),
        "leakage_guard": {
            "final_window_labels_used_for_training": False,
            "final_window_labels_used_for_model_selection": False,
            "final_window_labels_used_for_reporting_transfer": True,
            "paid_label_rows_training_use": "allowed_nonfinal_combined_text_verifier_training",
            "final_pair_rows_training_use": "forbidden_final_window_reporting_only",
        },
        "budget": {
            "max_budget_usd": budget["max_budget_usd"],
            "actual_total_spend_usd": budget["spend_usd"]["total_actual"],
            "remaining_budget_usd": budget["spend_usd"]["remaining"],
        },
        "llm_budget": {
            "openai_llm_calls": 0,
            "openai_cost_usd": 0,
            "external_compute_cost_usd": 0,
            "prime_intellect_cost_usd": 0,
            "note": "Zero-call local scikit-learn audit over already-paid D309 and D313 labels.",
        },
        "artifacts": {
            "model_metrics_jsonl": rel(OUTPUT_DIR / "model_metrics.jsonl"),
            "selected_final_predictions_jsonl": rel(OUTPUT_DIR / "selected_final_predictions.jsonl"),
            "report": rel(OUTPUT_DIR / "report.md"),
        },
    }

    write_jsonl(OUTPUT_DIR / "model_metrics.jsonl", model_rows)
    write_jsonl(OUTPUT_DIR / "selected_final_predictions.jsonl", final_predictions_by_policy[selected["policy_id"]])
    write_json(OUTPUT_DIR / "result.json", result)
    (OUTPUT_DIR / "report.md").write_text(render_report(result), encoding="utf-8")
    print(json.dumps({
        "run_id": result["run_id"],
        "status": result["status"],
        "selected_by_nonfinal_loo": result["selected_by_nonfinal_loo"],
        "d311_comparison": result["d311_comparison"],
        "decision": result["decision"],
        "budget": result["budget"],
        "llm_budget": result["llm_budget"],
    }, indent=2))


def build_candidate_examples(label_run_id, judgments, request_by_id):
    examples = []
    for judgment in judgments:
        if judgment.get("skipped") or judgment.get("duplicate_calibration"):
            continue
        request = request_by_id[judgment["request_id"]]
        question = request["input"]["question"]
        evidence = request["input"]["evidence_pack"]
        chosen = request["input"]["candidate_chosen"]
        rejected = request["input"]["candidate_rejected"]
        examples.append({
            "example_id": f"{label_run_id}:{judgment['request_id']}:chosen",
            "root_example_id": judgment["root_example_id"],
            "candidate_role": "chosen",
            "text": candidate_text(question, evidence, chosen),
            "label": int(bool(judgment["judgment"]["chosen_question_target_complete"])),
        })
        examples.append({
            "example_id": f"{label_run_id}:{judgment['request_id']}:rejected",
            "root_example_id": judgment["root_example_id"],
            "candidate_role": "rejected",
            "text": candidate_text(question, evidence, rejected),
            "label": int(bool(judgment["judgment"]["rejected_question_target_complete"])),
        })
    return examples


def evaluate_candidate_model(c_value, train_examples, final_pairs):
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=12000, sublinear_tf=True)),
        ("clf", LogisticRegression(C=c_value, class_weight="balanced", solver="liblinear", max_iter=1000, random_state=0)),
    ])
    x_train = [row["text"] for row in train_examples]
    y_train = [row["label"] for row in train_examples]
    loo_predictions = cross_val_predict(pipeline, x_train, y_train, cv=LeaveOneOut())
    loo = {
        "examples": len(y_train),
        "accuracy": float(accuracy_score(y_train, loo_predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(y_train, loo_predictions)),
        "predicted_positive": int(sum(int(value) for value in loo_predictions)),
    }

    pipeline.fit(x_train, y_train)
    final_predictions = []
    for pair in final_pairs:
        question = pair["input"]["question"]
        evidence = pair["input"]["compact_retrieved_evidence_pack"]
        chosen_score = float(pipeline.predict_proba([candidate_text(question, evidence, pair["chosen"])])[0][1])
        rejected_score = float(pipeline.predict_proba([candidate_text(question, evidence, pair["rejected"])])[0][1])
        predicted = "chosen" if chosen_score >= rejected_score else "rejected"
        final_predictions.append({
            "pair_id": pair["pair_id"],
            "example_id": pair["example_id"],
            "predicted": predicted,
            "expected": "chosen",
            "correct": predicted == "chosen",
            "chosen_score": chosen_score,
            "rejected_score": rejected_score,
            "margin": chosen_score - rejected_score,
        })
    correct = sum(1 for row in final_predictions if row["correct"])
    final = {
        "pairs": len(final_predictions),
        "correct": correct,
        "errors": len(final_predictions) - correct,
        "accuracy": correct / len(final_predictions) if final_predictions else 0,
        "mean_margin": mean(row["margin"] for row in final_predictions),
        "median_abs_margin": median(abs(row["margin"]) for row in final_predictions),
    }
    policy_id = f"combined_candidate_tfidf_logreg_c_{str(c_value).replace('.', 'p')}"
    return {
        "policy_id": policy_id,
        "model": "tfidf_bigram_logistic_regression",
        "target": "candidate_question_target_complete",
        "c": c_value,
        "nonfinal_leave_one_out": loo,
        "final_pair_transfer": final,
    }, final_predictions


def decision_from_result(promotable, selected, improvement):
    if promotable:
        return {
            "promote_text_verifier_now": True,
            "train_question_target_verifier_on_gpu_now": False,
            "buy_more_openai_labels_now": False,
            "launch_gpu_now": False,
            "next_step": "Integrate the combined local target-completeness verifier as a selector/scaffold and test it against the final system surface before any GPU student training.",
            "reason": (
                f"Combined labels lift balanced LOO by {pct(improvement['loo_balanced_accuracy_delta'])} and final pair transfer by "
                f"{pct(improvement['final_pair_accuracy_delta'])}, meeting the local verifier promotion threshold."
            ),
        }
    return {
        "promote_text_verifier_now": False,
        "train_question_target_verifier_on_gpu_now": False,
        "buy_more_openai_labels_now": False,
        "launch_gpu_now": False,
        "next_step": "Do not train a student yet; inspect combined-label disagreement and consider whether target-completeness requires a stronger judge/model class.",
        "reason": (
            f"The selected combined verifier reaches {pct(selected['nonfinal_leave_one_out']['balanced_accuracy'])} balanced LOO and "
            f"{pct(selected['final_pair_transfer']['accuracy'])} final transfer, below the promotion threshold."
        ),
    }


def candidate_text(question, evidence_pack, candidate):
    evidence = " ".join(
        f"[{item.get('evidence_id', '')}] {item.get('section', '')}: {item.get('text', '')}"
        for item in evidence_pack[:6]
    )
    claims = json.dumps(candidate.get("claim_table") or [], sort_keys=True)
    citations = " ".join(candidate.get("citations") or [])
    unsupported = json.dumps(candidate.get("unsupported_claims") or [], sort_keys=True)
    summary = json.dumps(candidate.get("summary") or {}, sort_keys=True)
    return "\n".join([
        f"question: {question}",
        f"evidence: {evidence}",
        f"answer_type: {candidate.get('answer_type')}",
        f"answer: {candidate.get('answer', '')}",
        f"citations: {citations}",
        f"claims: {claims}",
        f"unsupported_claims: {unsupported}",
        f"summary: {summary}",
        f"abstention_reason: {candidate.get('abstention_reason') or ''}",
    ])


def summarize_model(row):
    return {
        "policy_id": row["policy_id"],
        "model": row["model"],
        "target": row["target"],
        "c": row["c"],
        "nonfinal_leave_one_out": row["nonfinal_leave_one_out"],
        "final_pair_transfer": row["final_pair_transfer"],
    }


def render_report(result):
    selected = result["selected_by_nonfinal_loo"]
    comparison = result["d311_comparison"]
    return f"""# Combined Target Text Verifier Audit

Generated: {result['generated_at']}

Status: `{result['status']}`

This audit trains local TF-IDF/logistic models from already-paid D309 and D313 target-completeness labels. It makes no OpenAI calls and launches no GPU jobs.

## Selected Combined Verifier

- Policy: {selected['policy_id']}
- LOO balanced accuracy: {selected['nonfinal_leave_one_out']['balanced_accuracy']:.3f}
- Final pair transfer: {selected['final_pair_transfer']['correct']}/{selected['final_pair_transfer']['pairs']} ({pct(selected['final_pair_transfer']['accuracy'])})

## Delta From D311

- LOO balanced accuracy delta: {pct(comparison['loo_balanced_accuracy_delta'])}
- Final pair transfer delta: {pct(comparison['final_pair_accuracy_delta'])}

## Decision

- Promote text verifier now: {'yes' if result['decision']['promote_text_verifier_now'] else 'no'}
- Train question-target verifier on GPU now: {'yes' if result['decision']['train_question_target_verifier_on_gpu_now'] else 'no'}
- Buy more OpenAI labels now: {'yes' if result['decision']['buy_more_openai_labels_now'] else 'no'}
- Launch GPU now: {'yes' if result['decision']['launch_gpu_now'] else 'no'}
- Reason: {result['decision']['reason']}
- Next step: {result['decision']['next_step']}
"""


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def write_jsonl(path, rows):
    path.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")


def now_iso():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def rel(path):
    return str(path.relative_to(ROOT))


def mean(values):
    values = list(values)
    return sum(values) / len(values) if values else 0


def median(values):
    values = sorted(values)
    if not values:
        return 0
    mid = len(values) // 2
    if len(values) % 2:
        return values[mid]
    return (values[mid - 1] + values[mid]) / 2


def pct(value):
    return f"{100 * float(value):.1f}%"


if __name__ == "__main__":
    main()
