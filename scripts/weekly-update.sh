#!/usr/bin/env bash
# Weekly Salesforce Community Events status update.
#
# Runs check-cfp-status.js, logs output to ~/.local/state/sf-events/, and
# leaves the working tree dirty so you can `git diff`, review, and commit/push
# manually. Intended to be called by a user crontab entry (see README runbook),
# but safe to run directly: ./scripts/weekly-update.sh
set -u

# Resolve repo root from this script's location (scripts/ -> parent).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

# Source nvm so `node` resolves regardless of node version upgrades.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null

LOG_DIR="$HOME/.local/state/sf-events"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
LOG="$LOG_DIR/weekly-update-$STAMP.log"
LATEST="$LOG_DIR/weekly-update-latest.log"

# Run the checker; capture all output to the log.
node check-cfp-status.js > "$LOG" 2>&1
EXIT=$?
cp "$LOG" "$LATEST"

# Summarize what changed in the working tree.
CHANGED=$(git status --porcelain README.md | wc -l)
if [ "$EXIT" -ne 0 ]; then
  STATUS="❌ check-cfp-status.js exited $EXIT — see $LOG"
elif [ "${CHANGED:-0}" -gt 0 ]; then
  STATUS="✅ Run complete; README.md has changes to review and commit. Log: $LOG"
else
  STATUS="✅ Run complete; no changes. Log: $LOG"
fi

echo "$STATUS" | tee -a "$LOG"

# Best-effort desktop notification (cron runs headless; this may not fire).
if command -v notify-send >/dev/null 2>&1; then
  DISPLAY=:0 DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus" \
    notify-send "Salesforce Events weekly update" "$STATUS" 2>/dev/null || true
fi

exit 0