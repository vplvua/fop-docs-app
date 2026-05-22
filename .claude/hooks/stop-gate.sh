#!/usr/bin/env bash
# Claude Code Stop hook.
# Runs the fast static gates (typecheck + vitest) before the agent is
# allowed to stop. If anything fails, exits 2 with a message — the
# agent then continues and fixes the failure instead of declaring done.

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

if ! npm run --silent typecheck >&2; then
  echo "Stop hook: typecheck failed — fix TypeScript errors before stopping." >&2
  exit 2
fi

if ! npm run --silent test:run -- --bail=1 >&2; then
  echo "Stop hook: vitest failed — fix failing tests before stopping." >&2
  exit 2
fi

exit 0
