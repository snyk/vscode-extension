#!/usr/bin/env bats

bats_require_minimum_version 1.5.0

setup() {
	TEST_DIR="$(mktemp -d)"
	BIN_DIR="$TEST_DIR/bin"
	mkdir -p "$BIN_DIR"
	ORIGINAL_PATH="$PATH"
	use_minimal_path
}

teardown() {
	rm -rf "$TEST_DIR"
	PATH="$ORIGINAL_PATH"
}

create_windsurf_stub() {
	local behavior="$1" # list_ok|list_fail|install_fail|list_empty
	cat > "$BIN_DIR/windsurf" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
BEHAVIOR="__BEHAVIOR__"
MARKER_DIR="__MARKER_DIR__"

case "${1-}" in
  --list-extensions)
    if [[ "$BEHAVIOR" == "list_fail" ]]; then
      exit 1
    elif [[ "$BEHAVIOR" == "list_ok" ]]; then
      echo "snyk-security.snyk-vulnerability-scanner-preview"
    else
      # list_empty
      :
    fi
    ;;
  --install-extension=*)
    if [[ "$BEHAVIOR" == "install_fail" ]]; then
      exit 1
    fi
    mkdir -p "$MARKER_DIR"
    echo "$1" > "$MARKER_DIR/install_called"
    ;;
  *)
    # No-op for other invocations
    ;;
esac
EOF
	# Inject behavior values
	sed -i '' "s|__BEHAVIOR__|$behavior|g" "$BIN_DIR/windsurf"
	sed -i '' "s|__MARKER_DIR__|$TEST_DIR|g" "$BIN_DIR/windsurf"
	chmod +x "$BIN_DIR/windsurf"
}

create_curl_stub() {
	local mode="$1" # success|fail
	cat > "$BIN_DIR/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
MODE="__MODE__"
OUT=""
while (( "$#" )); do
  case "$1" in
    --output)
      shift
      OUT="$1"
      ;;
  esac
  shift || true
done

if [[ "$MODE" == "fail" ]]; then
  exit 22
fi

if [[ -z "$OUT" ]]; then
  echo "no output provided" >&2
  exit 2
fi

# Create a non-empty file
echo "dummy" > "$OUT"
EOF
	sed -i '' "s|__MODE__|$mode|g" "$BIN_DIR/curl"
	chmod +x "$BIN_DIR/curl"
}

use_minimal_path() {
	PATH="$BIN_DIR:/usr/bin:/bin"
}

@test "Editor not installed should skip and exit 0" {
	run bash install-snyk-plugin.sh
	[ "$status" -eq 0 ]
	[[ "${output}" =~ \[INFO\]\ windsurf\ not\ installed,\ skipping ]]
	[[ "${output}" =~ \[INFO\]\ Snyk\ plugin\ installation\ script\ completed\ successfully ]]
}

@test "Editor installed and plugin already installed should skip install" {
	create_windsurf_stub "list_ok"
	# Defensive: if curl gets called, it would indicate wrong code path
	create_curl_stub "fail"

	run bash install-snyk-plugin.sh
	[ "$status" -eq 0 ]
	[[ "${output}" =~ \[INFO\]\ Snyk\ plugin\ already\ installed\ in\ windsurf,\ skipping ]]
	[ ! -f "$TEST_DIR/install_called" ]
}

@test "Plugin not installed: download, validate and install successfully" {
	create_windsurf_stub "list_empty"
	create_curl_stub "success"

	run bash install-snyk-plugin.sh
	[ "$status" -eq 0 ]
	[[ "${output}" =~ \[INFO\]\ Plugin\ downloaded\ successfully ]]
	[[ "${output}" =~ \[INFO\]\ Installing\ plugin\ from ]]
	[ -f "$TEST_DIR/install_called" ]
}

@test "Curl download failure should exit 1" {
	create_windsurf_stub "list_empty"
	create_curl_stub "fail"
	# file stub not needed when curl fails

	run bash install-snyk-plugin.sh
	[ "$status" -eq 1 ]
	[[ "${output}" =~ \[ERROR\]\ Failed\ to\ download\ plugin\ from ]]
}

@test "Plugin install failure should exit 1" {
	create_windsurf_stub "install_fail"
	create_curl_stub "success"

	run bash install-snyk-plugin.sh
	[ "$status" -eq 1 ]
	[[ "${output}" =~ \[ERROR\]\ Failed\ to\ install\ plugin\ in\ windsurf ]]
}

@test "Listing extensions failure should exit 1" {
	create_windsurf_stub "list_fail"

	run bash install-snyk-plugin.sh
	[ "$status" -eq 1 ]
	[[ "${output}" =~ \[ERROR\]\ Failed\ to\ list\ windsurf\ extensions ]]
}
