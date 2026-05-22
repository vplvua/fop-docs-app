#!/usr/bin/env bash
# Claude Code PreToolUse hook for Bash.
# Blocks destructive shell operations that should require human approval:
#   - rm -rf on root, home, or wildcards
#   - git push --force / -f / +ref
#   - git reset --hard
#   - git clean -fd
#   - chmod 777
#
# Exits 2 with a stderr message to deny the tool call.

set -uo pipefail

command -v jq >/dev/null 2>&1 || {
  echo "block-dangerous-bash hook: jq is required but not installed (brew install jq / apt install jq)." >&2
  exit 2
}

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

if [ -z "$COMMAND" ]; then
  exit 0
fi

deny() {
  echo "PreToolUse block: $1" >&2
  echo "Command was: $COMMAND" >&2
  exit 2
}

# rm -rf on dangerous targets
if printf '%s' "$COMMAND" | grep -Eq 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-rf|-fr)[[:space:]]+(/|~|\$HOME|\*|\.\*)'; then
  deny "rm -rf on root/home/wildcard is not allowed"
fi

# git push --force or -f (positional)
if printf '%s' "$COMMAND" | grep -Eq 'git[[:space:]]+push[[:space:]]+.*(--force([[:space:]]|$|=)|--force-with-lease[[:space:]]+[^=]|[[:space:]]-f([[:space:]]|$))'; then
  deny "git push --force / -f requires explicit human approval"
fi

# git reset --hard
if printf '%s' "$COMMAND" | grep -Eq 'git[[:space:]]+reset[[:space:]]+(--hard|-{0,2}[[:space:]]*--hard)'; then
  deny "git reset --hard requires explicit human approval"
fi

# git clean -fd / -fdx
if printf '%s' "$COMMAND" | grep -Eq 'git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f'; then
  deny "git clean -f requires explicit human approval"
fi

# chmod 777
if printf '%s' "$COMMAND" | grep -Eq 'chmod[[:space:]]+(-[a-zA-Z]+[[:space:]]+)?777'; then
  deny "chmod 777 is not allowed"
fi

exit 0
