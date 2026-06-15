#!/bin/sh
set -eu

BASE_URL="${PRECHECK_BASE_URL:-https://alpharesearch.nyc/precheck}"
INSTALL_DIR="${PRECHECK_INSTALL_DIR:-$HOME/.local/bin}"
TARGET="$INSTALL_DIR/precheck"

mkdir -p "$INSTALL_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "precheck requires Node.js 20 or newer: https://nodejs.org/" >&2
  exit 1
fi

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$BASE_URL/precheck.mjs" -o "$TARGET"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TARGET" "$BASE_URL/precheck.mjs"
else
  echo "precheck installer requires curl or wget." >&2
  exit 1
fi

chmod +x "$TARGET"

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo "Installed precheck to $TARGET"
    echo "Add $INSTALL_DIR to PATH, then run: precheck"
    exit 0
    ;;
esac

echo "Installed precheck to $TARGET"
echo "Run precheck from inside a GitHub repository."
