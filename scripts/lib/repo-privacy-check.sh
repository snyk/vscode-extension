#!/usr/bin/env bash
# Shared helpers for the internal-repo-mention hooks (pre-commit / commit-msg / pre-push).
set -euo pipefail

# Repos it's already fine to mention by name, either because they're public,
# or because they're private but already named publicly.
ALLOWED_REPOS=(
  # Private, but already named publicly in cli's cliv2-private/go.mod dependency list.
  "snyk/ambient-canary"
  "snyk/cli-extension-axi"
  "snyk/cli-extension-cos"
  "snyk/remy-cli-extension"
  "snyk/rift-cli-extension"

  # Public: snyk/cli itself, plus its extensions/dependencies (from cli's go.mod).
  "snyk/cli"
  "snyk/cli-extension-agent-scan"
  "snyk/cli-extension-ai-bom"
  "snyk/cli-extension-dep-graph"
  "snyk/cli-extension-iac"
  "snyk/cli-extension-iac-rules"
  "snyk/cli-extension-os-flows"
  "snyk/cli-extension-sbom"
  "snyk/cli-extension-secrets"
  "snyk/code-client-go"
  "snyk/container-cli"
  "snyk/dep-graph"
  "snyk/error-catalog-golang-public"
  "snyk/go-application-framework"
  "snyk/go-httpauth"
  "snyk/policy-engine"
  "snyk/snyk-iac-capture"
  "snyk/snyk-ls"
  "snyk/studio-mcp"

  # Public: Snyk's own IDE repos.
  "snyk/snyk-eclipse-plugin"
  "snyk/snyk-intellij-plugin"
  "snyk/snyk-visual-studio-plugin"
  "snyk/vscode-extension"
)

is_allowed_repo() {
  local slug="$1" r
  for r in "${ALLOWED_REPOS[@]}"; do
    [[ "$slug" == "$r" ]] && return 0
  done
  return 1
}

extract_repo_slugs() {
  grep -aohE 'snyk/[A-Za-z0-9._-]+' | sed -E 's/[.]+$//; s/\.git$//' | sort -u
}

# Prints only added lines (excluding the "+++ b/path" file-header line) from a unified diff on stdin.
extract_added_lines() {
  grep -E '^\+' | grep -vE '^\+\+\+ '
}

# check_slug SLUG ON_GH_ERROR
# ON_GH_ERROR is "warn" (don't block, just print a warning) or "block".
# Returns 0 (pass) unless the repo is confirmed private, or a non-404 gh error occurs with ON_GH_ERROR=block.
check_slug() {
  local slug="$1" on_gh_error="$2" private_status gh_err

  gh_err=$(mktemp)
  if private_status=$(gh api "repos/$slug" --jq '.private' 2>"$gh_err"); then
    rm -f "$gh_err"
    if [[ "$private_status" == "true" ]]; then
      echo "BLOCKED: $slug is a private repo." >&2
      return 1
    fi
    return 0
  fi

  if grep -qi '404' "$gh_err"; then
    rm -f "$gh_err"
    return 0 # repo doesn't exist -> not a real hit
  fi

  local err_msg
  err_msg=$(cat "$gh_err")
  rm -f "$gh_err"

  if [[ "$on_gh_error" == "block" ]]; then
    echo "BLOCKED: could not verify visibility of $slug via gh: $err_msg" >&2
    return 1
  fi

  echo "WARNING: could not verify visibility of $slug via gh (continuing): $err_msg" >&2
  return 0
}

# enforce_no_private_mentions CONTEXT_LABEL SLUGS ON_GH_ERROR
enforce_no_private_mentions() {
  local context="$1" slugs="$2" on_gh_error="$3" slug blocked=0

  for slug in $slugs; do
    is_allowed_repo "$slug" && continue
    check_slug "$slug" "$on_gh_error" || blocked=1
  done

  if [[ "$blocked" == "1" ]]; then
    echo "Private repo mention found in $context. Remove it or add it to ALLOWED_REPOS in scripts/lib/repo-privacy-check.sh if it's already safe to name." >&2
    return 1
  fi
  return 0
}
