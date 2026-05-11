from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

import modal
from fastapi import HTTPException, Request


APP_NAME = "alpha-research-agent-workers"
DATASET_VOLUME_NAME = os.environ.get("MODAL_DATASET_VOLUME_NAME", "agent-dataset")
RESULTS_VOLUME_NAME = os.environ.get("MODAL_RESULTS_VOLUME_NAME", "agent-results")
SECRET_NAME = os.environ.get("MODAL_AGENT_SECRET_NAME", "agent-keys")

DATASET_MOUNT = Path("/data")
RESULTS_MOUNT = Path("/results")
WORKSPACE_ROOT = Path("/workspace")
RUNNER_PATH = Path("/opt/alpha-research/run_remote_agent.py")

app = modal.App(APP_NAME)

dataset_volume = modal.Volume.from_name(DATASET_VOLUME_NAME, create_if_missing=True)
results_volume = modal.Volume.from_name(RESULTS_VOLUME_NAME, create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install(
        "ca-certificates",
        "curl",
        "git",
        "jq",
        "ripgrep",
        "fd-find",
        "findutils",
    )
    .pip_install("requests>=2.32.0,<3", "fastapi>=0.115.0,<1")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
        "apt-get install -y nodejs",
        "npm install -g @openai/codex",
        "ln -sf /usr/bin/fdfind /usr/local/bin/fd || true",
        "mkdir -p /opt/alpha-research",
    )
    .add_local_file("scripts/run_remote_agent.py", str(RUNNER_PATH), copy=True)
)


def _safe_job_id(value: str) -> str:
    job_id = re.sub(r"[^A-Za-z0-9_.-]", "-", value.strip())
    return job_id[:96] or "modal-job"


def _b64_json(value: Any) -> str:
    return base64.b64encode(json.dumps(value or {}).encode("utf-8")).decode("ascii")


def _b64_text(value: str) -> str:
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


def _optional_str(extra_context: dict[str, Any], key: str, default: str = "") -> str:
    value = extra_context.get(key)
    if value is None:
        return default
    return str(value)


def _write_direct_job_work_log(artifact_dir: Path, prompt: str, return_code: int) -> None:
    work_path = artifact_dir / "work.md"
    if work_path.exists():
        return
    work_path.write_text(
        "\n".join(
            [
                "# Modal Codex Job",
                "",
                f"Codex exited with code `{return_code}` before writing `work.md`.",
                "",
                "Prompt:",
                "",
                prompt,
                "",
            ]
        ),
        encoding="utf-8",
    )


def _run_codex_job(job_id: str, prompt: str, extra_context: dict[str, Any] | None = None) -> dict[str, Any]:
    extra_context = extra_context or {}
    if not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError("Missing OPENAI_API_KEY in Modal Secret agent-keys")
    safe_job_id = _safe_job_id(job_id)
    workspace_dir = WORKSPACE_ROOT / safe_job_id
    artifact_dir = RESULTS_MOUNT / safe_job_id
    codex_home = workspace_dir / ".codex-home"
    state_dir = artifact_dir / ".remote-agent" / "state"
    last_message_path = artifact_dir / "last-message.txt"
    transcript_path = artifact_dir / "codex-transcript.log"
    status_path = state_dir / "status.json"

    shutil.rmtree(workspace_dir, ignore_errors=True)
    workspace_dir.mkdir(parents=True, exist_ok=True)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    codex_home.mkdir(parents=True, exist_ok=True)
    state_dir.mkdir(parents=True, exist_ok=True)

    run_id = _optional_str(extra_context, "runId", safe_job_id)
    run_type = _optional_str(extra_context, "runType", "analysis")
    dataset_id = _optional_str(extra_context, "datasetId", "agent-dataset")
    dataset_mount_path = _optional_str(extra_context, "datasetMountPath", str(DATASET_MOUNT))
    dataset_read_only = bool(extra_context.get("datasetReadOnly", True))
    manifest_path = _optional_str(extra_context, "manifestPath", f"{dataset_mount_path.rstrip('/')}/manifest.json")
    remote_model = _optional_str(extra_context, "remoteAgentModel", os.environ.get("REMOTE_AGENT_MODEL", "gpt-5-codex"))
    runner_token = _optional_str(extra_context, "runnerToken", os.environ.get("RUNNER_TOKEN", ""))
    config = extra_context.get("config") if isinstance(extra_context.get("config"), dict) else {}
    artifact_spec = extra_context.get("artifacts") if isinstance(extra_context.get("artifacts"), list) else []

    env = os.environ.copy()
    env.update(
        {
            "RUN_ID": run_id,
            "RUN_TYPE": run_type,
            "DATASET_ID": dataset_id,
            "PROMPT_B64": _b64_text(prompt),
            "DATASET_MOUNT_PATH": dataset_mount_path,
            "DATASET_READ_ONLY": "true" if dataset_read_only else "false",
            "MANIFEST_PATH": manifest_path,
            "CODEX_HOME": str(codex_home),
            "WORKSPACE_DIR": str(workspace_dir),
            "ARTIFACT_DIR": str(artifact_dir),
            "RUN_STATE_DIR": str(state_dir),
            "RUN_STATUS_PATH": str(status_path),
            "LAST_MESSAGE_PATH": str(last_message_path),
            "TRANSCRIPT_PATH": str(transcript_path),
            "CALLBACK_EVENTS_URL": _optional_str(extra_context, "callbackEventsUrl"),
            "CALLBACK_STATUS_URL": _optional_str(extra_context, "callbackStatusUrl"),
            "CALLBACK_ARTIFACTS_URL": _optional_str(extra_context, "callbackArtifactsUrl"),
            "CALLBACK_SESSION_ENTRIES_URL": _optional_str(extra_context, "callbackSessionEntriesUrl"),
            "RUNNER_TOKEN": runner_token,
            "REMOTE_AGENT_MODEL": remote_model,
            "REMOTE_AGENT_SESSION_ID": _optional_str(extra_context, "remoteAgentSessionId"),
            "CONFIG_B64": _b64_json(config),
            "ARTIFACT_SPEC_B64": _b64_json(artifact_spec),
        }
    )

    command = ["python3", str(RUNNER_PATH)]
    process = subprocess.run(command, cwd=str(workspace_dir), env=env, text=True)
    if not extra_context.get("callbackStatusUrl"):
        _write_direct_job_work_log(artifact_dir, prompt, process.returncode)
    results_volume.commit()

    return {
        "jobId": safe_job_id,
        "runId": run_id,
        "returnCode": process.returncode,
        "datasetMountPath": dataset_mount_path,
        "workspacePath": str(workspace_dir),
        "resultPath": str(artifact_dir),
        "statusPath": str(status_path),
        "transcriptPath": str(transcript_path),
    }


@app.function(
    image=image,
    volumes={
        str(DATASET_MOUNT): dataset_volume.read_only(),
        str(RESULTS_MOUNT): results_volume,
    },
    secrets=[modal.Secret.from_name(SECRET_NAME)],
    cpu=4,
    memory=8192,
    timeout=3600,
)
def run_codex_job(job_id: str, prompt: str, extra_context: dict[str, Any] | None = None) -> dict[str, Any]:
    extra_context = {**(extra_context or {}), "datasetReadOnly": True}
    return _run_codex_job(job_id, prompt, extra_context)


@app.function(
    image=image,
    volumes={
        str(DATASET_MOUNT): dataset_volume,
        str(RESULTS_MOUNT): results_volume,
    },
    secrets=[modal.Secret.from_name(SECRET_NAME)],
    cpu=4,
    memory=8192,
    timeout=7200,
)
def run_dataset_job(job_id: str, prompt: str, extra_context: dict[str, Any] | None = None) -> dict[str, Any]:
    extra_context = {**(extra_context or {}), "datasetReadOnly": False}
    return _run_codex_job(job_id, prompt, extra_context)


@app.function(image=image, secrets=[modal.Secret.from_name(SECRET_NAME)])
@modal.fastapi_endpoint(method="POST")
async def submit_codex_job(request: Request) -> dict[str, Any]:
    token = os.environ.get("MODAL_SUBMIT_TOKEN", "").strip()
    if token:
        auth = request.headers.get("authorization", "")
        if auth != f"Bearer {token}":
            raise HTTPException(status_code=401, detail="Unauthorized")

    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Expected JSON object")

    job_id = str(body.get("jobId") or body.get("runId") or "").strip()
    prompt = str(body.get("prompt") or "")
    if not job_id:
        raise HTTPException(status_code=400, detail="Missing jobId")
    if not prompt:
        raise HTTPException(status_code=400, detail="Missing prompt")

    extra_context = body.get("extraContext")
    if not isinstance(extra_context, dict):
        extra_context = {}
    for key, value in body.items():
        if key not in {"jobId", "prompt", "extraContext"} and key not in extra_context:
            extra_context[key] = value

    dataset_read_only = bool(extra_context.get("datasetReadOnly", True))
    function = run_codex_job if dataset_read_only else run_dataset_job
    call = function.spawn(job_id, prompt, extra_context)
    return {
        "jobId": _safe_job_id(job_id),
        "callId": call.object_id,
        "resultPath": f"{RESULTS_MOUNT}/{_safe_job_id(job_id)}",
    }


@app.local_entrypoint()
def main(job_id: str, prompt: str, extra_context_json: str = "{}") -> None:
    extra_context = json.loads(extra_context_json)
    result = run_codex_job.remote(job_id, prompt, extra_context)
    print(json.dumps(result, indent=2))
