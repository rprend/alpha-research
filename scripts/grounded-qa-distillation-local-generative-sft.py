#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["torch>=2.8.0", "transformers>=4.44.0", "peft>=0.11.0", "sentencepiece"]
# ///
import argparse
import json
import math
import os
import random
import re
import time
from collections import Counter
from pathlib import Path

import torch
from peft import LoraConfig, get_peft_model
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer


ROOT = Path.cwd()
EXPERIMENT = ROOT / "docs" / "experiments" / "grounded-qa-distillation"
RUNS = EXPERIMENT / "runs"
REPORTS = EXPERIMENT / "reports"


def main():
    args = parse_args()
    random.seed(args.seed)
    torch.manual_seed(args.seed)

    packet_dir = RUNS / args.sft_prep_run_id
    output_dir = RUNS / args.run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)

    packet = json.loads((packet_dir / "result.json").read_text())
    train_rows = read_jsonl(packet_dir / "train.hf-sft.jsonl")
    validation_rows = read_jsonl(packet_dir / "validation.hf-sft.jsonl")
    eval_rows = read_jsonl(packet_dir / "eval_prompts.jsonl")
    train_rows = filter_training_rows(train_rows, args.train_filter)
    if args.max_train_rows:
        train_rows = train_rows[: args.max_train_rows]
    if args.max_eval_rows:
        eval_rows = eval_rows[: args.max_eval_rows]

    device = select_device(args.device)
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, use_fast=True, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        torch_dtype=torch.float32 if device.type == "mps" else torch.float16 if device.type == "cuda" else torch.float32,
        trust_remote_code=True,
    )
    model.config.use_cache = False
    if args.use_lora:
        lora = LoraConfig(
            r=args.lora_rank,
            lora_alpha=args.lora_alpha,
            lora_dropout=args.lora_dropout,
            bias="none",
            task_type="CAUSAL_LM",
            target_modules=args.target_modules.split(","),
        )
        model = get_peft_model(model, lora)
    model.to(device)

    train_dataset = ChatSftDataset(train_rows, tokenizer, args.max_length)
    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=lambda batch: collate(batch, tokenizer.pad_token_id),
    )
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.learning_rate, weight_decay=args.weight_decay)
    train_start = time.time()
    losses = []
    model.train()
    optimizer.zero_grad(set_to_none=True)
    step = 0
    for epoch in range(args.epochs):
        for batch_index, batch in enumerate(train_loader):
            batch = {key: value.to(device) for key, value in batch.items()}
            output = model(**batch)
            loss = output.loss / args.gradient_accumulation_steps
            loss.backward()
            losses.append(float(output.loss.detach().cpu()))
            if (batch_index + 1) % args.gradient_accumulation_steps == 0 or batch_index + 1 == len(train_loader):
                torch.nn.utils.clip_grad_norm_(model.parameters(), args.max_grad_norm)
                optimizer.step()
                optimizer.zero_grad(set_to_none=True)
                step += 1
    train_seconds = time.time() - train_start

    model.eval()
    predictions = []
    with torch.no_grad():
        for row in eval_rows:
            prediction, raw = generate_prediction(row, model, tokenizer, device, args)
            reference = normalize_output(row.get("reference", {}))
            predictions.append({
                "example_id": row["example_id"],
                "window": row.get("window"),
                "model": args.base_model,
                "prediction": prediction,
                "raw_content": raw,
                "reference": reference,
                "scores": score_prediction(prediction, reference),
            })

    metrics = summarize_predictions(predictions)
    result = {
        "run_id": args.run_id,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sft_prep_run_id": args.sft_prep_run_id,
        "packet_summary": {
            "teacher_label_prefix": packet.get("teacher_label_prefix"),
            "train_windows": packet.get("train_windows"),
            "eval_window": packet.get("eval_window"),
            "train_rows_available": packet.get("examples", {}).get("train"),
            "train_rows_used": len(train_rows),
            "validation_rows_available": len(validation_rows),
            "eval_prompts_used": len(eval_rows),
            "train_filter": args.train_filter,
            "train_distribution": output_distribution(train_rows, from_training=True),
            "eval_reference_distribution": output_distribution(eval_rows, from_training=False),
            "train_eval_paper_overlap": packet.get("leakage_checks", {}).get("train_eval_paper_overlap"),
            "validation_eval_paper_overlap": packet.get("leakage_checks", {}).get("validation_eval_paper_overlap"),
        },
        "method": {
            "type": "local_lora_causal_lm_sft",
            "base_model": args.base_model,
            "loss_mask": "assistant_tokens_only",
            "device": str(device),
            "max_length": args.max_length,
            "max_new_tokens": args.max_new_tokens,
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "gradient_accumulation_steps": args.gradient_accumulation_steps,
            "learning_rate": args.learning_rate,
            "use_lora": args.use_lora,
            "lora_rank": args.lora_rank if args.use_lora else None,
        },
        "training": {
            "optimizer_steps": step,
            "loss_count": len(losses),
            "mean_loss": sum(losses) / len(losses) if losses else None,
            "last_loss": losses[-1] if losses else None,
            "train_seconds": train_seconds,
            "trainable_parameters": trainable_parameters(model),
        },
        "eval": metrics,
        "cost": {
            "llm_calls": 0,
            "openai_cost_usd": 0,
            "note": "Local SFT/eval only. No OpenAI API calls.",
        },
    }

    write_jsonl(output_dir / "predictions.jsonl", predictions)
    (output_dir / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    report = render_report(result)
    (output_dir / "report.md").write_text(report)
    (REPORTS / f"{args.run_id}.md").write_text(report)
    print(json.dumps({
        "run_id": args.run_id,
        "result": str((output_dir / "result.json").relative_to(ROOT)),
        "report": str((output_dir / "report.md").relative_to(ROOT)),
        "eval": metrics,
        "training": result["training"],
    }, indent=2))


class ChatSftDataset(Dataset):
    def __init__(self, rows, tokenizer, max_length):
        self.items = [encode_training_row(row, tokenizer, max_length) for row in rows]

    def __len__(self):
        return len(self.items)

    def __getitem__(self, index):
        return self.items[index]


def encode_training_row(row, tokenizer, max_length):
    messages = training_messages(row)
    prompt_messages = messages[:-1]
    full_text = render_chat(tokenizer, messages, add_generation_prompt=False)
    prompt_text = render_chat(tokenizer, prompt_messages, add_generation_prompt=True)
    full = tokenizer(full_text, truncation=True, max_length=max_length, add_special_tokens=False)
    prompt = tokenizer(prompt_text, truncation=True, max_length=max_length, add_special_tokens=False)
    input_ids = full["input_ids"]
    attention_mask = full["attention_mask"]
    labels = list(input_ids)
    mask_until = min(len(prompt["input_ids"]), len(labels))
    for i in range(mask_until):
        labels[i] = -100
    if all(label == -100 for label in labels):
        labels[-1] = input_ids[-1]
    return {
        "input_ids": torch.tensor(input_ids, dtype=torch.long),
        "attention_mask": torch.tensor(attention_mask, dtype=torch.long),
        "labels": torch.tensor(labels, dtype=torch.long),
    }


def collate(batch, pad_token_id):
    max_len = max(item["input_ids"].shape[0] for item in batch)
    result = {}
    for key in ["input_ids", "attention_mask", "labels"]:
        pad_value = -100 if key == "labels" else 0 if key == "attention_mask" else pad_token_id
        values = []
        for item in batch:
            pad_len = max_len - item[key].shape[0]
            values.append(torch.nn.functional.pad(item[key], (0, pad_len), value=pad_value))
        result[key] = torch.stack(values)
    return result


def generate_prediction(row, model, tokenizer, device, args):
    messages = eval_messages(row)
    prompt = render_chat(tokenizer, messages, add_generation_prompt=True)
    encoded = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=args.max_length, add_special_tokens=False)
    encoded = {key: value.to(device) for key, value in encoded.items()}
    generated = model.generate(
        **encoded,
        max_new_tokens=args.max_new_tokens,
        do_sample=False,
        pad_token_id=tokenizer.pad_token_id,
        eos_token_id=tokenizer.eos_token_id,
    )
    output_ids = generated[0][encoded["input_ids"].shape[1]:]
    raw = tokenizer.decode(output_ids, skip_special_tokens=True).strip()
    return normalize_output(parse_json_from_text(raw)), raw


def render_chat(tokenizer, messages, add_generation_prompt):
    try:
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=add_generation_prompt)
    except Exception:
        rendered = "\n".join(f"{message['role']}: {message['content']}" for message in messages)
        return rendered + ("\nassistant:" if add_generation_prompt else "")


def training_messages(row):
    assistant = row["messages"][-1]["content"]
    return [
        {"role": "system", "content": system_prompt()},
        {"role": "user", "content": format_input(row["input"])},
        {"role": "assistant", "content": assistant},
    ]


def eval_messages(row):
    return [
        {"role": "system", "content": system_prompt()},
        {"role": "user", "content": format_input(row["input"])},
    ]


def system_prompt():
    return (
        "Answer using only the compact evidence pack. Return valid JSON only with keys "
        "answer_type, answer, citations, claim_table, and abstention_reason. Cite every factual "
        "claim inline with bracketed evidence ids like [E2]. Abstain when evidence is insufficient."
    )


def format_input(input_obj):
    metadata = input_obj.get("document_metadata", {})
    lines = [
        f"Question: {input_obj.get('question', '')}",
        f"Paper title: {metadata.get('title', '')}",
        f"Paper id: {metadata.get('paper_id', '')}",
        f"Date: {metadata.get('inferred_publication_date', metadata.get('inferred_publication_month', ''))}",
        "Evidence pack:",
    ]
    for evidence in input_obj.get("compact_retrieved_evidence_pack", []):
        text = truncate_at_word(str(evidence.get("text", "")), 700)
        lines.append(f"[{evidence.get('evidence_id')}] {evidence.get('section', 'Evidence')}: {text}")
    lines.append("Return JSON only.")
    return "\n".join(lines)


def parse_json_from_text(text):
    text = text.strip()
    candidates = [text]
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        candidates.append(match.group(0))
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except Exception:
            continue
    return {
        "answer_type": "abstain",
        "answer": "The evidence pack does not contain enough support to answer this question.",
        "citations": [],
        "claim_table": [{"claim": "Model output was not valid JSON.", "support": "invalid_generation", "citations": []}],
        "abstention_reason": "Invalid JSON generation.",
    }


def normalize_output(output):
    answer_type = "grounded_answer" if output.get("answer_type") == "grounded_answer" else "abstain"
    citations = output.get("citations") if isinstance(output.get("citations"), list) else []
    normalized_citations = []
    for citation in citations:
        if isinstance(citation, str):
            normalized_citations.append(citation)
        elif isinstance(citation, dict) and citation.get("evidence_id"):
            normalized_citations.append(str(citation["evidence_id"]))
    return {
        "answer_type": answer_type,
        "answer": str(output.get("answer", "")),
        "citations": normalized_citations if answer_type == "grounded_answer" else [],
        "claim_table": output.get("claim_table") if isinstance(output.get("claim_table"), list) else [],
        "abstention_reason": (output.get("abstention_reason") or output.get("abstain_reason")) if answer_type == "abstain" else None,
    }


def filter_training_rows(rows, train_filter):
    if train_filter == "all":
        return rows
    filtered = []
    for row in rows:
        output = json.loads(row["messages"][-1]["content"])
        answer_type = output.get("answer_type")
        if train_filter == "answered" and answer_type == "grounded_answer":
            filtered.append(row)
        elif train_filter == "abstain" and answer_type != "grounded_answer":
            filtered.append(row)
    if not filtered:
        raise ValueError(f"--train-filter={train_filter} produced zero rows")
    return filtered


def output_distribution(rows, from_training):
    answered = 0
    abstained = 0
    invalid = 0
    for row in rows:
        try:
            output = json.loads(row["messages"][-1]["content"]) if from_training else row["reference"]
            if output.get("answer_type") == "grounded_answer":
                answered += 1
            else:
                abstained += 1
        except Exception:
            invalid += 1
    total = answered + abstained + invalid
    return {
        "rows": total,
        "answered": answered,
        "abstained": abstained,
        "invalid": invalid,
        "answer_rate": answered / total if total else 0,
    }


def score_prediction(prediction, reference):
    answered = prediction["answer_type"] == "grounded_answer"
    answerable = reference["answer_type"] == "grounded_answer"
    predicted_citations = prediction["citations"]
    reference_citations = set(reference["citations"])
    overlap = [citation for citation in predicted_citations if citation in reference_citations]
    return {
        "answer_type_correct": prediction["answer_type"] == reference["answer_type"],
        "citation_precision": len(overlap) / len(predicted_citations) if answered and predicted_citations else None,
        "citation_recall": len(overlap) / len(reference_citations) if answerable and reference_citations else None,
        "answer_token_f1": token_f1(prediction["answer"], reference["answer"]) if answerable and answered else 0 if answerable else None,
        "abstention_correct": (not answered) if not answerable else answered is False,
        "inline_citation_rate": (
            sum(1 for citation in predicted_citations if f"[{citation}]" in prediction["answer"]) / max(1, len(predicted_citations))
            if answered else None
        ),
        "valid_json_output": prediction["claim_table"][0].get("support") != "invalid_generation" if prediction["claim_table"] else True,
    }


def summarize_predictions(predictions):
    return {
        "examples": len(predictions),
        "answered": sum(1 for row in predictions if row["prediction"]["answer_type"] == "grounded_answer"),
        "abstained": sum(1 for row in predictions if row["prediction"]["answer_type"] == "abstain"),
        "answer_rate": mean(row["prediction"]["answer_type"] == "grounded_answer" for row in predictions),
        "answer_type_accuracy": mean(row["scores"]["answer_type_correct"] for row in predictions),
        "citation_precision": mean(row["scores"]["citation_precision"] for row in predictions),
        "citation_recall": mean(row["scores"]["citation_recall"] for row in predictions),
        "answer_token_f1": mean(row["scores"]["answer_token_f1"] for row in predictions),
        "abstention_accuracy": mean(row["scores"]["abstention_correct"] for row in predictions),
        "inline_citation_rate": mean(row["scores"]["inline_citation_rate"] for row in predictions),
        "valid_json_rate": mean(row["scores"]["valid_json_output"] for row in predictions),
    }


def token_f1(prediction, reference):
    predicted = content_tokens(strip_citations(prediction))
    gold = content_tokens(reference)
    if not predicted and not gold:
        return 1.0
    if not predicted or not gold:
        return 0.0
    counts = Counter(gold)
    overlap = 0
    for token in predicted:
        if counts[token] > 0:
            overlap += 1
            counts[token] -= 1
    if not overlap:
        return 0.0
    precision = overlap / len(predicted)
    recall = overlap / len(gold)
    return 2 * precision * recall / (precision + recall)


def content_tokens(value):
    stop = {"the", "and", "for", "that", "with", "from", "what", "how", "are", "was", "were", "this", "does", "their", "using", "used", "into", "about", "have", "has", "its", "can", "which", "when", "where", "why"}
    return [token for token in re.split(r"[^a-z0-9]+", str(value).lower()) if len(token) > 2 and token not in stop]


def strip_citations(value):
    return re.sub(r"\s*\[[^\]]+\]", "", str(value)).strip()


def truncate_at_word(value, max_chars):
    text = str(value).strip()
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    index = truncated.rfind(" ")
    if index > 0:
        truncated = truncated[:index]
    return truncated.rstrip() + "..."


def mean(values):
    numeric = [float(value) for value in values if value is not None and math.isfinite(float(value))]
    return sum(numeric) / len(numeric) if numeric else 0.0


def trainable_parameters(model):
    trainable = sum(param.numel() for param in model.parameters() if param.requires_grad)
    total = sum(param.numel() for param in model.parameters())
    return {"trainable": trainable, "total": total, "fraction": trainable / total if total else 0}


def render_report(result):
    return f"""# Local Generative SFT

## Purpose

Run a bounded local LoRA SFT student on the leakage-safe temporal packet. This is the first local generative student path after OpenAI hosted fine-tuning and HF Jobs were blocked.

## Setup

| Item | Value |
| --- | --- |
| SFT packet | `{result['sft_prep_run_id']}` |
| Base model | `{result['method']['base_model']}` |
| Device | `{result['method']['device']}` |
| Train rows used | {result['packet_summary']['train_rows_used']} |
| Train filter | `{result['packet_summary']['train_filter']}` |
| Eval prompts used | {result['packet_summary']['eval_prompts_used']} |
| Epochs | {result['method']['epochs']} |
| LoRA rank | {result['method']['lora_rank']} |
| LLM calls | {result['cost']['llm_calls']} |

## Training

| Metric | Value |
| --- | ---: |
| Optimizer steps | {result['training']['optimizer_steps']} |
| Mean loss | {result['training']['mean_loss']:.4f} |
| Last loss | {result['training']['last_loss']:.4f} |
| Train seconds | {result['training']['train_seconds']:.1f} |
| Trainable params | {result['training']['trainable_parameters']['trainable']} |

## Eval

| Answered | Abstained | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citations | Valid JSON |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| {result['eval']['answered']} | {result['eval']['abstained']} | {pct(result['eval']['answer_type_accuracy'])} | {pct(result['eval']['citation_precision'])} | {pct(result['eval']['citation_recall'])} | {pct(result['eval']['answer_token_f1'])} | {pct(result['eval']['inline_citation_rate'])} | {pct(result['eval']['valid_json_rate'])} |
"""


def pct(value):
    return f"{value * 100:.1f}%"


def select_device(requested):
    if requested != "auto":
        return torch.device(requested)
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def write_jsonl(path, rows):
    path.write_text("".join(json.dumps(row) + "\n" for row in rows))


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sft-prep-run-id", default="hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1")
    parser.add_argument("--run-id", default="local-generative-sft-mini-negative-temporal-qwen05b-161-320-to-321-389-v1")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-0.5B-Instruct")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--weight-decay", type=float, default=0.0)
    parser.add_argument("--max-grad-norm", type=float, default=1.0)
    parser.add_argument("--max-length", type=int, default=768)
    parser.add_argument("--max-new-tokens", type=int, default=220)
    parser.add_argument("--max-train-rows", type=int, default=0)
    parser.add_argument("--max-eval-rows", type=int, default=0)
    parser.add_argument("--train-filter", choices=["all", "answered", "abstain"], default="all")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--use-lora", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--lora-rank", type=int, default=8)
    parser.add_argument("--lora-alpha", type=int, default=16)
    parser.add_argument("--lora-dropout", type=float, default=0.05)
    parser.add_argument("--target-modules", default="q_proj,k_proj,v_proj,o_proj")
    return parser.parse_args()


if __name__ == "__main__":
    main()
