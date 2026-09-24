#!/usr/bin/env bash
# pre-push stage: block pushing a mention of a private snyk/<repo>.
# Network is required to push at all, so unlike the commit-time checks, a gh
# error here blocks rather than warns.
#
# pre-commit exposes the push range as PRE_COMMIT_FROM_REF/PRE_COMMIT_TO_REF
# (it consumes the raw git pre-push stdin protocol itself) and passes the
# changed files as args, same as the other stages.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/repo-privacy-check.sh
source "$SCRIPT_DIR/lib/repo-privacy-check.sh"

if [[ -n "${PRE_COMMIT_FROM_REF:-}" && -n "${PRE_COMMIT_TO_REF:-}" ]]; then
  added_lines=$(git diff -U0 --text --no-color "$PRE_COMMIT_FROM_REF" "$PRE_COMMIT_TO_REF" -- "$@" | extract_added_lines || true)
  messages=$(git log --format=%B "$PRE_COMMIT_FROM_REF..$PRE_COMMIT_TO_REF" || true)
else
  # Initial push of a whole new history: pre-commit never sets PRE_COMMIT_TO_REF on this
  # path (confirmed against pre-commit 4.6.2 source), so read each pushed file's content
  # from PRE_COMMIT_LOCAL_BRANCH -- the ref actually being pushed, which pre-commit does
  # export here -- rather than HEAD, which is wrong whenever the pushed branch isn't the
  # one currently checked out.
  to_ref="${PRE_COMMIT_LOCAL_BRANCH:-HEAD}"
  added_lines=""
  for f in "$@"; do
    added_lines+=$'\n'"$(git show "$to_ref:$f" 2>/dev/null || true)"
  done
  messages=$(git log --format=%B "$to_ref" || true)
fi

slugs=$(printf '%s\n%s\n' "$added_lines" "$messages" | extract_repo_slugs || true)

[[ -z "$slugs" ]] && exit 0

enforce_no_private_mentions "push" "$slugs" "block"
