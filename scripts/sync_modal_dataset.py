#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload a local dataset directory to the shared Modal dataset volume.")
    parser.add_argument("--dataset-id", required=True, help="Dataset id to place under /datasets/<dataset-id> on Modal.")
    parser.add_argument("--source", required=True, help="Local file or directory to upload.")
    parser.add_argument("--volume", default="agent-dataset", help="Modal Volume name.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files on the Modal Volume.")
    parser.add_argument("--modal-env", default="", help="Optional Modal environment name.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = Path(args.source).expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"Source does not exist: {source}")

    remote_path = f"/datasets/{args.dataset_id}/"
    command = ["modal", "volume", "put", args.volume, str(source), remote_path]
    if args.force:
        command.append("--force")
    if args.modal_env:
        command.extend(["--env", args.modal_env])

    subprocess.run(command, check=True)
    print(f"Uploaded {source} to Modal volume {args.volume}:{remote_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
