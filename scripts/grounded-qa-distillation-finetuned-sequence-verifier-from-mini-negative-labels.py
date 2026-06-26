#!/usr/bin/env python3
import argparse
import importlib.util
import json
import random
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import logging as transformers_logging
from transformers import AutoModelForSequenceClassification, AutoTokenizer


ROOT = Path.cwd()
EXPERIMENT_DIR = ROOT / "docs" / "experiments" / "grounded-qa-distillation"
EXPORT_DIR = EXPERIMENT_DIR / "exports"
RUN_DIR = EXPERIMENT_DIR / "runs"
REPORT_DIR = EXPERIMENT_DIR / "reports"

BASE_SCRIPT = ROOT / "scripts" / "grounded-qa-distillation-sequence-verifier-from-mini-negative-labels.py"
spec = importlib.util.spec_from_file_location("sequence_verifier_base", BASE_SCRIPT)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
transformers_logging.set_verbosity_error()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default="finetuned-sequence-verifier-from-mini-negative-labels-160-389-v1")
    parser.add_argument("--label-prefix", default="teacher-mini-negative-future-holdout-160-389-v1")
    parser.add_argument("--model", default="cross-encoder/nli-distilroberta-base")
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--epochs", type=int, default=6)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--max-length", type=int, default=512)
    parser.add_argument("--unfreeze-last-layers", type=int, default=2)
    parser.add_argument("--augment-hard-negatives", action="store_true")
    parser.add_argument("--max-augmented-per-train-row", type=int, default=2)
    parser.add_argument("--seed", type=int, default=23)
    args = parser.parse_args()

    set_seed(args.seed)
    output_dir = RUN_DIR / args.run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    rows = [base.build_row(row) for row in base.read_jsonl(EXPORT_DIR / f"{args.label_prefix}.verifier.jsonl")]
    baselines = {
        "balanced_gate": base.summarize_policy([
            base.policy_row(row, "balanced_support_risk_gate", None, None, False) for row in rows
        ]),
        "exported_teacher": base.summarize_policy([
            base.policy_row(
                row,
                "exported_mini_negative_teacher",
                None,
                None,
                row["answer_type"] == "grounded_answer" and not row["teacher_keep"],
            )
            for row in rows
        ]),
    }

    objectives = [
        {
            "id": "strong_support_target",
            "label": "Strong support target",
            "description": "Fine-tune a binary sequence verifier on GPT-4o-derived keep/suppress labels.",
            "target": lambda row: 0 if row["strong_keep"] else 1,
            "true_keep": lambda row: row["strong_keep"],
        },
        {
            "id": "teacher_policy_action",
            "label": "Exported policy action",
            "description": "Fine-tune a binary sequence verifier to imitate the exported mini-negative teacher action.",
            "target": lambda row: 0 if row["teacher_keep"] else 1,
            "true_keep": lambda row: row["teacher_keep"],
        },
    ]

    tokenizer = AutoTokenizer.from_pretrained(args.model, use_fast=False)
    objective_results = [
        run_objective(rows, objective, baselines, tokenizer, args)
        for objective in objectives
    ]
    result = {
        "run_id": args.run_id,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "label_prefix": args.label_prefix,
        "scope": "leave-window-out supervised fine-tuned sequence verifier over cited evidence and candidate answers on extended_temporal_future_holdout examples 161-389",
        "llm_calls": 0,
        "run_cost_usd": 0,
        "method": {
            "type": "zero_openai_supervised_sequence_classifier_finetune",
            "base_model": args.model,
            "input_pair": "premise is concatenated cited evidence; hypothesis is candidate answer plus claim-table claims",
            "training": {
                "epochs": args.epochs,
                "batch_size": args.batch_size,
                "learning_rate": args.learning_rate,
                "max_length": args.max_length,
                "unfreeze_last_layers": args.unfreeze_last_layers,
                "augment_hard_negatives": args.augment_hard_negatives,
                "max_augmented_per_train_row": args.max_augmented_per_train_row,
                "seed": args.seed,
                "class_weighting": "inverse-frequency cross entropy over answered training rows",
            },
            "deployment_action": "Only grounded answers can be suppressed. Existing abstentions are kept.",
            "threshold_tuning": "Maximize train support-oracle correctness, tie-breaking by answer coverage and then answer support.",
        },
        "data_summary": base.summarize_data(rows),
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

    base.write_jsonl(output_dir / "predictions.jsonl", predictions)
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


def run_objective(rows, objective, baselines, tokenizer, args):
    windows = sorted({row["window"] for row in rows})
    folds = []
    predictions = []
    for fold_index, eval_window in enumerate(windows):
        set_seed(args.seed + fold_index)
        train_rows = [row for row in rows if row["window"] != eval_window and row["answer_type"] == "grounded_answer"]
        augmented_rows = augment_training_rows(train_rows, args) if args.augment_hard_negatives else []
        training_rows = train_rows + augmented_rows
        eval_rows = [row for row in rows if row["window"] == eval_window]
        model = train_model(training_rows, objective, tokenizer, args)
        train_scores = score_rows(model, tokenizer, train_rows, args)
        threshold = tune_threshold(train_rows, train_scores)
        eval_scores = score_rows(model, tokenizer, [row for row in eval_rows if row["answer_type"] == "grounded_answer"], args)
        fold_predictions = [apply_model(row, eval_scores, threshold, objective) for row in eval_rows]
        predictions.extend(fold_predictions)
        folds.append({
            "train_windows": [window for window in windows if window != eval_window],
            "eval_window": eval_window,
            "train_examples": len(train_rows),
            "augmented_train_examples": len(augmented_rows),
            "eval_examples": len(eval_rows),
            "threshold": threshold,
            "train_classification": summarize_classification_from_scores(train_rows, train_scores, threshold, objective),
            "eval_classification": summarize_classification_from_predictions(
                [row for row in fold_predictions if row["source_prediction"]["answer_type"] == "grounded_answer"],
                objective,
            ),
            "eval_policy_metrics": base.summarize_policy(fold_predictions),
            "training": model.training_summary,
        })
        del model

    policy_metrics = base.summarize_policy(predictions)
    return {
        "id": objective["id"],
        "label": objective["label"],
        "description": objective["description"],
        "aggregate": {
            "classification": summarize_classification_from_predictions(
                [row for row in predictions if row["source_prediction"]["answer_type"] == "grounded_answer"],
                objective,
            ),
            "policy_metrics": policy_metrics,
            "delta_vs_balanced_gate": base.delta(policy_metrics, baselines["balanced_gate"]),
            "delta_vs_exported_teacher": base.delta(policy_metrics, baselines["exported_teacher"]),
        },
        "folds": folds,
        "predictions": predictions,
    }


def train_model(rows, objective, tokenizer, args):
    labels = [objective["target"](row) for row in rows]
    class_counts = np.bincount(labels, minlength=2)
    weights = len(labels) / np.maximum(class_counts, 1)
    weights = torch.tensor(weights / weights.mean(), dtype=torch.float32)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model,
        num_labels=2,
        ignore_mismatched_sizes=True,
    )
    configure_trainable_layers(model, args.unfreeze_last_layers)
    dataset = PairDataset(rows, labels, tokenizer, args.max_length)
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.learning_rate)
    criterion = torch.nn.CrossEntropyLoss(weight=weights)
    model.train()
    epoch_losses = []
    for _ in range(args.epochs):
        losses = []
        for batch in loader:
            optimizer.zero_grad(set_to_none=True)
            labels_tensor = batch.pop("labels")
            outputs = model(**batch)
            loss = criterion(outputs.logits, labels_tensor)
            loss.backward()
            torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad], 1.0)
            optimizer.step()
            losses.append(float(loss.detach().cpu()))
        epoch_losses.append(sum(losses) / len(losses) if losses else 0.0)
    model.training_summary = {
        "epochs": args.epochs,
        "train_rows": len(rows),
        "target_keep": int(class_counts[0]),
        "target_suppress": int(class_counts[1]),
        "trainable_parameters": sum(p.numel() for p in model.parameters() if p.requires_grad),
        "total_parameters": sum(p.numel() for p in model.parameters()),
        "epoch_losses": epoch_losses,
    }
    model.eval()
    return model


def augment_training_rows(rows, args):
    augmented = []
    answered_supported = [row for row in rows if row["answer_type"] == "grounded_answer" and row["strong_keep"]]
    for index, row in enumerate(answered_supported):
        created_for_row = 0
        shuffled = shuffled_evidence_negative(row, answered_supported, index)
        if shuffled:
            augmented.append(shuffled)
            created_for_row += 1
        if created_for_row < args.max_augmented_per_train_row:
            numeric = numeric_perturbation_negative(row)
            if numeric:
                augmented.append(numeric)
                created_for_row += 1
        if created_for_row < args.max_augmented_per_train_row:
            claim_only = claim_support_mismatch_negative(row)
            if claim_only:
                augmented.append(claim_only)
    return augmented


def negative_copy(row, suffix):
    copied = json.loads(json.dumps(row))
    copied["example_id"] = f"{row['example_id']}::synthetic-{suffix}"
    copied["strong_keep"] = False
    copied["teacher_keep"] = False
    copied["strong_verdict"] = "synthetic_train_hard_negative"
    copied["mini_verdict"] = "synthetic_train_hard_negative"
    copied["synthetic_negative"] = suffix
    return copied


def shuffled_evidence_negative(row, rows, index):
    if len(rows) < 2:
        return None
    other = rows[(index + 17) % len(rows)]
    if other["example_id"] == row["example_id"] or not other.get("premise"):
        other = rows[(index + 1) % len(rows)]
    if other["example_id"] == row["example_id"] or not other.get("premise"):
        return None
    copied = negative_copy(row, "cited-evidence-shuffle")
    copied["premise"] = other["premise"]
    return copied


def numeric_perturbation_negative(row):
    text = row.get("hypothesis", "")
    match = re.search(r"\b\d+(?:,\d{3})*(?:\.\d+)?\b", text)
    if not match:
        return None
    original = match.group(0)
    replacement = perturb_number(original)
    copied = negative_copy(row, "numeric-perturbation")
    copied["hypothesis"] = text[:match.start()] + replacement + text[match.end():]
    copied["candidate"]["answer"] = replace_first(copied["candidate"]["answer"], original, replacement)
    for claim in copied["candidate"].get("claim_table", []):
        if original in str(claim.get("claim", "")):
            claim["claim"] = replace_first(claim["claim"], original, replacement)
            break
    return copied


def claim_support_mismatch_negative(row):
    claim_table = row["candidate"].get("claim_table", [])
    if not claim_table:
        return None
    copied = negative_copy(row, "claim-support-mismatch")
    copied["hypothesis"] = f"{base.strip_citations(row['candidate']['answer'])} The cited evidence confirms a broader result than reported."
    copied["candidate"]["claim_table"] = claim_table + [{
        "claim": "The cited evidence confirms a broader result than reported.",
        "support": "synthetic unsupported broadening",
        "citations": copied["candidate"].get("citations", []),
    }]
    return copied


def perturb_number(value):
    compact = value.replace(",", "")
    if "." in compact:
        number = float(compact)
        replacement = number + 1.0 if number == 0 else number * 1.25
        return f"{replacement:.2f}".rstrip("0").rstrip(".")
    number = int(compact)
    replacement = number + 1 if abs(number) < 10 else int(round(number * 1.25))
    return f"{replacement:,}" if "," in value else str(replacement)


def replace_first(text, original, replacement):
    return str(text).replace(original, replacement, 1)


def configure_trainable_layers(model, last_layers):
    for parameter in model.parameters():
        parameter.requires_grad = False
    for name, parameter in model.named_parameters():
        if "classifier" in name or "pre_classifier" in name:
            parameter.requires_grad = True
    encoder_layers = getattr(getattr(model, "roberta", None), "encoder", None)
    layers = getattr(encoder_layers, "layer", None)
    if layers is not None and last_layers > 0:
        for layer in layers[-last_layers:]:
            for parameter in layer.parameters():
                parameter.requires_grad = True


def score_rows(model, tokenizer, rows, args):
    if not rows:
        return {}
    dataset = PairDataset(rows, [0 for _ in rows], tokenizer, args.max_length)
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=False)
    scores = {}
    index = 0
    with torch.no_grad():
        for batch in loader:
            batch.pop("labels")
            outputs = model(**batch)
            probabilities = torch.softmax(outputs.logits, dim=-1)[:, 0].cpu().numpy()
            for score in probabilities:
                scores[rows[index]["example_id"]] = float(score)
                index += 1
    return scores


def tune_threshold(train_rows, keep_scores):
    candidates = sorted(set(
        [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
        + [float(score) for score in keep_scores.values()]
    ))
    best = None
    for threshold in candidates:
        metrics = base.summarize_policy([apply_model(row, keep_scores, threshold, None) for row in train_rows])
        if best is None or base.better(metrics, best["metrics"]):
            best = {"threshold": threshold, "metrics": metrics}
    return best["threshold"]


def apply_model(row, keep_scores, threshold, objective):
    if row["answer_type"] != "grounded_answer":
        return base.policy_row(row, objective["id"] if objective else "finetuned_sequence_verifier", None, threshold, False)
    keep_score = keep_scores[row["example_id"]]
    policy = objective["id"] if objective else "finetuned_sequence_verifier"
    return base.policy_row(row, policy, keep_score, threshold, keep_score < threshold)


def summarize_classification_from_scores(rows, keep_scores, threshold, objective):
    return summarize_classification_from_predictions([apply_model(row, keep_scores, threshold, objective) for row in rows], objective)


def summarize_classification_from_predictions(predictions, objective):
    if not predictions:
        return {"examples": 0, "accuracy": 0, "keep_precision": 0, "keep_recall": 0, "suppress_precision": 0, "suppress_recall": 0}
    true_keep = [
        row["labels"]["strong_keep"] if objective["id"] == "strong_support_target" else row["labels"]["teacher_keep"]
        for row in predictions
    ]
    pred_keep = [not row["metadata"]["gate_fired"] for row in predictions]
    tp_keep = sum(1 for actual, pred in zip(true_keep, pred_keep) if actual and pred)
    fp_keep = sum(1 for actual, pred in zip(true_keep, pred_keep) if not actual and pred)
    fn_keep = sum(1 for actual, pred in zip(true_keep, pred_keep) if actual and not pred)
    tp_suppress = sum(1 for actual, pred in zip(true_keep, pred_keep) if not actual and not pred)
    fp_suppress = sum(1 for actual, pred in zip(true_keep, pred_keep) if actual and not pred)
    fn_suppress = sum(1 for actual, pred in zip(true_keep, pred_keep) if not actual and pred)
    return {
        "examples": len(predictions),
        "accuracy": base.ratio(sum(1 for actual, pred in zip(true_keep, pred_keep) if actual == pred), len(predictions)),
        "keep_precision": base.ratio(tp_keep, tp_keep + fp_keep),
        "keep_recall": base.ratio(tp_keep, tp_keep + fn_keep),
        "suppress_precision": base.ratio(tp_suppress, tp_suppress + fp_suppress),
        "suppress_recall": base.ratio(tp_suppress, tp_suppress + fn_suppress),
        "true_keep": tp_keep,
        "true_suppress": tp_suppress,
        "false_keep": fp_keep,
        "false_suppress": fp_suppress,
    }


class PairDataset(Dataset):
    def __init__(self, rows, labels, tokenizer, max_length):
        self.rows = rows
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        encoded = self.tokenizer(
            base.truncate(row["premise"], 3600),
            base.truncate(row["hypothesis"], 900),
            truncation=True,
            max_length=self.max_length,
            padding="max_length",
            return_tensors="pt",
            verbose=False,
        )
        item = {key: value.squeeze(0) for key, value in encoded.items()}
        item["labels"] = torch.tensor(self.labels[index], dtype=torch.long)
        return item


def render_report(result):
    baseline_rows = "\n".join([
        base.policy_report_row("Balanced support-risk gate", result["baselines"]["balanced_gate"]),
        base.policy_report_row("Exported teacher action", result["baselines"]["exported_teacher"]),
    ])
    objective_rows = "\n".join([
        base.policy_report_row(objective["label"], objective["aggregate"]["policy_metrics"])
        for objective in result["objectives"]
    ])
    fold_rows = "\n".join(
        f"| {objective['label']} | {fold['eval_window']} | {fold['threshold']:.3f} | "
        f"{fold['eval_policy_metrics']['support_oracle_correct']} / {fold['eval_policy_metrics']['examples']} ({base.pct(fold['eval_policy_metrics']['support_oracle_correct_rate'])}) | "
        f"{fold['eval_policy_metrics']['answered']} | {base.pct(fold['eval_policy_metrics']['answer_support_rate'])} | "
        f"{fold['eval_policy_metrics']['gate_fired']} | {fold['eval_policy_metrics']['suppressed_unsupported']} | {fold['eval_policy_metrics']['harmful_suppressed_supported']} | "
        f"{base.pct(fold['eval_classification']['suppress_recall'])} | {base.pct(fold['eval_classification']['suppress_precision'])} |"
        for objective in result["objectives"]
        for fold in objective["folds"]
    )
    objective_details = "\n\n".join(
        f"### {objective['label']}\n\n"
        f"{objective['description']}\n\n"
        f"- Delta vs balanced gate: {base.signed(objective['aggregate']['delta_vs_balanced_gate']['support_oracle_correct_delta'])} support-oracle rows "
        f"({base.signed_pct(objective['aggregate']['delta_vs_balanced_gate']['support_oracle_correct_rate_delta'])}), "
        f"{base.signed(objective['aggregate']['delta_vs_balanced_gate']['answered_delta'])} answered rows.\n"
        f"- Delta vs exported teacher: {base.signed(objective['aggregate']['delta_vs_exported_teacher']['support_oracle_correct_delta'])} support-oracle rows "
        f"({base.signed_pct(objective['aggregate']['delta_vs_exported_teacher']['support_oracle_correct_rate_delta'])}), "
        f"{base.signed(objective['aggregate']['delta_vs_exported_teacher']['answered_delta'])} answered rows.\n"
        f"- Answered-row suppress classification: {base.pct(objective['aggregate']['classification']['accuracy'])} accuracy, "
        f"{base.pct(objective['aggregate']['classification']['suppress_recall'])} suppress recall, "
        f"{base.pct(objective['aggregate']['classification']['suppress_precision'])} suppress precision."
        for objective in result["objectives"]
    )
    data = result["data_summary"]
    method = result["method"]
    return f"""# Fine-Tuned Sequence Verifier From Mini-Negative Teacher Labels

Scope: {result["scope"]}

This run makes no OpenAI calls. It fine-tunes `{method["base_model"]}` as a binary keep/suppress verifier over cited-evidence/candidate-answer pairs, then evaluates leave-window-out across the judged future windows.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress | Teacher suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| {data["examples"]} | {data["answered"]} | {data["abstained"]} | {data["strong_keep"]} | {data["strong_suppress"]} | {data["answered_strong_keep"]} | {data["answered_strong_suppress"]} | {data["teacher_suppress_actions"]} |

## Method

- Epochs: {method["training"]["epochs"]}
- Batch size: {method["training"]["batch_size"]}
- Learning rate: {method["training"]["learning_rate"]}
- Unfrozen encoder layers: {method["training"]["unfreeze_last_layers"]}
- Train-only hard-negative augmentation: {method["training"]["augment_hard_negatives"]} (max {method["training"]["max_augmented_per_train_row"]} per supported train row)
- Class weighting: {method["training"]["class_weighting"]}

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

This tests whether the failure of the frozen sequence verifier was due to the fixed representation. A paper-relevant amortized verifier should improve over the balanced support-risk gate and approach the exported mini-negative teacher without calling an LLM at inference time.
"""


def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


if __name__ == "__main__":
    main()
