## Release version steps

**Protocol Version Verification**

- Ensure the Snyk Language Server Protocol version is correct in the plugin. 
  - `PROTOCOL_VERSION`  in  `src/snyk/common/constants/languageServer.ts`  

**Initiate Release**

- If you want to do a hotfix with a subset of commits from main, create a hotfix branch off the previous release tag.
  - For the hotfix release, cherry pick the commits you want to go into the hotfix release.

- Trigger the release workflow in GitHub Actions.
  - If this is a hotfix not off main, select the hotfix branch.

**Marketplace Availability**

- Check that the new release appears on all relevant Marketplaces.

**Installation and Version Verification**

- Install the plugin or extension in the target IDE.    
- Confirm that the installed version matches the intended release.

**CLI Configuration and Verification**

- Ensure the Snyk CLI release channel is set to  `stable`  and automatic update is enabled. 

- Execute the CLI binary in the terminal and verify that the version matches the intended release.
  - The correct version can be found in the  `#hammerhead-releases`  channel in Slack or in the github cli repo.
     https://github.com/snyk/cli/releases


**Manual End-to-End Test**

- Manually run a scan using the latest version of the plugin to confirm end-to-end functionality.
