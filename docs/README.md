# Documentation

This directory contains comprehensive documentation for the Snyk VSCode Extension.

## Files

- **README.md** - This file, explaining the documentation structure
- **snyk-cli-download-logic.md** - Complete documentation of the Snyk CLI download logic
- **snyk-cli-download-diagram.mmd** - Standalone Mermaid diagram file

## Snyk CLI Download Logic

The main documentation file `snyk-cli-download-logic.md` provides:

- **Download Flow**: Step-by-step explanation of the CLI download process
- **Server Requirements**: Required file structure and endpoints on the download server
- **Supported Platforms**: All supported operating systems and architectures
- **Local Installation**: Where files are installed on different platforms
- **Implementation Details**: Key classes and error handling
- **Security Considerations**: Integrity verification and proxy support

## Server Requirements

The download server must provide:
- Base URL: `https://downloads.snyk.io` (configurable)
- Release channels: `stable`, `rc`, `preview`
- Version-specific directories with binaries and checksums
- Platform-specific file naming conventions
- SHA256 checksums for all binaries
