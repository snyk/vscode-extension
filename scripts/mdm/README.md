# MDM Scripts

These are stand alone bash scripts intended to be ran by [MDM software](https://en.wikipedia.org/wiki/Mobile_device_management). They don't require user input, and will log/exit accordingly. They're idempotent and can be ran as frequently as needed.

## Scripts

- **install-snyk-plugin.sh**: Downloads and installs the Snyk preview extension into the Windsurf editor if not already installed.
- **enforce-snyk-secure-at-inception.sh**: Ensures the "Secure at Inception" setting is enabled for the Snyk plugin.

## Tests

Tests will stub out external commands and use temporary files to exercise happy and important sad paths.

1. `brew install bats-core`
2. `cd scripts/mdm`
3. `bats .`
