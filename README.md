# Visual Studio Code extension


The Snyk Visual Studio Code extension is available for installation on the marketplace: [https://marketplace.visualstudio.com/items?itemName=snyk-security.snyk-vulnerability-scanner](https://marketplace.visualstudio.com/items?itemName=snyk-security.snyk-vulnerability-scanner)

The Visual Studio Code extension requires the Snyk CLI; see [Install the Snyk CLI](../snyk-cli/install-the-snyk-cli/).


## Supported languages, package managers, and frameworks

* For Snyk Open Source, the VS Code extension supports all the languages and package managers supported by Snyk Open Source and the CLI. See the full [list](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support).
* For Snyk Code, the VS Code extension supports all the [languages and frameworks supported by Snyk Code](https://docs.snyk.io/products/snyk-code/snyk-code-language-and-framework-support#language-support-with-snyk-code-ai-engine).

## Install the extension

You can find the Snyk Extension in the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=snyk-security.snyk-vulnerability-scanner). To install, do one of the following:

* Navigate to the [Snyk Extension on the Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=snyk-security.snyk-vulnerability-scanner) and follow the instructions for the Snyk extension. The docs from VS Code help you trigger the installation process from Visual Studio Code and guide you through the installation steps.
* Browse for the extension as advised [Visual Studio code site](https://code.visualstudio.com/docs/editor/extension-gallery#\_browse-for-extensions) and search for Snyk, then install (as explained in the [installation instructions](https://code.visualstudio.com/docs/editor/extension-gallery#\_install-an-extension).

When the extension is installed you can find a Snyk icon in the sidebar ![](<https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/Screen Shot 2021-12-03 at 8.02.07 AM.png>).

The Snyk extension provides all the suggestions in a concise and clean view containing the information you need to decide how to fix or act on.

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (76) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (10).png" alt="Visual Studio Code extension results" />

## Configuration

### Environment

To analyze projects, the plugin uses the Snyk CLI which requires environment variables:

* `PATH`: the path to needed binaries, for example, to maven
* `JAVA_HOME`: the path to the JDK you want to use to analyze Java dependencies

Setting these variables only in a shell environment (for example,using `~/.bashrc`) is not sufficient, if you do not start the IDE from the command line or create a script file that starts the IDE using a shell environment.

* On `Windows`, you can set the variables, using the GUI or on the command line using the `setx` tool.
* On `macOS`, the process `launchd` must know the environment variables to launch the IDE from Finder directly. You can set environment variables for applications launched using Finder by using the `launchctl setenv` command, for example, on start-up or through a script you launch at user login.\
  **Note:** The provision of environment variables to the macOS UI can change between operating system releases, so it may be easier to create a small shell script that launches the IDE to leverage the shell environment that can be defined via `~/.bashrc`.
* On `Linux`, updating the file /etc/environment can propagate the environment variables to the windows manager and UI.

### Proxy

If you are behind a proxy, proxy settings are configured either using VS Code proxy settings or set using `http_proxy` and `https_proxy` environment variables.

## Authentication

The extension uses your Snyk API token for authentication. To store the token securely, we utilize [Secret Storage API](https://code.visualstudio.com/api/references/vscode-api#SecretStorage), which uses the system's keychain to manage the token.

### Logging in

To authenticate follow these steps:

1.  Once the extension is installed, click on the Snyk Icon in the left navigation bar:

    <img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (62) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (6).png" alt="" data-size="original">
2.  Click **Connect VS Code with Snyk**. The extension relies on the Snyk authentication API and asks you to authenticate your machine against the Snyk web application:

    <img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (71) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt="" data-size="original">
3. Click **Authenticate**.
4.  After successful authentication, view the confirmation message.

    <img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (85) (1) (1) (1).png" alt="" data-size="original">
5. Close the browser window and return to VS Code. VS Code is now reading and saving the authentication on your local machine.

### Switching accounts

To re-authenticate with a different account, follow the steps below:

1. Run the provided `Snyk: Log Out` command.
2. Once logged out, click **Connect VS Code with Snyk** to authenticate with the different account.

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/logging-out-command (1).png" alt="Snyk: Log Out" />

Or you run `Snyk: Set Token` command and set your token in the text field manually.

![](<https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (80) (1).png>)

\\

## Run analysis

In the IDE note that the extension is already picking up the files and uploading them for analysis.

Snyk Open Source requires the Snyk CLI, so it downloads in the background.

Snyk Code analysis runs quickly without the CLI, so results may already be available. Otherwise, you see the following screen while Snyk scans your workspace for vulnerabilities:

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (80) (1) (1) (1) (1).png" alt="Snyk Code scan" />

Snyk analysis runs automatically when you open a folder or workspace.

* Snyk Code performs scans automatically on file saves.
* Snyk Open Source does not automatically run on save by default, but you can enable it in settings:

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (73) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt="Snyk Open Source settings" />

**Tip**: if you do not like to manually save while working, enable [AutoSave](https://code.visualstudio.com/docs/editor/codebasics#\_save-auto-save).

## Rescan

To manually trigger a scan, either Save or manually rescan using the rescan icon:

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (61) (1) (1) (1).png" alt="Rescan icon" />

If you only need the Code Quality, Code Security, or Open Source Security portion of the findings, you can easily disable the feature with the results you do not want to see or collapse the view:

![Configure Features](https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/configure-features.png)

## Snyk Code advanced mode

Snyk Code has "Advanced" mode that allows you to control how scan is performed.

To manually perform the analysis, in the configuration of the extension you can enable Advanced Mode which enables you to control the scanning process:

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/run-analysis\_advanced-mode (1).png" alt="Advanced Mode" />

## View analysis results

Snyk analysis shows a list of security vulnerabilities and code issues found in the application code. For more details and examples of how others fixed the issue, select a security vulnerability or a code security issue. Snyk suggestion information for the issue selected appears in a panel on the right side:

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (76) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (2).png" alt="Snyk suggestion information" />

### Snyk analysis panel

The Snyk analysis panel on the left of the preceding code screen shows how much time the analysis took plus a list of issues with the suggestions found for them.

The icons have the following meaning:

| ![](<https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (75) (1) (1) (1).png>) Critical severity                                                                                                   | May allow attackers to access sensitive data and run code on your application.                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ![](<https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (64) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png>) High severity       | May allow attackers to access sensitive data on your application.                                                                            |
| ![](<https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (63) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (6).png>) Medium severity | May allow attackers under some conditions to access sensitive data on your application.                                                      |
| ![](<https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (114).png>) Low severity                                                                                                                   | The application may expose some data allowing vulnerability mapping, which can be used with other vulnerabilities to attack the application. |

You can filter the issues by setting the severities you want to see using the `snyk.severity` setting. For example, set `"snyk.severity": { "critical": true, "high": true, "medium": true, "low": false }` to hide low severity issues. You can also apply the setting in the Settings UI.

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (65) (1) (1) (1) (1) (1) (1) (1).png" alt="Severity settings" />

### Snyk Code editor window

The editor window in the middle of the results screen shows the code that is inspected. This ensures that when you are inspecting a Snyk issue, you always have the code context close to the issue.

### Snyk Code vulnerability window

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/image (76) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt="Snyk Suggestion panel" />

The Snyk Suggestion panel on the right of the results screen shows the recommendation of the Snyk engine using, for example, variable names of your code and the line numbers in red. You can also see the following:

* Links to external resources to explain the bug pattern in more detail (the **More info** link).
* Tags that were assigned by Snyk, such as **Security** (the issue found is a security issue), **Database** (the issue is related to database interaction), or **In Test** (the issue is within the test code).
* Code from open source repositories that might be of help to see how others fixed the issue.
* Two buttons on the lower end of the panel which you can use to add ignore comments that would make Snyk ignore this particular suggestion, or all of these suggestions for the whole file. .

Snyk also includes a feedback mechanism to report false positives so others do not see the same issue.

### Snyk Open Source editor window

The editor window shows security vulnerabilities in open source modules while you code in JavaScript, TypeScript, and HTML. Receive feedback in-line with your code, such as how manyvulnerabilities a module contains that you are importing. The editor exposes only top-level dependency vulnerabilities; for the full list of vulnerabilities refer to the side panel.

You can find security vulnerabilities in the npm packages you import and see the number of known vulnerabilities in your imported npm packages as soon as you require them:

![Vulnerabilities in npm package](https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/oss-editor-vulnerability-count.png)

Code inline vulnerability counts are also shown in your `package.json` file:

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/oss-editor-pjson (1).png" alt="package.json file" />

Find security vulnerabilities in your JavaScript packages from well-known CDNs. The extension scans any HTML files in your projects and displays vulnerability information about the modules you include from your favorite CDN.

* Currently supported CDNs are:
  * unpkg.com
  * ajax.googleapis.com
  * cdn.jsdelivr.net
  * cdnjs.cloudflare.com
  * code.jquery.com
  * maxcdn.bootstrapcdn.com
  * yastatic.net
  * ajax.aspnetcdn.com

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/oss-editor-html (1).png" alt="Vulnerability from a CDN" />

You can navigate to the most severe vulnerability by triggering the provided code actions. This opens a vulnerability window to show more details:

<img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/oss-editor-show-vulnerability (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (2).png" alt="Code action" />

### Snyk Open Source vulnerability window

The Open Source Security (OSS) vulnerability window shows information about the vulnerable module.

* Links to external resources (CVE, CWE, Snyk Vulnerability DB) to explain the vulnerability in more detail.
* Displays CVSS score and exploit maturity.
* Provides detailed path on how vulnerability is introduced to the system.
* Shows summary of the vulnerability together with the remediation advice to fix it.

## Extension configuration

After the extension is installed, you can set the following configurations for the extension:

* **Features**
  * **Code Security**: configure if code security analysis should run over your code.
  * **Code Quality**: configure if code quality analysis should run over your code.
  * **Open Source Security**: configure if security analysis should run over your open source dependencies.
* **Severity**: set severity level to display in the analysis result tree.
* **Advanced**
  * **Advanced mode**: toggle a panel to allow the user to manually control when the analysis should be run.
  * **Auto Scan Open Source Security**: set severity level to display in the analysis result tree.
  * **Additional Parameters**: set parameters to be passed to Snyk CLI for Open Source Security tests. For the full list you can consult [this reference](https://docs.snyk.io/features/snyk-cli/guides-for-our-cli/cli-reference).
  * **Organization**: specifies an organization slug name to run tests for that organization.
  * **Custom endpoint**: Specify the custom Snyk API endpoint for your organization. Use this field for the custom endpoint for Single Tenant setups as well instead of https://app.snyk.io.

#### **Organization setting**

The value of organization setting `snyk.advanced.organization` must match the URL slug as displayed in the URL of your org in the Snyk UI: `https://app.snyk.io/org/[orgslugname]`.

If not specified, the preferred organization as defined in your [web account settings](https://app.snyk.io/account) is used to run tests.

## Create a .dcignore file

To ignore certain files and directories (for example, **node\_modules**), create a **.dcignore** file. You can create it in any directory on any level starting from the directory where your project resides. The file syntax is identical to .`gitignore`.

* Snyk recommends adding the file when there is no `.gitignore` file. Adding the file significantly reduces the files that need to be uploaded and speed up the analysis.
* To quickly add the default **`.dcignore`** file, use the command provided by VS Code and the Snyk extension **Snyk create `.dcignore` file** and save the newly created `.dcignore` file.

## Support and contact information


Need more help? [Submit a request to Snyk support](https://support.snyk.io/hc/en-us/requests/new).


**Share your experience.**

Snyk continuously strives to improve the Snyk plugins experience. Would you like to share your feedback about the Snyk Visual Studio Code extension? [Schedule a meeting](https://calendly.com/snyk-georgi/45min?month=2022-01).
