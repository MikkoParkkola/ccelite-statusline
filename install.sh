#!/usr/bin/env bash
# install.sh — build ccelite-statusline (Rust) and deploy it to the
# persistent path Claude Code's statusline wrapper expects.
#
# WHY THIS EXISTS (2026-07-02):
#   The repo builds a binary named `ccstatusline` (per Cargo.toml), but the
#   Claude Code wrapper `~/.claude/bin/ccstatusline-wrapper.sh` execs a binary
#   named `ccstatusline-rs`. If the built binary is never copied+renamed to
#   ~/.claude/bin/ccstatusline-rs, the wrapper SILENTLY falls back to the old
#   bash statusline (statusline-elite-v14.sh) — which renders only a subset of
#   fields, so the statusline looks "stale" with no error. Additionally,
#   target/ is periodically reaped, so the live binary MUST be a standalone
#   copy outside target/, not a symlink into it.
#
# This script is the single source of truth for build+deploy. Run it after any
# change to the statusline, or after target/ has been cleaned.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_NAME="ccstatusline"                       # Cargo [package].name
DEST_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/bin"
DEST="${DEST_DIR}/ccstatusline-rs"            # name the wrapper execs

echo "==> Building ${BIN_NAME} (release)…"
( cd "$REPO_DIR" && cargo build --release )

SRC="${REPO_DIR}/target/release/${BIN_NAME}"
if [[ ! -x "$SRC" ]]; then
  echo "ERROR: build did not produce ${SRC}" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

# Copy (never symlink — target/ gets reaped) to the persistent path.
# Copy to a temp name then atomically move, so a running statusline never
# reads a half-written binary.
TMP="${DEST}.tmp.$$"
cp "$SRC" "$TMP"
chmod +x "$TMP"
mv -f "$TMP" "$DEST"

echo "==> Deployed: ${DEST}"
echo "    $(ls -la "$DEST")"

# Sanity: confirm the wrapper will actually pick this up (primary branch).
WRAPPER="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/bin/ccstatusline-wrapper.sh"
if [[ -f "$WRAPPER" ]]; then
  if grep -q "ccstatusline-rs" "$WRAPPER"; then
    echo "==> OK: wrapper ${WRAPPER} targets ccstatusline-rs (primary backend)."
  else
    echo "WARNING: ${WRAPPER} does not reference ccstatusline-rs — check its RUST_BACKEND path." >&2
  fi
else
  echo "NOTE: wrapper not found at ${WRAPPER}."
  echo "      Point Claude Code settings.json statusLine.command at a wrapper that execs ${DEST},"
  echo "      or set statusLine.command directly to ${DEST}."
fi

# Optional smoke test (skipped if no TTY-independent input). Renders one frame
# from a synthetic payload so a broken build is caught here, not on next prompt.
if [[ "${1:-}" == "--smoke" ]]; then
  echo "==> Smoke test:"
  printf '%s' '{"session_id":"install-smoke","transcript_path":"/dev/null","cwd":"'"$HOME"'","model":{"id":"claude-sonnet-4-5[1m]","display_name":"Sonnet"},"workspace":{"current_dir":"'"$HOME"'"},"version":"0.0.0"}' \
    | "$DEST" | head -3 || { echo "ERROR: smoke render failed" >&2; exit 1; }
fi

echo "==> Done. New statusline is live on the next Claude Code prompt."
