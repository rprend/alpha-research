#!/bin/bash
# Installs the harvester as a launchd agent so it survives logout/reboot.
# Exit-0 (queue drained, or another supervisor holds the lock) does NOT respawn;
# crashes DO respawn. RunAtLoad covers reboots.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node)"
LABEL="com.rprendergast.nyc-dossier"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

# Runtime copy lives outside ~/Documents: TCC blocks launchd agents from
# protected folders, so the agent runs from ~/.nyc-address-dossier/runtime.
DOSSIER_HOME="${NYC_DOSSIER_HOME:-$HOME/.nyc-address-dossier}"
RUNTIME="$DOSSIER_HOME/runtime"
mkdir -p "$HOME/Library/LaunchAgents" "$DOSSIER_HOME/data" "$RUNTIME"
rsync -a --delete "$PROJECT_DIR/src" "$PROJECT_DIR/package.json" "$PROJECT_DIR/node_modules" "$RUNTIME/"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>--experimental-sqlite</string>
    <string>$RUNTIME/src/supervisor.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$RUNTIME</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>Nice</key><integer>10</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$DOSSIER_HOME/data/supervisor.log</string>
  <key>StandardErrorPath</key><string>$DOSSIER_HOME/data/supervisor.log</string>
</dict>
</plist>
EOF

# Convenience symlink so the dashboard is visible from the repo checkout.
ln -sfn "$DOSSIER_HOME/status.md" "$PROJECT_DIR/status.md"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installed + started: $LABEL"
echo "home: $DOSSIER_HOME"
echo "logs: $DOSSIER_HOME/data/supervisor.log"
echo "stop permanently: launchctl bootout gui/\$(id -u)/$LABEL && rm '$PLIST'"
