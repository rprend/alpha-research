#!/usr/bin/env python3
import argparse
import json
import math
import os
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from transformers import AutoModelForSequenceClassification, AutoTokenizer

warnings.filterwarnings("ignore", category=RuntimeWarning, module="sklearn.utils.extmath")


ROOT = Path.cwd()
EXPERIMENT_DIR = ROOT / "docs" / "experiments" / "grounded-qa-distillation"
EXPORT_DIR = EXPERIMENT_DIR / "exports"
RUN_DIR = EXPERIMENT_DIR / "runs"
REPORT_DIR = EXPERIMENT_DIR / "reports"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default="sequence-verifier-from-mini-negative-labels-160-389-v1")
    parser.add_argument("--label-prefix", default="teacher-mini-negative-future-holdout-160-389-v1")
    parser.add_argument("--model", default="cross-encoder/nli-distilroberta-base")
    parser.add_argument("--batch-size", type=int, default=8)
    args = parser.parse_args()

    output_dir = RUN_DIR / args.run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    rows = [build_row(row) for row in read_jsonl(EXPORT_DIR / f"{args.label_prefix}.verifier.jsonl")]
    answered = [row for row in rows if row["answer_type"] == "grounded_answer"]
    embedding_path = output_dir / "sequence-embeddings.jsonl"
    embeddings = load_or_embed(answered, embedding_path, args.model, args.batch_size)
    embedding_by_id = {row["example_id"]: row for row in embeddings}
    for row in rows:
        row["embedding"] = embedding_by_id.get(row["example_id"], {}).get("embedding")
        row["sequence_logits"] = embedding_by_id.get(row["example_id"], {}).get("logits")

    baselines = {
        "balanced_gate": summarize_policy([
            policy_row(row, "balanced_support_risk_gate", None, None, False) for row in rows
        ]),
        "exported_teacher": summarize_policy([
            policy_row(row, "exported_mini_negative_teacher", None, None, row["answer_type"] == "grounded_answer" and not row["teacher_keep"])
            for row in rows
        ]),
    }
    objectives = [
        {
            "id": "strong_support_target",
            "label": "Strong support target",
            "description": "Train a sequence-embedding verifier on GPT-4o-derived keep/suppress labels.",
            "target": lambda row: 1 if row["strong_keep"] else 0,
        },
        {
            "id": "teacher_policy_action",
            "label": "Exported policy action",
            "description": "Train a sequence-embedding verifier to imitate the exported mini-negative teacher action.",
            "target": lambda row: 1 if row["teacher_keep"] else 0,
        },
    ]
    objective_results = [run_objective(rows, objective, baselines) for objective in objectives]
    result = {
        "run_id": args.run_id,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "label_prefix": args.label_prefix,
        "scope": "leave-window-out frozen pretrained sequence verifier over cited evidence and candidate answers on extended_temporal_future_holdout examples 161-389",
        "llm_calls": 0,
        "run_cost_usd": 0,
        "method": {
            "type": "zero_call_frozen_nli_sequence_embedding_logistic_verifier",
            "base_model": args.model,
            "input_pair": "premise is concatenated cited evidence; hypothesis is candidate answer plus claim-table claims",
            "features": "CLS embedding from the final hidden state plus sequence-classification logits",
            "deployment_action": "Only grounded answers can be suppressed. Existing abstentions are kept.",
            "threshold_tuning": "Maximize train support-oracle correctness, tie-breaking by answer coverage and then answer support.",
        },
        "data_summary": summarize_data(rows),
        "baselines": baselines,
        "objectives": objective_results,
    }
    result["best_objective"] = sorted(
        [
            {
                "id": objective["id"],
                "support_oracle_correct_rate": objective["aggregate"]["policy_metrics"]["support_oracle_correct_rate"],
                "support_oracle_correct": objective["aggregate"]["policy_metrics"]["support_oracle_correct"],
                "answered": objective["aggregate"]["policy_metrics"]["answered"],
                "suppressions": objective["aggregate"]["policy_metrics"]["gate_fired"],
            }
            for objective in objective_results
        ],
        key=lambda row: (
            row["support_oracle_correct_rate"],
            row["answered"],
            -row["suppressions"],
        ),
        reverse=True,
    )[0]

    predictions = []
    for objective in objective_results:
        predictions.extend(objective.pop("predictions"))

    write_jsonl(output_dir / "predictions.jsonl", predictions)
    (output_dir / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    report = render_report(result)
    (output_dir / "report.md").write_text(report)
    (REPORT_DIR / f"{args.run_id}.md").write_text(report)

    print(json.dumps({
        "run_id": args.run_id,
        "result": str((output_dir / "result.json").relative_to(ROOT)),
        "report": str((output_dir / "report.md").relative_to(ROOT)),
        "summary_report": str((REPORT_DIR / f"{args.run_id}.md").relative_to(ROOT)),
        "data_summary": result["data_summary"],
        "baselines": baselines,
        "best_objective": result["best_objective"],
        "objective_summaries": [
            {"id": objective["id"], "aggregate": objective["aggregate"]}
            for objective in result["objectives"]
        ],
    }, indent=2))


def load_or_embed(rows, output_path, model_id, batch_size):
    if output_path.exists():
        existing = read_jsonl(output_path)
        if len(existing) == len(rows):
            return existing

    tokenizer = AutoTokenizer.from_pretrained(model_id, use_fast=False)
    model = AutoModelForSequenceClassification.from_pretrained(model_id, output_hidden_states=True)
    model.eval()
    result = []
    with torch.no_grad():
        for start in range(0, len(rows), batch_size):
            batch = rows[start:start + batch_size]
            encoded = tokenizer(
                [truncate(row["premise"], 3600) for row in batch],
                [truncate(row["hypothesis"], 900) for row in batch],
                truncation=True,
                max_length=512,
                padding=True,
                return_tensors="pt",
            )
            outputs = model(**encoded)
            hidden = outputs.hidden_states[-1][:, 0, :].cpu().numpy()
            logits = outputs.logits.cpu().numpy()
            for row, embedding, logit in zip(batch, hidden, logits):
                result.append({
                    "example_id": row["example_id"],
                    "embedding": [float(value) for value in embedding],
                    "logits": [float(value) for value in logit],
                })
    write_jsonl(output_path, result)
    return result


def run_objective(rows, objective, baselines):
    windows = sorted({row["window"] for row in rows})
    folds = []
    predictions = []
    for eval_window in windows:
        train_rows = [row for row in rows if row["window"] != eval_window and row["answer_type"] == "grounded_answer"]
        eval_rows = [row for row in rows if row["window"] == eval_window]
        model = train_model(train_rows, objective)
        threshold = tune_threshold(train_rows, model, objective)
        fold_predictions = [apply_model(row, model, threshold, objective) for row in eval_rows]
        predictions.extend(fold_predictions)
        folds.append({
            "train_windows": [window for window in windows if window != eval_window],
            "eval_window": eval_window,
            "train_examples": len(train_rows),
            "eval_examples": len(eval_rows),
            "threshold": threshold,
            "train_classification": summarize_classification(train_rows, model, threshold, objective),
            "eval_classification": summarize_classification([row for row in eval_rows if row["answer_type"] == "grounded_answer"], model, threshold, objective),
            "eval_policy_metrics": summarize_policy(fold_predictions),
            "model": {
                "classes": [int(value) for value in model["classifier"].classes_],
                "feature_count": int(model["feature_count"]),
            },
        })

    policy_metrics = summarize_policy(predictions)
    return {
        "id": objective["id"],
        "label": objective["label"],
        "description": objective["description"],
        "aggregate": {
            "classification": summarize_classification([row for row in rows if row["answer_type"] == "grounded_answer"], None, None, objective, predictions),
            "policy_metrics": policy_metrics,
            "delta_vs_balanced_gate": delta(policy_metrics, baselines["balanced_gate"]),
            "delta_vs_exported_teacher": delta(policy_metrics, baselines["exported_teacher"]),
        },
        "folds": folds,
        "predictions": predictions,
    }


def train_model(rows, objective):
    x = finite_features([features(row) for row in rows])
    y = np.array([objective["target"](row) for row in rows], dtype=int)
    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(x)
    classifier = LogisticRegression(
        C=0.25,
        class_weight="balanced",
        solver="liblinear",
        max_iter=2000,
        random_state=19,
    )
    classifier.fit(x_scaled, y)
    return {"scaler": scaler, "classifier": classifier, "feature_count": x.shape[1]}


def features(row):
    return np.array(row["embedding"] + row["sequence_logits"] + [
        row["support_score"],
        math.log1p(row["citation_count"]),
        math.log1p(row["claim_count"]),
        math.log1p(row["answer_token_count"]),
    ], dtype=float)


def predict_keep(model, rows):
    if not rows:
        return np.array([])
    x = finite_features([features(row) for row in rows])
    x_scaled = model["scaler"].transform(x)
    classes = list(model["classifier"].classes_)
    probabilities = model["classifier"].predict_proba(x_scaled)
    return probabilities[:, classes.index(1)]


def finite_features(rows):
    x = np.nan_to_num(np.array(rows, dtype=float), nan=0.0, posinf=100.0, neginf=-100.0)
    return np.clip(x, -100.0, 100.0)


def tune_threshold(train_rows, model, objective):
    scores = predict_keep(model, train_rows)
    candidates = sorted(set([0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] + [float(score) for score in scores]))
    best = None
    for threshold in candidates:
        metrics = summarize_policy([apply_model(row, model, threshold, objective) for row in train_rows])
        if best is None or better(metrics, best["metrics"]):
            best = {"threshold": threshold, "metrics": metrics}
    return best["threshold"]


def better(left, right):
    if abs(left["support_oracle_correct_rate"] - right["support_oracle_correct_rate"]) > 1e-12:
        return left["support_oracle_correct_rate"] > right["support_oracle_correct_rate"]
    if left["answered"] != right["answered"]:
        return left["answered"] > right["answered"]
    return left["answer_support_rate"] > right["answer_support_rate"]


def apply_model(row, model, threshold, objective):
    if row["answer_type"] != "grounded_answer":
        return policy_row(row, objective["id"], None, threshold, False)
    score = float(predict_keep(model, [row])[0])
    return policy_row(row, objective["id"], score, threshold, score < threshold)


def policy_row(row, policy, score, threshold, suppress):
    suppress = row["answer_type"] == "grounded_answer" and bool(suppress)
    return {
        "example_id": row["example_id"],
        "window": row["window"],
        "prediction": abstain_prediction(policy, score, threshold) if suppress else row["candidate"],
        "source_prediction": row["candidate"],
        "metadata": {
            "scaffold": policy,
            "sequence_keep_score": score,
            "threshold": threshold,
            "gate_fired": suppress,
            "upstream_support_score": row["support_score"],
        },
        "labels": {
            "strong_keep": row["strong_keep"],
            "teacher_keep": row["teacher_keep"],
            "strong_verdict": row["strong_verdict"],
            "mini_verdict": row["mini_verdict"],
        },
        "inherited_judgment": {
            "support_oracle_correct": (not row["strong_keep"]) if suppress else row["strong_keep"],
            "interpretation": (
                "harmful_suppression_supported_answer" if suppress and row["strong_keep"]
                else "suppressed_unsupported_answer" if suppress
                else "unchanged"
            ),
        },
    }


def abstain_prediction(policy, score, threshold):
    return {
        "answer_type": "abstain",
        "answer": "The cited evidence does not provide enough support for the generated claim.",
        "citations": [],
        "claim_table": [{
            "claim": "A sequence verifier rejected the generated answer as insufficiently supported.",
            "support": policy,
            "citations": [],
        }],
        "abstention_reason": (
            f"Sequence keep score {score:.3f} is below threshold {threshold:.3f}."
            if score is not None and threshold is not None
            else "Suppressed by sequence verifier."
        ),
    }


def build_row(row):
    candidate = normalize_prediction(row["input"].get("candidate_answer", {}))
    evidence_by_id = {evidence["evidence_id"]: evidence for evidence in row["input"].get("compact_retrieved_evidence_pack", [])}
    cited_text = " ".join(evidence_by_id.get(cid, {}).get("text", "") for cid in candidate["citations"])
    hypothesis = " ".join([
        strip_citations(candidate["answer"]),
        " ".join(strip_citations(f"{claim.get('claim', '')} {claim.get('support', '')}") for claim in candidate.get("claim_table", [])),
    ]).strip()
    return {
        "example_id": row["example_id"],
        "window": row["metadata"]["window"],
        "candidate": candidate,
        "answer_type": candidate["answer_type"],
        "premise": cited_text,
        "hypothesis": hypothesis,
        "support_score": float(row["metadata"].get("support_score") or 0),
        "citation_count": len(candidate["citations"]),
        "claim_count": len(candidate.get("claim_table", [])),
        "answer_token_count": len(content_tokens(candidate["answer"])),
        "strong_keep": row["output"]["label"] == "keep",
        "teacher_keep": row["output"].get("policy_action", row["output"].get("combined_policy_action")) == "keep",
        "strong_verdict": row["metadata"].get("strong_verdict"),
        "mini_verdict": row["metadata"].get("mini_verdict"),
    }


def normalize_prediction(value):
    answer_type = "abstain" if value.get("answer_type") == "abstain" else "grounded_answer"
    citations = []
    if isinstance(value.get("citations"), list):
        for citation in value["citations"]:
            if isinstance(citation, str):
                citations.append(citation)
            elif citation and citation.get("evidence_id"):
                citations.append(citation["evidence_id"])
    return {
        "answer_type": answer_type,
        "answer": str(value.get("answer", "")),
        "citations": [] if answer_type == "abstain" else sorted(set(citations)),
        "claim_table": value.get("claim_table") if isinstance(value.get("claim_table"), list) else [],
        "abstention_reason": str(value.get("abstention_reason", "")) if answer_type == "abstain" else None,
    }


def summarize_policy(predictions):
    answered = [row for row in predictions if row["prediction"]["answer_type"] == "grounded_answer"]
    correct = [row for row in predictions if row["inherited_judgment"]["support_oracle_correct"]]
    supported_answers = [row for row in answered if row["labels"]["strong_keep"]]
    suppressions = [row for row in predictions if row["metadata"]["gate_fired"]]
    return {
        "examples": len(predictions),
        "answered": len(answered),
        "abstained": len(predictions) - len(answered),
        "answer_rate": ratio(len(answered), len(predictions)),
        "support_oracle_correct": len(correct),
        "support_oracle_correct_rate": ratio(len(correct), len(predictions)),
        "answer_support_rate": ratio(len(supported_answers), len(answered)),
        "gate_fired": len(suppressions),
        "suppressed_unsupported": len([row for row in suppressions if row["inherited_judgment"]["interpretation"] == "suppressed_unsupported_answer"]),
        "harmful_suppressed_supported": len([row for row in suppressions if row["inherited_judgment"]["interpretation"] == "harmful_suppression_supported_answer"]),
    }


def summarize_classification(rows, model, threshold, objective, precomputed_predictions=None):
    if precomputed_predictions is None:
        predictions = [apply_model(row, model, threshold, objective) for row in rows]
    else:
        ids = {row["example_id"] for row in rows}
        predictions = [row for row in precomputed_predictions if row["example_id"] in ids]
    if not predictions:
        return {"examples": 0, "accuracy": 0, "keep_precision": 0, "keep_recall": 0, "suppress_precision": 0, "suppress_recall": 0}
    true_keep = [row["labels"]["strong_keep"] if objective["id"] == "strong_support_target" else row["labels"]["teacher_keep"] for row in predictions]
    pred_keep = [not row["metadata"]["gate_fired"] for row in predictions]
    tp_keep = sum(1 for actual, pred in zip(true_keep, pred_keep) if actual and pred)
    fp_keep = sum(1 for actual, pred in zip(true_keep, pred_keep) if not actual and pred)
    fn_keep = sum(1 for actual, pred in zip(true_keep, pred_keep) if actual and not pred)
    tp_suppress = sum(1 for actual, pred in zip(true_keep, pred_keep) if not actual and not pred)
    fp_suppress = sum(1 for actual, pred in zip(true_keep, pred_keep) if actual and not pred)
    fn_suppress = sum(1 for actual, pred in zip(true_keep, pred_keep) if not actual and pred)
    return {
        "examples": len(predictions),
        "accuracy": ratio(sum(1 for actual, pred in zip(true_keep, pred_keep) if actual == pred), len(predictions)),
        "keep_precision": ratio(tp_keep, tp_keep + fp_keep),
        "keep_recall": ratio(tp_keep, tp_keep + fn_keep),
        "suppress_precision": ratio(tp_suppress, tp_suppress + fp_suppress),
        "suppress_recall": ratio(tp_suppress, tp_suppress + fn_suppress),
        "true_keep": tp_keep,
        "true_suppress": tp_suppress,
        "false_keep": fp_keep,
        "false_suppress": fp_suppress,
    }


def summarize_data(rows):
    answered = [row for row in rows if row["answer_type"] == "grounded_answer"]
    return {
        "examples": len(rows),
        "answered": len(answered),
        "abstained": len(rows) - len(answered),
        "strong_keep": len([row for row in rows if row["strong_keep"]]),
        "strong_suppress": len([row for row in rows if not row["strong_keep"]]),
        "answered_strong_keep": len([row for row in answered if row["strong_keep"]]),
        "answered_strong_suppress": len([row for row in answered if not row["strong_keep"]]),
        "teacher_keep_actions": len([row for row in rows if row["teacher_keep"]]),
        "teacher_suppress_actions": len([row for row in rows if not row["teacher_keep"]]),
    }


def delta(left, right):
    return {
        "answered_delta": left["answered"] - right["answered"],
        "support_oracle_correct_delta": left["support_oracle_correct"] - right["support_oracle_correct"],
        "support_oracle_correct_rate_delta": left["support_oracle_correct_rate"] - right["support_oracle_correct_rate"],
        "answer_support_rate_delta": left["answer_support_rate"] - right["answer_support_rate"],
        "gate_fired_delta": left["gate_fired"] - right["gate_fired"],
    }


def render_report(result):
    baseline_rows = "\n".join([
        policy_report_row("Balanced support-risk gate", result["baselines"]["balanced_gate"]),
        policy_report_row("Exported teacher action", result["baselines"]["exported_teacher"]),
    ])
    objective_rows = "\n".join([
        policy_report_row(objective["label"], objective["aggregate"]["policy_metrics"])
        for objective in result["objectives"]
    ])
    fold_rows = "\n".join(
        f"| {objective['label']} | {fold['eval_window']} | {fold['threshold']:.3f} | "
        f"{fold['eval_policy_metrics']['support_oracle_correct']} / {fold['eval_policy_metrics']['examples']} ({pct(fold['eval_policy_metrics']['support_oracle_correct_rate'])}) | "
        f"{fold['eval_policy_metrics']['answered']} | {pct(fold['eval_policy_metrics']['answer_support_rate'])} | "
        f"{fold['eval_policy_metrics']['gate_fired']} | {fold['eval_policy_metrics']['suppressed_unsupported']} | {fold['eval_policy_metrics']['harmful_suppressed_supported']} | "
        f"{pct(fold['eval_classification']['suppress_recall'])} | {pct(fold['eval_classification']['suppress_precision'])} |"
        for objective in result["objectives"]
        for fold in objective["folds"]
    )
    objective_details = "\n\n".join(
        f"### {objective['label']}\n\n"
        f"{objective['description']}\n\n"
        f"- Delta vs balanced gate: {signed(objective['aggregate']['delta_vs_balanced_gate']['support_oracle_correct_delta'])} support-oracle rows "
        f"({signed_pct(objective['aggregate']['delta_vs_balanced_gate']['support_oracle_correct_rate_delta'])}), "
        f"{signed(objective['aggregate']['delta_vs_balanced_gate']['answered_delta'])} answered rows.\n"
        f"- Delta vs exported teacher: {signed(objective['aggregate']['delta_vs_exported_teacher']['support_oracle_correct_delta'])} support-oracle rows "
        f"({signed_pct(objective['aggregate']['delta_vs_exported_teacher']['support_oracle_correct_rate_delta'])}), "
        f"{signed(objective['aggregate']['delta_vs_exported_teacher']['answered_delta'])} answered rows.\n"
        f"- Answered-row suppress classification: {pct(objective['aggregate']['classification']['accuracy'])} accuracy, "
        f"{pct(objective['aggregate']['classification']['suppress_recall'])} suppress recall, "
        f"{pct(objective['aggregate']['classification']['suppress_precision'])} suppress precision."
        for objective in result["objectives"]
    )
    data = result["data_summary"]
    return f"""# Sequence Verifier From Mini-Negative Teacher Labels

Scope: {result["scope"]}

This run makes no OpenAI calls. It embeds cited-evidence/candidate-answer pairs with `{result["method"]["base_model"]}` and trains only a small logistic verifier head in leave-window-out evaluation.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress | Teacher suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| {data["examples"]} | {data["answered"]} | {data["abstained"]} | {data["strong_keep"]} | {data["strong_suppress"]} | {data["answered_strong_keep"]} | {data["answered_strong_suppress"]} | {data["teacher_suppress_actions"]} |

## Aggregate Policy Result

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
{baseline_rows}
{objective_rows}

## Cross-Window Folds

| Objective | Eval window | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Suppress recall | Suppress precision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
{fold_rows}

## Objective Details

{objective_details}

## Interpretation

This tests whether a pretrained claim/evidence sequence representation can recover the mini-negative teacher's sparse high-precision suppressions better than hand-engineered or TF-IDF features. A useful amortized verifier should improve support-oracle correctness over the balanced gate and approach the exported teacher without calling an LLM at inference time.
"""


def policy_report_row(label, metrics):
    return (
        f"| {label} | {metrics['support_oracle_correct']} / {metrics['examples']} ({pct(metrics['support_oracle_correct_rate'])}) | "
        f"{metrics['answered']} | {pct(metrics['answer_support_rate'])} | {metrics['gate_fired']} | "
        f"{metrics['suppressed_unsupported']} | {metrics['harmful_suppressed_supported']} |"
    )


def content_tokens(value):
    return [token for token in str(value).lower().replace("[", " ").replace("]", " ").split() if len(token) > 2]


def strip_citations(value):
    import re
    return re.sub(r"\s*\[[^\]]+\]", "", str(value)).strip()


def truncate(value, max_length):
    text = str(value or "")
    return text if len(text) <= max_length else text[:max_length]


def ratio(numerator, denominator):
    return numerator / denominator if denominator else 0


def pct(value):
    return f"{float(value) * 100:.1f}%"


def signed(value):
    return f"+{value}" if value > 0 else str(value)


def signed_pct(value):
    rendered = f"{float(value) * 100:.1f}pp"
    return f"+{rendered}" if value > 0 else rendered


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def write_jsonl(path, rows):
    path.write_text("".join(json.dumps(row) + "\n" for row in rows))


if __name__ == "__main__":
    main()
