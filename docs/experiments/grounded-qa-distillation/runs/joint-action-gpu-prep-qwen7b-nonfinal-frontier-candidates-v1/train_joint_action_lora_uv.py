#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["torch", "transformers>=4.44.0", "datasets>=2.20.0", "trl>=0.12.0", "peft>=0.11.0", "accelerate", "bitsandbytes", "trackio"]
# ///
import json
import os
import inspect
from pathlib import Path

from datasets import Dataset
from peft import LoraConfig
from trl import DPOConfig, DPOTrainer, SFTConfig, SFTTrainer

BASE_MODEL = os.environ.get("BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct")
HUB_MODEL_ID = os.environ.get("HUB_MODEL_ID", "rprendergast/grounded-qa-nonfinal-frontier-qwen7b-lora-v1")
DATASET_DIR = Path(os.environ.get("DATASET_DIR", Path(__file__).resolve().parent / "dataset"))
SFT_ADAPTER_DIR = os.environ.get("SFT_ADAPTER_DIR", "joint-action-sft-adapter")
DPO_ADAPTER_DIR = os.environ.get("DPO_ADAPTER_DIR", "joint-action-dpo-adapter")
MAX_SFT_STEPS = int(os.environ.get("MAX_SFT_STEPS", "0"))
MAX_DPO_STEPS = int(os.environ.get("MAX_DPO_STEPS", "0"))
PUSH_TO_HUB = os.environ.get("PUSH_TO_HUB", "false").lower() == "true"
REPORT_TO = os.environ.get("REPORT_TO", "none")
MODEL_DEVICE_MAP = os.environ.get("MODEL_DEVICE_MAP", "auto").lower()

def model_init_kwargs():
    if MODEL_DEVICE_MAP in {"none", "false", "off"}:
        return {"device_map": None}
    return {"device_map": MODEL_DEVICE_MAP}

def read_jsonl(name):
    with (DATASET_DIR / name).open() as f:
        return [json.loads(line) for line in f if line.strip()]

def sft_text(row):
    return {"messages": row["messages"]}

def dpo_row(row):
    return {
        "prompt": row["prompt"],
        "chosen": [{"role": "assistant", "content": row["chosen"]}],
        "rejected": [{"role": "assistant", "content": row["rejected"]}],
    }

def supported_kwargs(cls, values):
    params = inspect.signature(cls.__init__).parameters
    return {key: value for key, value in values.items() if key in params}

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
        max_steps=MAX_SFT_STEPS if MAX_SFT_STEPS > 0 else -1,
        eval_strategy="epoch",
        save_strategy="epoch",
        report_to=REPORT_TO,
        model_init_kwargs=model_init_kwargs(),
        project="grounded-qa-distillation",
        run_name="joint-action-sft-qwen3b",
    ),
)
sft.train()
sft.model.save_pretrained(SFT_ADAPTER_DIR)

dpo = DPOTrainer(
    model=sft.model,
    ref_model=None,
    train_dataset=dpo_train,
    eval_dataset=dpo_eval,
    args=DPOConfig(**supported_kwargs(DPOConfig, {
        "output_dir": "joint-action-dpo",
        "num_train_epochs": 1,
        "per_device_train_batch_size": 1,
        "gradient_accumulation_steps": 8,
        "learning_rate": 5e-5,
        "max_length": 1536,
        "max_prompt_length": 1280,
        "beta": 0.1,
        "gradient_checkpointing": True,
        "max_steps": MAX_DPO_STEPS if MAX_DPO_STEPS > 0 else -1,
        "eval_strategy": "no",
        "save_strategy": "no",
        "push_to_hub": PUSH_TO_HUB,
        "hub_model_id": HUB_MODEL_ID,
        "report_to": REPORT_TO,
        "model_init_kwargs": model_init_kwargs(),
        "project": "grounded-qa-distillation",
        "run_name": "joint-action-dpo-qwen3b",
    })),
)
dpo.train()
dpo.model.save_pretrained(DPO_ADAPTER_DIR)
if PUSH_TO_HUB:
    dpo.push_to_hub()
