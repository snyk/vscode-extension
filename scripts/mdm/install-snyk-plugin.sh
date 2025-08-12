#!/bin/bash

set -euo pipefail

readonly PLUGIN_FILENAME="snyk-vulnerability-scanner-preview.vsix"
readonly DOWNLOAD_URL="https://static.snyk.io/vscode/preview/${PLUGIN_FILENAME}"
readonly PLUGIN_ID="snyk-security.snyk-vulnerability-scanner-preview"

TEMP_DIR=""
PLUGIN_TEMP_PATH=""

log_info() {
    echo "[INFO] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

cleanup() {
    if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
        rm -rf "${TEMP_DIR}"
    fi
}

trap cleanup EXIT

create_temp_dir() {
    TEMP_DIR=$(mktemp -d)

    if [[ ! -d "${TEMP_DIR}" ]]; then
        log_error "Failed to create temporary directory"
        exit 1
    fi

    PLUGIN_TEMP_PATH="${TEMP_DIR}/${PLUGIN_FILENAME}"
}

editor_installed() {
    local editor="$1"

    if ! command -v "${editor}" >/dev/null 2>&1; then
        log_info "${editor} not installed, skipping"
        return 1
    fi

    log_info "${editor} installed"
    return 0
}

plugin_installed() {
    local editor="$1"
    local extensions_output

    if ! extensions_output=$("${editor}" --list-extensions 2>/dev/null); then
        log_error "Failed to list ${editor} extensions"
        exit 1
    fi

    if echo "${extensions_output}" | grep -q "^${PLUGIN_ID}$"; then
        log_info "Snyk plugin already installed in ${editor}, skipping"
        return 0
    fi

    log_info "Snyk plugin not yet installed in ${editor}"
    return 1
}

download_plugin() {
    if [[ -f "${PLUGIN_TEMP_PATH}" ]]; then
        log_info "Plugin file already exists ${PLUGIN_TEMP_PATH}"
        return
    fi

    log_info "Downloading plugin from ${DOWNLOAD_URL} into ${PLUGIN_TEMP_PATH}"

    if ! curl -L --fail --connect-timeout 10 --max-time 180 --retry 3 \
         --output "${PLUGIN_TEMP_PATH}" "${DOWNLOAD_URL}" 2>/dev/null; then
        log_error "Failed to download plugin from ${DOWNLOAD_URL}"
        exit 1
    fi

    # Check the file exists and has content
    if [[ ! -f "${PLUGIN_TEMP_PATH}" || ! -s "${PLUGIN_TEMP_PATH}" ]]; then
        log_error "Downloaded file is empty or does not exist"
        exit 1
    fi

    log_info "Plugin downloaded successfully"
}

install_plugin() {
    local editor="$1"

    log_info "Installing plugin from ${PLUGIN_TEMP_PATH}"

    if ! "${editor}" --install-extension="${PLUGIN_TEMP_PATH}" >/dev/null 2>&1; then
        log_error "Failed to install plugin in ${editor}"
        exit 1
    fi
}

main() {
    local editors=("windsurf")

    log_info "Starting Snyk plugin installation script"

    create_temp_dir

    for editor in "${editors[@]}"; do
        log_info "Processing ${editor}..."

        if ! editor_installed "${editor}"; then
            continue
        fi

        if plugin_installed "${editor}"; then
            continue
        fi

        download_plugin
        install_plugin "${editor}"

        log_info "${editor} installation completed"
    done

    log_info "Snyk plugin installation script completed successfully"
}

main "$@"
