#!/bin/sh
set -eu

PRECHECK_BASE_URL="${PRECHECK_BASE_URL:-https://alpharesearch.nyc/precheck}"
export PRECHECK_BASE_URL

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$PRECHECK_BASE_URL/install.sh" | sh
elif command -v wget >/dev/null 2>&1; then
  wget -qO- "$PRECHECK_BASE_URL/install.sh" | sh
else
  echo "precheck installer requires curl or wget." >&2
  exit 1
fi
