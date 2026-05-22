#!/usr/bin/env bash
# Claude Code PostToolUse hook for Edit|Write|MultiEdit.
# Runs prettier --write on the edited file, then oxlint on it
# (only when the extension is something oxlint understands).
#
# Hook input arrives on stdin as JSON. The edited file path is at
# .tool_input.file_path (Edit / Write) or .tool_input.notebook_path
# / .tool_input.file_path for other shapes.

set -uo pipefail

command -v jq >/dev/null 2>&1 || {
  echo "format-lint hook: jq is required but not installed (brew install jq / apt install jq)." >&2
  exit 2
}

INPUT="$(cat)"

FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')"

if [ -z "$FILE" ]; then
  exit 0
fi

# Only operate on files inside the project root.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
case "$FILE" in
  "$PROJECT_ROOT"/*) ;;
  *) exit 0 ;;
esac

if [ ! -f "$FILE" ]; then
  exit 0
fi

cd "$PROJECT_ROOT"

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.jsonc|*.md|*.mdx|*.css|*.html|*.yml|*.yaml)
    npx --no-install prettier --write --log-level=warn "$FILE" >&2 || true
    ;;
esac

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    if ! npx --no-install oxlint "$FILE" >&2; then
      echo "oxlint reported issues in $FILE — fix before continuing." >&2
      exit 2
    fi
    ;;
esac

exit 0
