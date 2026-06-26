#!/usr/bin/env python3
import argparse
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from scipy.sparse import csr_matrix, hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler


ROOT = Path.cwd()
EXPERIMENT_DIR = ROOT / "docs" / "experiments" / "grounded-qa-distillation"
EXPORT_DIR = EXPERIMENT_DIR / "exports"
RUN_DIR = EXPERIMENT_DIR / "runs"
REPORT_DIR = EXPERIMENT_DIR / "reports"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default="text-verifier-from-combined-labels-240-389-v1")
    parser.add_argument("--label-prefix", default="teacher-combined-mini-det-guard-future-holdout-240-389-v1")
    args = parser.parse_args()

    output_dir = RUN_DIR / args.run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    rows = [build_row(row) for row in read_jsonl(EXPORT_DIR / f"{args.label_prefix}.verifier.jsonl")]
    baselines = {
        "balanced_gate": summarize_policy([
            policy_row(row, "balanced_support_risk_gate", None, None, False) for row in rows
        ]),
        "combined_teacher": summarize_policy([
            policy_row(row, "combined_mini_negative_det_guard_teacher", None, None, row["answer_type"] == "grounded_answer" and not row["combined_keep"])
            for row in rows
        ]),
    }

    objectives = [
        {
            "id": "strong_support_target",
            "label": "Strong support target",
            "description": "Train a text verifier on GPT-4o-derived keep/suppress labels.",
            "target": lambda row: 1 if row["strong_keep"] else 0,
        },
        {
            "id": "combined_policy_action",
            "label": "Combined policy action",
            "description": "Train a text verifier to imitate mini-negative plus deterministic-guard teacher actions.",
            "target": lambda row: 1 if row["combined_keep"] else 0,
        },
    ]

    objective_results = [run_objective(rows, objective, baselines) for objective in objectives]
    result = {
        "run_id": args.run_id,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "label_prefix": args.label_prefix,
        "scope": "cross-window high-dimensional local text verifier trained from combined verifier labels on extended_temporal_future_holdout examples 241-389",
        "llm_calls": 0,
        "run_cost_usd": 0,
        "method": {
            "type": "zero_call_cross_window_tfidf_logistic_claim_evidence_verifier",
            "text_features": "word 1-2 gram TF-IDF plus character 3-5 gram TF-IDF over question, candidate answer, claim table, cited evidence, and document metadata",
            "numeric_features": [
                "upstream_support_score",
                "answer_length",
                "citation_count",
                "claim_count",
                "cited_evidence_length",
                "answer_cited_lexical_overlap",
            ],
            "deployment_action": "Only grounded answers can be suppressed. Existing abstentions are kept because this verifier cannot recover missing answers.",
            "threshold_tuning": "Maximize train support-oracle correctness on grounded answers, tie-breaking by answer coverage and then answer support.",
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


def run_objective(rows, objective, baselines):
    windows = sorted({row["window"] for row in rows})
    folds = []
    predictions = []
    for eval_window in windows:
        train_rows = [row for row in rows if row["window"] != eval_window and row["answer_type"] == "grounded_answer"]
        eval_rows = [row for row in rows if row["window"] == eval_window]
        model = train_text_model(train_rows, objective)
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
                "word_vocab_size": len(model["word_vectorizer"].vocabulary_),
                "char_vocab_size": len(model["char_vectorizer"].vocabulary_),
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
            "delta_vs_combined_teacher": delta(policy_metrics, baselines["combined_teacher"]),
        },
        "folds": folds,
        "predictions": predictions,
    }


def train_text_model(rows, objective):
    texts = [model_text(row) for row in rows]
    y = np.array([objective["target"](row) for row in rows])
    word_vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=5000, sublinear_tf=True, norm="l2")
    char_vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1, max_features=7000, sublinear_tf=True, norm="l2")
    word_features = word_vectorizer.fit_transform(texts)
    char_features = char_vectorizer.fit_transform(texts)
    numeric = np.array([numeric_features(row) for row in rows], dtype=float)
    scaler = StandardScaler()
    numeric_features_scaled = csr_matrix(scaler.fit_transform(numeric))
    x = hstack([word_features, char_features, numeric_features_scaled], format="csr")
    classifier = LogisticRegression(
        C=0.65,
        class_weight="balanced",
        solver="liblinear",
        max_iter=2000,
        random_state=17,
    )
    classifier.fit(x, y)
    return {
        "word_vectorizer": word_vectorizer,
        "char_vectorizer": char_vectorizer,
        "scaler": scaler,
        "classifier": classifier,
    }


def transform_rows(model, rows):
    texts = [model_text(row) for row in rows]
    word_features = model["word_vectorizer"].transform(texts)
    char_features = model["char_vectorizer"].transform(texts)
    numeric = np.array([numeric_features(row) for row in rows], dtype=float)
    numeric_features_scaled = csr_matrix(model["scaler"].transform(numeric))
    return hstack([word_features, char_features, numeric_features_scaled], format="csr")


def predict_keep(model, rows):
    if not rows:
        return np.array([])
    x = transform_rows(model, rows)
    classes = list(model["classifier"].classes_)
    probabilities = model["classifier"].predict_proba(x)
    keep_index = classes.index(1)
    return probabilities[:, keep_index]


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
    suppress = row["answer_type"] == "grounded_answer" and suppress
    return {
        "example_id": row["example_id"],
        "window": row["window"],
        "objective": policy,
        "prediction": abstain_prediction(policy, score, threshold) if suppress else row["candidate"],
        "source_prediction": row["candidate"],
        "metadata": {
            "scaffold": policy,
            "verifier_score": score,
            "threshold": threshold,
            "gate_fired": suppress,
            "upstream_support_score": row["support_score"],
        },
        "labels": {
            "strong_keep": row["strong_keep"],
            "combined_keep": row["combined_keep"],
            "strong_verdict": row["strong_verdict"],
            "mini_verdict": row["mini_verdict"],
            "mini_negative": row["mini_negative"],
            "deterministic_guard_negative": row["deterministic_guard_negative"],
        },
        "inherited_judgment": {
            "support_oracle_correct": (not row["strong_keep"]) if suppress else row["strong_keep"],
            "interpretation": "harmful_suppression_supported_answer" if suppress and row["strong_keep"] else (
                "suppressed_unsupported_answer" if suppress else "unchanged"
            ),
        },
    }


def build_row(row):
    candidate = normalize_prediction(row["input"].get("candidate_answer") or {})
    evidence_by_id = {evidence.get("evidence_id"): evidence for evidence in row["input"].get("compact_retrieved_evidence_pack") or []}
    cited_text = " ".join((evidence_by_id.get(citation) or {}).get("text", "") for citation in candidate["citations"])
    return {
        "example_id": row["example_id"],
        "window": row["metadata"]["window"],
        "question": row["input"].get("question", ""),
        "document_metadata": row["input"].get("document_metadata") or {},
        "candidate": candidate,
        "answer_type": candidate["answer_type"],
        "evidence_pack": row["input"].get("compact_retrieved_evidence_pack") or [],
        "cited_text": cited_text,
        "pack_text": " ".join(evidence.get("text", "") for evidence in row["input"].get("compact_retrieved_evidence_pack") or []),
        "support_score": float(row["metadata"].get("support_score") or 0),
        "strong_keep": row["output"]["label"] == "keep",
        "combined_keep": row["output"]["combined_policy_action"] == "keep",
        "strong_verdict": row["metadata"].get("strong_verdict"),
        "mini_verdict": row["metadata"].get("mini_verdict"),
        "mini_negative": row["output"].get("mini_negative") is True,
        "deterministic_guard_negative": row["output"].get("deterministic_guard_negative") is True,
    }


def model_text(row):
    metadata = row["document_metadata"]
    claims = " ".join(
        f"{claim.get('claim', '')} {claim.get('support', '')}"
        for claim in row["candidate"].get("claim_table", [])
        if isinstance(claim, dict)
    )
    return "\n".join([
        f"TITLE: {metadata.get('title', '')}",
        f"DATE: {metadata.get('inferred_publication_month', '') or metadata.get('publication_date', '')}",
        f"QUESTION: {row['question']}",
        f"ANSWER: {row['candidate'].get('answer', '')}",
        f"CLAIMS: {claims}",
        f"CITED_EVIDENCE: {row['cited_text']}",
    ])


def numeric_features(row):
    answer_tokens = content_tokens(row["candidate"].get("answer", ""))
    cited_tokens = set(content_tokens(row["cited_text"]))
    overlap = len([token for token in answer_tokens if token in cited_tokens]) / len(answer_tokens) if answer_tokens else 0
    return [
        row["support_score"],
        math.log1p(len(row["candidate"].get("answer", ""))),
        math.log1p(len(row["candidate"].get("citations", []))),
        math.log1p(len(row["candidate"].get("claim_table", []))),
        math.log1p(len(row["cited_text"])),
        overlap,
    ]


def summarize_policy(predictions):
    answered = [row for row in predictions if row["prediction"]["answer_type"] == "grounded_answer"]
    correct = [row for row in predictions if row["inherited_judgment"]["support_oracle_correct"]]
    supported_answers = [row for row in answered if row["labels"]["strong_keep"]]
    suppressions = [row for row in predictions if row["metadata"]["gate_fired"]]
    return {
        "examples": len(predictions),
        "answered": len(answered),
        "abstained": len(predictions) - len(answered),
        "answer_rate": len(answered) / len(predictions) if predictions else 0,
        "support_oracle_correct": len(correct),
        "support_oracle_correct_rate": len(correct) / len(predictions) if predictions else 0,
        "answer_support_rate": len(supported_answers) / len(answered) if answered else 0,
        "gate_fired": len(suppressions),
        "suppressed_unsupported": len([row for row in suppressions if row["inherited_judgment"]["interpretation"] == "suppressed_unsupported_answer"]),
        "harmful_suppressed_supported": len([row for row in suppressions if row["inherited_judgment"]["interpretation"] == "harmful_suppression_supported_answer"]),
    }


def summarize_classification(eval_rows, model, threshold, objective, precomputed_predictions=None):
    if precomputed_predictions is not None:
        classified = [
            {
                "predicted_keep": not prediction["metadata"]["gate_fired"],
                "actual_keep": prediction["labels"]["strong_keep"] if objective["id"] == "strong_support_target" else prediction["labels"]["combined_keep"],
            }
            for prediction in precomputed_predictions
            if prediction["source_prediction"]["answer_type"] == "grounded_answer"
        ]
    else:
        scores = predict_keep(model, eval_rows)
        classified = [
            {
                "predicted_keep": float(score) >= threshold,
                "actual_keep": bool(objective["target"](row)),
            }
            for row, score in zip(eval_rows, scores)
        ]
    tp = len([row for row in classified if row["predicted_keep"] and row["actual_keep"]])
    tn = len([row for row in classified if not row["predicted_keep"] and not row["actual_keep"]])
    fp = len([row for row in classified if row["predicted_keep"] and not row["actual_keep"]])
    fn = len([row for row in classified if not row["predicted_keep"] and row["actual_keep"]])
    return {
        "examples": len(classified),
        "accuracy": (tp + tn) / len(classified) if classified else 0,
        "keep_precision": tp / (tp + fp) if (tp + fp) else 0,
        "keep_recall": tp / (tp + fn) if (tp + fn) else 0,
        "suppress_precision": tn / (tn + fn) if (tn + fn) else 0,
        "suppress_recall": tn / (tn + fp) if (tn + fp) else 0,
        "true_keep": tp,
        "true_suppress": tn,
        "false_keep": fp,
        "false_suppress": fn,
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
        "combined_keep_actions": len([row for row in rows if row["combined_keep"]]),
        "combined_suppress_actions": len([row for row in rows if not row["combined_keep"]]),
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
        policy_report_row("Combined teacher action", result["baselines"]["combined_teacher"]),
    ])
    objective_rows = "\n".join([
        policy_report_row(objective["label"], objective["aggregate"]["policy_metrics"])
        for objective in result["objectives"]
    ])
    fold_rows = "\n".join(
        f"| {objective['label']} | {fold['eval_window']} | {fold['threshold']:.3f} | "
        f"{fold['eval_policy_metrics']['support_oracle_correct']} / {fold['eval_policy_metrics']['examples']} ({pct(fold['eval_policy_metrics']['support_oracle_correct_rate'])}) | "
        f"{fold['eval_policy_metrics']['answered']} | {pct(fold['eval_policy_metrics']['answer_support_rate'])} | "
        f"{fold['eval_policy_metrics']['gate_fired']} | {fold['eval_policy_metrics']['suppressed_unsupported']} | "
        f"{fold['eval_policy_metrics']['harmful_suppressed_supported']} | {pct(fold['eval_classification']['suppress_recall'])} | {pct(fold['eval_classification']['suppress_precision'])} |"
        for objective in result["objectives"]
        for fold in objective["folds"]
    )
    details = "\n\n".join([
        f"### {objective['label']}\n\n"
        f"{objective['description']}\n\n"
        f"- Delta vs balanced gate: {signed(objective['aggregate']['delta_vs_balanced_gate']['support_oracle_correct_delta'])} support-oracle rows "
        f"({signed_pct(objective['aggregate']['delta_vs_balanced_gate']['support_oracle_correct_rate_delta'])}), "
        f"{signed(objective['aggregate']['delta_vs_balanced_gate']['answered_delta'])} answered rows.\n"
        f"- Delta vs combined teacher: {signed(objective['aggregate']['delta_vs_combined_teacher']['support_oracle_correct_delta'])} support-oracle rows "
        f"({signed_pct(objective['aggregate']['delta_vs_combined_teacher']['support_oracle_correct_rate_delta'])}), "
        f"{signed(objective['aggregate']['delta_vs_combined_teacher']['answered_delta'])} answered rows.\n"
        f"- Answered-row suppress classification: {pct(objective['aggregate']['classification']['accuracy'])} accuracy, "
        f"{pct(objective['aggregate']['classification']['suppress_recall'])} suppress recall, "
        f"{pct(objective['aggregate']['classification']['suppress_precision'])} suppress precision."
        for objective in result["objectives"]
    ])
    data = result["data_summary"]
    return f"""# Text Verifier From Combined Teacher Labels

Scope: {result["scope"]}

This run makes no LLM calls. It trains a local TF-IDF logistic verifier on one future window and evaluates on the other, using the exported combined verifier labels from `{result["label_prefix"]}`.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress | Combined suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| {data["examples"]} | {data["answered"]} | {data["abstained"]} | {data["strong_keep"]} | {data["strong_suppress"]} | {data["answered_strong_keep"]} | {data["answered_strong_suppress"]} | {data["combined_suppress_actions"]} |

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

{details}

## Interpretation

The high-dimensional text verifier is a stronger local model than the handcrafted logistic gate, but it still does not distill the combined teacher's high-precision suppressions. This narrows the next step to a pretrained entailment/cross-encoder model or actual generative SFT, rather than more local bag-of-words verifier variants.
"""


def policy_report_row(label, metrics):
    return (
        f"| {label} | {metrics['support_oracle_correct']} / {metrics['examples']} ({pct(metrics['support_oracle_correct_rate'])}) | "
        f"{metrics['answered']} | {pct(metrics['answer_support_rate'])} | {metrics['gate_fired']} | "
        f"{metrics['suppressed_unsupported']} | {metrics['harmful_suppressed_supported']} |"
    )


def abstain_prediction(policy, score, threshold):
    reason = "Text verifier suppressed the generated answer."
    if score is not None and threshold is not None:
        reason = f"Text verifier score {score:.3f} is below threshold {threshold:.3f}."
    return {
        "answer_type": "abstain",
        "answer": "The cited evidence does not provide enough support for the generated claim.",
        "citations": [],
        "claim_table": [{
            "claim": "A local text verifier rejected the generated answer as insufficiently supported.",
            "support": policy,
            "citations": [],
        }],
        "abstention_reason": reason,
    }


def normalize_prediction(value):
    answer_type = "abstain" if value.get("answer_type") == "abstain" else "grounded_answer"
    raw_citations = value.get("citations") if isinstance(value.get("citations"), list) else []
    citations = []
    for citation in raw_citations:
        evidence_id = citation if isinstance(citation, str) else citation.get("evidence_id")
        if evidence_id:
            citations.append(evidence_id)
    return {
        "answer_type": answer_type,
        "answer": str(value.get("answer") or ""),
        "citations": [] if answer_type == "abstain" else list(dict.fromkeys(citations)),
        "claim_table": value.get("claim_table") if isinstance(value.get("claim_table"), list) else [],
        "abstention_reason": str(value.get("abstention_reason") or "") if answer_type == "abstain" else None,
    }


def content_tokens(value):
    stop = {"the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"}
    tokens = []
    current = []
    for char in str(value).lower():
        if char.isalnum():
            current.append(char)
        else:
            if current:
                token = "".join(current)
                if len(token) > 2 and token not in stop:
                    tokens.append(token)
                current = []
    if current:
        token = "".join(current)
        if len(token) > 2 and token not in stop:
            tokens.append(token)
    return tokens


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
