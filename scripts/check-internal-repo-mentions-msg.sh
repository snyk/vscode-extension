#!/usr/bin/env bash
# commit-msg stage: block committing a mention of a private snyk/<repo> in the commit message.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/repo-privacy-check.sh
source "$SCRIPT_DIR/lib/repo-privacy-check.sh"

msg_file="$1"
slugs=$(extract_repo_slugs < "$msg_file" || true)

[[ -z "$slugs" ]] && exit 0

enforce_no_private_mentions "commit message" "$slugs" "warn"
