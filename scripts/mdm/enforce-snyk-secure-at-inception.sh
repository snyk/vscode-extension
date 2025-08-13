#!/bin/bash

set -u -o pipefail

log_info() {
    echo "[INFO] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

# Check for Python3 availability
command -v python3 >/dev/null 2>&1 || { log_error "python3 not found"; exit 1; }

update_json() {
    local file_path="$1"
    python3 - <<'PY' "$file_path"
import sys, json, os

try:
    file_path = sys.argv[1]

    with open(file_path, 'r') as f:
        data = json.load(f)

    if data.get('snyk.securityAtInception') is True:
        sys.exit(3)

    data['snyk.securityAtInception'] = True

    json_str = json.dumps(data, indent=2)

    with open(file_path, 'w') as f:
        f.write(json_str)
except Exception as e:
    print(f"Error processing JSON: {e}", file=sys.stderr)
    sys.exit(1)
PY
}

process_config_file() {
    local config_file="$1"
    log_info "Processing configuration file: $config_file"

    if [ ! -f "$config_file" ]; then
        log_info "Config file does not exist, skipping"
        return
    fi

    update_json "$config_file"
    update_status=$?
    if [ $update_status -eq 1 ]; then
	log_error "Failed to update config file"
	exit 1
    elif [ $update_status -eq 3 ]; then
        log_info "No changes needed, skipping"
    else
        log_info "Successfully updated"
    fi
}

main() {
    local config_files=("$HOME/Library/Application Support/Windsurf/User/settings.json")
    if [ $# -gt 0 ]; then
        config_files=("$@")
    fi

    for config_file in "${config_files[@]}"; do
        process_config_file "$config_file"
    done
}

main "$@"
