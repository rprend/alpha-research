#!/usr/bin/env python3
import json
import math
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.pipeline import Pipeline


ROOT = Path.cwd()
EXPERIMENT_DIR = ROOT / "docs" / "experiments" / "grounded-qa-distillation"
RUNS_DIR = EXPERIMENT_DIR / "runs"
RUN_ID = "question-target-text-verifier-audit-0-320-to-321-389-2026-06-28-v1"
OUTPUT_DIR = RUNS_DIR / RUN_ID

LABEL_RUN_ID = "question-target-label-batch-run-gpt4o-mini-2026-06-28-v1"
SCALAR_AUDIT_RUN_ID = "question-target-selector-transfer-audit-0-320-to-321-389-2026-06-28-v1"
FINAL_PAIR_RUN_ID = "final-margin-compatible-heldout-packet-321-389-2026-06-28-v1"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    budget = read_json(EXPERIMENT_DIR / "spend" / "budget.json")
    scalar_audit = read_json(RUNS_DIR / SCALAR_AUDIT_RUN_ID / "result.json")
    requests = read_jsonl(RUNS_DIR / LABEL_RUN_ID / "requests.jsonl")
    judgments = read_jsonl(RUNS_DIR / LABEL_RUN_ID / "judgments.jsonl")
    final_pairs = read_jsonl(RUNS_DIR / FINAL_PAIR_RUN_ID / "heldout_pairwise.jsonl")
    request_by_id = {row["request_id"]: row for row in requests}

    train_examples = build_candidate_examples(judgments, request_by_id)
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

    result = {
        "run_id": RUN_ID,
        "generated_at": now_iso(),
        "artifact_type": "question_target_text_verifier_audit",
        "status": "text_verifier_not_promotable",
        "purpose": "Train local TF-IDF/logistic target-completeness verifiers from the paid D309 labels and test transfer to frozen final supported-vs-unsupported pairs before any GPU spend.",
        "source_runs": {
            "question_target_label_batch_run": LABEL_RUN_ID,
            "question_target_scalar_selector_transfer_audit": SCALAR_AUDIT_RUN_ID,
            "final_margin_compatible_heldout_packet": FINAL_PAIR_RUN_ID,
        },
        "data": {
            "candidate_training_examples": len(train_examples),
            "candidate_training_positive": sum(row["label"] for row in train_examples),
            "candidate_training_negative": len(train_examples) - sum(row["label"] for row in train_examples),
            "primary_label_rows": len([row for row in judgments if not row.get("skipped") and not row.get("duplicate_calibration")]),
            "final_pairwise_rows": len(final_pairs),
            "models_evaluated": len(model_rows),
        },
        "selected_by_nonfinal_loo": summarize_model(selected),
        "diagnostic_best_final_text_verifier": summarize_model(best_final),
        "d310_scalar_context": {
            "selected_scalar_policy_id": scalar_audit["selected_by_nonfinal_labels"]["policy_id"],
            "selected_scalar_train_accuracy": scalar_audit["selected_by_nonfinal_labels"]["train"]["accuracy"],
            "selected_scalar_final_accuracy": scalar_audit["selected_by_nonfinal_labels"]["final"]["accuracy"],
            "diagnostic_best_final_scalar_accuracy": scalar_audit["diagnostic_best_final_policy"]["final"]["accuracy"],
        },
        "decision": {
            "promote_text_verifier_now": False,
            "train_question_target_verifier_on_gpu_now": False,
            "buy_more_openai_labels_now": False,
            "launch_gpu_now": False,
            "next_step": "Mine or buy a harder, more diverse non-final target-completeness batch that matches final pair distributions before training a verifier or student.",
            "reason": (
                f"The best local text verifier selected by non-final leave-one-out reaches "
                f"{pct(selected['nonfinal_leave_one_out']['balanced_accuracy'])} balanced LOO accuracy and only "
                f"{pct(selected['final_pair_transfer']['accuracy'])} final pair transfer. The label batch is real but too narrow for a deployable verifier."
            ),
        },
        "leakage_guard": {
            "final_window_labels_used_for_training": False,
            "final_window_labels_used_for_model_selection": False,
            "final_window_labels_used_for_reporting_transfer": True,
            "paid_label_rows_training_use": "allowed_nonfinal_text_verifier_training",
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
            "note": "Zero-call local scikit-learn audit over already-paid D309 labels and frozen final pairs.",
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
        "diagnostic_best_final_text_verifier": result["diagnostic_best_final_text_verifier"],
        "decision": result["decision"],
        "budget": result["budget"],
        "llm_budget": result["llm_budget"],
    }, indent=2))


def build_candidate_examples(judgments, request_by_id):
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
            "example_id": f"{judgment['request_id']}:chosen",
            "root_example_id": judgment["root_example_id"],
            "candidate_role": "chosen",
            "text": candidate_text(question, evidence, chosen),
            "label": int(bool(judgment["judgment"]["chosen_question_target_complete"])),
        })
        examples.append({
            "example_id": f"{judgment['request_id']}:rejected",
            "root_example_id": judgment["root_example_id"],
            "candidate_role": "rejected",
            "text": candidate_text(question, evidence, rejected),
            "label": int(bool(judgment["judgment"]["rejected_question_target_complete"])),
        })
    return examples


def evaluate_candidate_model(c_value, train_examples, final_pairs):
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=8000, sublinear_tf=True)),
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
    policy_id = f"candidate_tfidf_logreg_c_{str(c_value).replace('.', 'p')}"
    return {
        "policy_id": policy_id,
        "model": "tfidf_bigram_logistic_regression",
        "target": "candidate_question_target_complete",
        "c": c_value,
        "nonfinal_leave_one_out": loo,
        "final_pair_transfer": final,
    }, final_predictions


def candidate_text(question, evidence_pack, candidate):
    evidence = " ".join(
        f"[{item.get('evidence_id', '')}] {item.get('section', '')}: {item.get('text', '')}"
        for item in evidence_pack[:6]
    )
    claims = json.dumps(candidate.get("claim_table") or [], sort_keys=True)
    citations = " ".join(candidate.get("citations") or [])
    return "\n".join([
        f"question: {question}",
        f"evidence: {evidence}",
        f"answer_type: {candidate.get('answer_type')}",
        f"answer: {candidate.get('answer', '')}",
        f"citations: {citations}",
        f"claims: {claims}",
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
    best = result["diagnostic_best_final_text_verifier"]
    return f"""# Question-Target Text Verifier Audit

Generated: {result['generated_at']}

Status: `{result['status']}`

This audit trains only local TF-IDF/logistic models from the already-paid non-final D309 labels. It makes no OpenAI calls and launches no GPU jobs.

## Selected By Non-Final LOO

- Policy: {selected['policy_id']}
- LOO accuracy: {selected['nonfinal_leave_one_out']['accuracy']:.3f}
- LOO balanced accuracy: {selected['nonfinal_leave_one_out']['balanced_accuracy']:.3f}
- Final pair transfer: {selected['final_pair_transfer']['correct']}/{selected['final_pair_transfer']['pairs']} ({pct(selected['final_pair_transfer']['accuracy'])})

## Diagnostic Best Final Text Verifier

- Policy: {best['policy_id']}
- LOO balanced accuracy: {best['nonfinal_leave_one_out']['balanced_accuracy']:.3f}
- Final pair transfer: {best['final_pair_transfer']['correct']}/{best['final_pair_transfer']['pairs']} ({pct(best['final_pair_transfer']['accuracy'])})

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
