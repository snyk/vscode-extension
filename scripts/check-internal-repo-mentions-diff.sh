#!/usr/bin/env bash
# pre-commit stage: block committing a mention of a private snyk/<repo> in the staged diff.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/repo-privacy-check.sh
source "$SCRIPT_DIR/lib/repo-privacy-check.sh"

added_lines=$(git diff --cached -U0 --text --no-color -- "$@" | extract_added_lines || true)
slugs=$(printf '%s\n' "$added_lines" | extract_repo_slugs || true)

[[ -z "$slugs" ]] && exit 0

enforce_no_private_mentions "commit diff" "$slugs" "warn"
