## Release version steps


**Protocol Version Verification**

-   Ensure the Snyk Language Server Protocol version is correct in the plugin. 
`ProtocolVersion`  in  `LsConstants`  


**Initiate Release**

-   Press the release button to start the release process.


**Release Notes**

-   Edit or generate release notes on GitHub.
Its okay to include all items from any intermediate hotfix releases in the release notes.


**Marketplace Availability**

-   Check that the new release appears on all relevant Marketplaces.


**Installation and Version Verification**

-   Install the plugin or extension in the target IDE.    
-   Confirm that the installed version matches the intended release.


**CLI Configuration and Verification**

-   Ensure the Snyk CLI release channel is set to  `stable`  and automatic update is enabled. 

- The correct version can be found in the  `#hammerhead-releases`  channel in Slack.

-   Execute the CLI binary in the terminal and verify that the version matches the intended release.


**Manual End-to-End Test**

-   Manually run a scan using the latest version of the plugin to confirm end-to-end functionality.
