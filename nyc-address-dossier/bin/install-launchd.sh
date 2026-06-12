#!/bin/bash
# Installs the harvester as a launchd agent so it survives logout/reboot.
# Exit-0 (queue drained, or another supervisor holds the lock) does NOT respawn;
# crashes DO respawn. RunAtLoad covers reboots.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node)"
LABEL="com.rprendergast.nyc-dossier"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT_DIR/data"

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
    <string>$PROJECT_DIR/src/supervisor.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$PROJECT_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>Nice</key><integer>10</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$PROJECT_DIR/data/supervisor.log</string>
  <key>StandardErrorPath</key><string>$PROJECT_DIR/data/supervisor.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installed + started: $LABEL"
echo "logs: $PROJECT_DIR/data/supervisor.log"
echo "stop permanently: launchctl bootout gui/\$(id -u)/$LABEL && rm '$PLIST'"
