#!/usr/bin/env bats

bats_require_minimum_version 1.5.0

setup() {
    TEST_DIR="$(mktemp -d)"
    TEST_CONFIG="$TEST_DIR/settings.json"
}

teardown() {
    rm -rf "$TEST_DIR"
}

@test "Missing file should log and exit 0" {
    run bash enforce-snyk-secure-at-inception.sh "$TEST_CONFIG"
    [ "$status" -eq 0 ]
    [[ "${output}" =~ \[INFO\]\ Processing\ configuration\ file: ]]
    [[ "${output}" =~ \[INFO\]\ Config\ file\ does\ not\ exist ]]
}


@test "Valid JSON without key should add key=true and exit 0" {
    echo '{"other": "value"}' > "$TEST_CONFIG"
    run bash enforce-snyk-secure-at-inception.sh "$TEST_CONFIG"
    [ "$status" -eq 0 ]
    [[ "${output}" =~ \[INFO\]\ Successfully\ updated: ]]

    # Verify the change
    run python3 -c "import json; print(json.load(open('$TEST_CONFIG'))['snyk.securityAtInception'])"
    [[ "$output" == "True" ]]
}

@test "Valid JSON with key=false should overwrite to true and exit 0" {
    echo '{"snyk.securityAtInception": false}' > "$TEST_CONFIG"
    run bash enforce-snyk-secure-at-inception.sh "$TEST_CONFIG"
    [ "$status" -eq 0 ]
    [[ "${output}" =~ \[INFO\]\ Successfully\ updated: ]]

    # Verify the change
    run python3 -c "import json; print(json.load(open('$TEST_CONFIG'))['snyk.securityAtInception'])"
    [[ "$output" == "True" ]]
}

@test "Valid JSON with key=true should make no changes and exit 0" {
    echo '{"snyk.securityAtInception": true}' > "$TEST_CONFIG"
    run bash enforce-snyk-secure-at-inception.sh "$TEST_CONFIG"
    [ "$status" -eq 0 ]
    [[ "${output}" =~ \[INFO\]\ No\ changes\ needed,\ skipping ]]
}

@test "Permission denied on write should log error and exit 1" {
    echo '{"other": "value"}' > "$TEST_CONFIG"
    chmod 444 "$TEST_CONFIG"  # Make file read-only
    run bash enforce-snyk-secure-at-inception.sh "$TEST_CONFIG"
    [ "$status" -eq 1 ]
    [[ "${output}" =~ \[ERROR\]\ Failed\ to\ update\ config\ file ]]
}

@test "Python3 missing should log error and exit 1" {
    # Save original search path
    local original_search_path="$PATH"
    # Remove python3 from search path
    local search_path="/nonexistent"
    export PATH="$search_path"

    run /bin/bash enforce-snyk-secure-at-inception.sh "$TEST_CONFIG"

    # Restore search path
    PATH="$original_search_path"

    echo "output: ${output}"
    echo "stderr: ${stderr}"

    [ "$status" -eq 1 ]
    [[ "${output}" =~ \[ERROR\]\ python3\ not\ found ]]
}

@test "Default config file should be used when no arguments" {
    local default_config="$TEST_DIR/Windsurf/User/settings.json"
    mkdir -p "$(dirname "$default_config")"
    echo '{"other": "value"}' > "$default_config"

    HOME="$TEST_DIR" run bash enforce-snyk-secure-at-inception.sh

    [ "$status" -eq 0 ]
    [[ "${output}" =~ \[INFO\]\ Processing\ configuration\ file:.*Windsurf/User/settings\.json ]]
}

@test "Multiple config files should be processed" {
    local test_config2="$TEST_DIR/settings2.json"
    echo '{"other": "value"}' > "$TEST_CONFIG"
    echo '{"snyk.securityAtInception": false}' > "$test_config2"

    run bash enforce-snyk-secure-at-inception.sh "$TEST_CONFIG" "$test_config2"
    [ "$status" -eq 0 ]
    [[ "${output}" =~ \[INFO\]\ Successfully\ updated:.*${TEST_CONFIG} ]]
    [[ "${output}" =~ \[INFO\]\ Successfully\ updated:.*${test_config2} ]]

    # Verify both files were updated
    run python3 -c "import json; print(json.load(open('$TEST_CONFIG'))['snyk.securityAtInception'])"
    [[ "$output" == "True" ]]
    run python3 -c "import json; print(json.load(open('$test_config2'))['snyk.securityAtInception'])"
    [[ "$output" == "True" ]]
}
