#!/usr/bin/env python3
import base64
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path

import requests


RUN_ID = os.environ["RUN_ID"]
RUN_TYPE = os.environ["RUN_TYPE"]
DATASET_ID = os.environ["DATASET_ID"]
PROMPT = base64.b64decode(os.environ["PROMPT_B64"]).decode("utf-8")
DATASET_MOUNT_PATH = Path(os.environ["DATASET_MOUNT_PATH"])
MANIFEST_PATH = Path(os.environ["MANIFEST_PATH"])
CODEX_HOME = Path(os.environ["CODEX_HOME"])
WORKSPACE_DIR = Path(os.environ["WORKSPACE_DIR"])
ARTIFACT_DIR = Path(os.environ["ARTIFACT_DIR"])
LAST_MESSAGE_PATH = Path(os.environ["LAST_MESSAGE_PATH"])
TRANSCRIPT_PATH = Path(os.environ["TRANSCRIPT_PATH"])
CALLBACK_EVENTS_URL = os.environ["CALLBACK_EVENTS_URL"]
CALLBACK_STATUS_URL = os.environ["CALLBACK_STATUS_URL"]
CALLBACK_ARTIFACTS_URL = os.environ["CALLBACK_ARTIFACTS_URL"]
CALLBACK_SESSION_ENTRIES_URL = os.environ["CALLBACK_SESSION_ENTRIES_URL"]
RUNNER_TOKEN = os.environ["RUNNER_TOKEN"]
REMOTE_AGENT_MODEL = os.environ.get("REMOTE_AGENT_MODEL", "gpt-5-codex")
REMOTE_AGENT_SESSION_ID = os.environ.get("REMOTE_AGENT_SESSION_ID", "").strip()


SESSION_ID_RE = re.compile(r"session id:\s*([0-9a-fA-F-]{36})")
HEARTBEAT_INTERVAL_SECONDS = int(os.environ.get("REMOTE_AGENT_HEARTBEAT_SECONDS", "45"))


def headers(content_type: str):
    return {
        "Authorization": f"Bearer {RUNNER_TOKEN}",
        "Content-Type": content_type,
    }


def post_event(message: str, level: str = "info"):
    requests.post(
        CALLBACK_EVENTS_URL,
        headers={**headers("text/plain; charset=utf-8"), "X-Run-Level": level},
        data=message.encode("utf-8"),
        timeout=20,
    ).raise_for_status()


def post_status(status: str, output_preview: str = ""):
    requests.post(
        CALLBACK_STATUS_URL,
        headers=headers("application/json"),
        json={
            "status": status,
            "outputPreview": output_preview or None,
        },
        timeout=20,
    ).raise_for_status()


def create_artifact(kind: str, title: str, content=None, url: str | None = None):
    requests.post(
        CALLBACK_ARTIFACTS_URL,
        headers=headers("application/json"),
        json={
            "type": kind,
            "title": title,
            "content": content,
            "url": url,
        },
        timeout=20,
    ).raise_for_status()


def post_session_entry(role: str, kind: str, content: str, title: str | None = None, metadata=None):
    requests.post(
        CALLBACK_SESSION_ENTRIES_URL,
        headers=headers("application/json"),
        json={
            "sessionKind": "remote_codex",
            "sessionTitle": "Remote Codex session",
            "role": role,
            "kind": kind,
            "title": title,
            "content": content[:20000],
            "metadata": metadata,
        },
        timeout=20,
    ).raise_for_status()


def safe_post_event(message: str, level: str = "info"):
    try:
        post_event(message, level)
    except Exception:
        pass


def safe_post_status(status: str, output_preview: str = ""):
    try:
        post_status(status, output_preview)
    except Exception:
        pass


def summarize_codex_json_line(line: str) -> str | None:
    try:
        payload = json.loads(line)
    except Exception:
        return None
    item = payload.get("item") if isinstance(payload, dict) else None
    if not isinstance(item, dict):
        return None
    item_type = item.get("type")
    item_status = item.get("status")
    if item_type == "command_execution":
        command = str(item.get("command") or "").replace("\n", " ")
        command = command[:160]
        if item_status == "in_progress":
            return f"Running command: {command}"
        if item_status == "completed":
            return f"Completed command: {command}"
        if item_status == "failed":
            return f"Command failed: {command}"
    if item_type == "todo_list":
        todos = item.get("items")
        if isinstance(todos, list):
            incomplete = [str(todo.get("text")) for todo in todos if isinstance(todo, dict) and not todo.get("completed")]
            if incomplete:
                return f"Next: {incomplete[0]}"
    return None


def build_remote_agent_prompt():
    artifact_contract = "\n".join(
        [
            "You are executing an Alpha Research remote agent run inside a dataset-attached cloud workspace.",
            f"Run type: {RUN_TYPE}",
            f"Dataset id: {DATASET_ID}",
            f"Dataset mount path: {DATASET_MOUNT_PATH}",
            f"Manifest path: {MANIFEST_PATH}",
            f"Workspace path: {WORKSPACE_DIR}",
            f"The dataset is also available at {WORKSPACE_DIR / 'dataset'} inside the workspace.",
            f"Artifact directory: {ARTIFACT_DIR}",
            "",
            "You may inspect files, run shell commands, write scripts, and produce result files.",
            "Use the mounted dataset and manifest to understand the corpus before acting.",
            "For any command or script expected to run longer than 30 seconds, print progress at least every 30 seconds.",
            "If you generate deliverables, write them into the artifact directory.",
            "Required outputs:",
            "- summary.md: a concise human-readable summary of what you found or built",
            "- result.json: structured machine-readable output when appropriate",
            "Optional outputs:",
            "- tables as .csv",
            "- charts as .png or .svg",
            "- scripts as .py, .sql, or .sh",
            "",
            "At the end, make sure summary.md exists. If you create structured results, also write result.json.",
            "In your final response, state exactly which files you created in the artifact directory.",
            "",
            "User request:",
            PROMPT,
        ]
    )
    return artifact_contract


def artifact_content_for_path(path: Path):
    suffix = path.suffix.lower()
    if suffix in {".json"}:
        try:
            return json.loads(path.read_text())
        except Exception:
            return {"path": str(path), "preview": path.read_text()[:5000]}
    if suffix in {".md", ".txt", ".csv", ".sql", ".py", ".sh", ".svg"}:
        return {"path": str(path), "text": path.read_text()[:20000]}
    return {"path": str(path), "note": "binary-or-unsupported-preview"}


def infer_artifact_type(path: Path):
    suffix = path.suffix.lower()
    if suffix == ".json":
        return "structured_result"
    if suffix == ".csv":
        return "table"
    if suffix in {".png", ".svg"}:
        return "chart"
    if suffix in {".py", ".sql", ".sh"}:
        return "script"
    return "file"


def collect_artifacts():
    created = []
    if LAST_MESSAGE_PATH.exists():
        create_artifact(
            "remote_agent_summary",
            "Remote Agent Summary",
            {"text": LAST_MESSAGE_PATH.read_text()},
        )
        created.append("last-message")
    if TRANSCRIPT_PATH.exists():
        transcript_text = TRANSCRIPT_PATH.read_text()[-50000:]
        create_artifact(
            "remote_agent_transcript",
            "Remote Agent Transcript",
            {"text": transcript_text},
        )
        created.append("transcript")
    if ARTIFACT_DIR.exists():
        for path in sorted(ARTIFACT_DIR.rglob("*")):
            if not path.is_file():
                continue
            create_artifact(
                infer_artifact_type(path),
                path.name,
                artifact_content_for_path(path),
            )
            created.append(path.name)
    return created


def run_codex():
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    dataset_link = WORKSPACE_DIR / "dataset"
    if not dataset_link.exists():
        dataset_link.symlink_to(DATASET_MOUNT_PATH, target_is_directory=True)
    prompt_text = build_remote_agent_prompt()
    command = [
        "codex",
        "exec",
        "--skip-git-repo-check",
        "--dangerously-bypass-approvals-and-sandbox",
        "--json",
        "--output-last-message",
        str(LAST_MESSAGE_PATH),
        "-C",
        str(WORKSPACE_DIR),
        "-m",
        REMOTE_AGENT_MODEL,
    ]
    if REMOTE_AGENT_SESSION_ID:
        command.extend(["resume", REMOTE_AGENT_SESSION_ID, prompt_text])
    else:
        command.append(prompt_text)

    env = os.environ.copy()
    env["CODEX_HOME"] = str(CODEX_HOME)
    env["ARTIFACT_DIR"] = str(ARTIFACT_DIR)
    env["DATASET_MOUNT_PATH"] = str(DATASET_MOUNT_PATH)
    env["MANIFEST_PATH"] = str(MANIFEST_PATH)
    env["RUN_TYPE"] = RUN_TYPE

    post_event("Starting remote agent executor.")
    post_status("running", "Starting remote agent executor.")
    post_session_entry("user", "prompt", PROMPT, "Remote run request", {
        "runType": RUN_TYPE,
        "datasetId": DATASET_ID,
    })

    session_id = None
    started_at = time.monotonic()
    last_output_at = started_at
    last_status = "Starting remote agent executor."
    stop_heartbeat = threading.Event()

    def heartbeat_loop():
        while not stop_heartbeat.wait(HEARTBEAT_INTERVAL_SECONDS):
            elapsed = int(time.monotonic() - started_at)
            idle_for = int(time.monotonic() - last_output_at)
            preview = f"Remote agent running for {elapsed}s. Last activity {idle_for}s ago. {last_status}"
            safe_post_status("running", preview[:500])
            safe_post_event(f"Remote agent heartbeat: {preview[:500]}")

    heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    heartbeat_thread.start()
    with TRANSCRIPT_PATH.open("w", encoding="utf-8") as transcript:
      process = subprocess.Popen(
          command,
          stdout=subprocess.PIPE,
          stderr=subprocess.STDOUT,
          text=True,
          env=env,
      )
      assert process.stdout is not None
      for line in process.stdout:
          transcript.write(line)
          transcript.flush()
          stripped = line.strip()
          if not stripped:
              continue
          last_output_at = time.monotonic()
          match = SESSION_ID_RE.search(stripped)
          if match and not session_id:
              session_id = match.group(1)
              create_artifact("remote_agent_session", "Remote Agent Session", {"sessionId": session_id})
              post_event(f"Remote agent session {session_id} started.")
              post_session_entry("assistant", "session", f"Remote agent session {session_id} started.", "Session started", {
                  "sessionId": session_id,
              })
          if stripped.startswith("{"):
              summary = summarize_codex_json_line(stripped)
              if summary:
                  last_status = summary
                  safe_post_status("running", summary)
              post_event(stripped[:2000])
              post_session_entry("assistant", "stdout", stripped[:5000], "Stdout JSON")
          elif stripped.startswith("ERROR:"):
              post_event(stripped, "error")
              post_session_entry("system", "stderr", stripped[:5000], "Remote error")
          elif "session id:" in stripped.lower():
              post_event(stripped)
              post_session_entry("assistant", "stdout", stripped[:5000], "Session output")
          else:
              post_session_entry("assistant", "stdout", stripped[:5000], "Remote output")
      return_code = process.wait()
      stop_heartbeat.set()
      heartbeat_thread.join(timeout=2)
    if return_code != 0:
        raise RuntimeError(f"codex exec failed with exit code {return_code}")
    return session_id


def main():
    session_id = run_codex()
    created = collect_artifacts()
    if not created:
        raise RuntimeError("Remote agent run completed without producing any artifacts")
    summary = f"Remote agent run completed with {len(created)} artifact(s)."
    if session_id:
        summary += f" Session: {session_id}."
    post_event(summary)
    post_status("ready", summary)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        post_event(f"Remote agent run failed: {exc}", "error")
        post_status("failed", str(exc))
        raise
