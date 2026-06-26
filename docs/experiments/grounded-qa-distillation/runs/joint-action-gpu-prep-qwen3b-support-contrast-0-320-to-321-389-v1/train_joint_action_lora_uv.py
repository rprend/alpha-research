#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["torch", "transformers>=4.44.0", "datasets>=2.20.0", "trl>=0.12.0", "peft>=0.11.0", "accelerate", "bitsandbytes", "trackio"]
# ///
import json
import os
from pathlib import Path

from datasets import Dataset
from peft import LoraConfig
from trl import DPOConfig, DPOTrainer, SFTConfig, SFTTrainer

BASE_MODEL = os.environ.get("BASE_MODEL", "Qwen/Qwen2.5-3B-Instruct")
HUB_MODEL_ID = os.environ.get("HUB_MODEL_ID", "rprendergast/grounded-qa-joint-action-qwen3b-lora-v1")
DATASET_DIR = Path(os.environ.get("DATASET_DIR", Path(__file__).resolve().parent / "dataset"))

def read_jsonl(name):
    with (DATASET_DIR / name).open() as f:
        return [json.loads(line) for line in f if line.strip()]

def sft_text(row):
    return {"messages": row["messages"]}

def dpo_row(row):
    return {"prompt": row["prompt"], "chosen": row["chosen"], "rejected": row["rejected"]}

sft_train = Dataset.from_list([sft_text(r) for r in read_jsonl("sft_train.jsonl")])
sft_eval = Dataset.from_list([sft_text(r) for r in read_jsonl("sft_validation.jsonl")])
dpo_train = Dataset.from_list([dpo_row(r) for r in read_jsonl("dpo_train.jsonl")])
dpo_eval = Dataset.from_list([dpo_row(r) for r in read_jsonl("dpo_validation.jsonl")])

lora = LoraConfig(r=32, lora_alpha=64, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM")

sft = SFTTrainer(
    model=BASE_MODEL,
    train_dataset=sft_train,
    eval_dataset=sft_eval,
    peft_config=lora,
    args=SFTConfig(
        output_dir="joint-action-sft",
        num_train_epochs=2,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,
        max_length=1536,
        gradient_checkpointing=True,
        eval_strategy="epoch",
        save_strategy="epoch",
        report_to="trackio",
        project="grounded-qa-distillation",
        run_name="joint-action-sft-qwen3b",
    ),
)
sft.train()
sft.model.save_pretrained("joint-action-sft-adapter")

dpo = DPOTrainer(
    model=sft.model,
    ref_model=None,
    train_dataset=dpo_train,
    eval_dataset=dpo_eval,
    args=DPOConfig(
        output_dir="joint-action-dpo",
        num_train_epochs=1,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=5e-5,
        max_length=1536,
        max_prompt_length=1280,
        beta=0.1,
        gradient_checkpointing=True,
        eval_strategy="epoch",
        save_strategy="epoch",
        push_to_hub=True,
        hub_model_id=HUB_MODEL_ID,
        report_to="trackio",
        project="grounded-qa-distillation",
        run_name="joint-action-dpo-qwen3b",
    ),
)
dpo.train()
dpo.push_to_hub()
