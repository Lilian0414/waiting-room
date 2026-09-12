#!/usr/bin/env bash
# Codex hooks send JSON on stdin; the legacy `notify` callback passes it as argv[1].
# In either form this process emits only the existing five-field lobby contract.
set -u

WR_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$WR_HERE/config.sh"

if ! wr_is_enabled; then cat >/dev/null 2>&1 || true; exit 0; fi
WR_TOKEN_VALUE="$(wr_token)"
[ -n "$WR_TOKEN_VALUE" ] || { cat >/dev/null 2>&1 || true; exit 0; }
command -v node >/dev/null 2>&1 || { cat >/dev/null 2>&1 || true; exit 0; }

if [ "$#" -gt 0 ]; then
  BODY="$(WR_TOKEN="$WR_TOKEN_VALUE" node "$WR_HERE/classify.js" "$1" 2>/dev/null || true)"
else
  BODY="$(WR_TOKEN="$WR_TOKEN_VALUE" node "$WR_HERE/classify.js" 2>/dev/null || true)"
fi
[ -n "$BODY" ] || exit 0

case "$BODY" in
  *'"event":"stopped"'*) wr_detach bash "$WR_HERE/deliver.sh" "$BODY" ;;
  *) bash "$WR_HERE/deliver.sh" "$BODY" ;;
esac
exit 0
