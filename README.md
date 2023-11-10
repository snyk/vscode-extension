# Visual Studio Code extension

The Snyk Visual Studio Code plugin scans and provides analysis of your code, including open-source dependencies and infrastructure as code configurations. Download the plugin at any time free of charge and use it with any Snyk account. Scan your code early in the development lifecycle to help you pass security reviews and avoid costly fixes later in the development cycle.

Snyk scans for vulnerabilities and returns results with security issues categorized by issue type and severity.

For open source, you receive automated algorithm-based fix suggestions for both direct and transitive dependencies.

Results appear in context, in line with the code in your IDE.

This single plugin provides a Java vulnerability scanner, a custom code vulnerability scanner, and an open-source security scanner.

In using the Visual Studio Code extension, you have the advantage of relying on the [Snyk Vulnerability Database](https://security.snyk.io/). You also have available the [Snyk Code AI Engine](https://docs.snyk.io/products/snyk-code/introducing-snyk-code/key-features/ai-engine).

Snyk scans for the following types of issues:

* [**Open Source Security**](https://snyk.io/product/open-source-security-management/) - security vulnerabilities and license issues in both direct and indirect (transitive) open-source dependencies pulled into the Snyk Project.\
  See also the [Open Source docs](https://docs.snyk.io/scan-applications/snyk-open-source).
* [**Code Security** ](https://snyk.io/product/snyk-code/)- security vulnerabilities in your own code. See also the [Snyk Code](https://docs.snyk.io/scan-applications/snyk-code) docs.
* [**Infrastructure as Code (IaC) Security**](https://snyk.io/product/infrastructure-as-code-security/) - configuration issues in your IaC templates: Terraform, Kubernetes, CloudFormation, and Azure Resource Manager. See also the [IaC](https://docs.snyk.io/scan-infrastructure) docs.

This page explains the installation of the Visual Studio Code extension. **After you complete the steps on this page**, continue by following the instructions in the other Visual Studio Code extension docs:

* [Visual Studio extension configuration](https://docs.snyk.io/integrations/ide-tools/visual-studio-extension/visual-studio-extension-configuration)
* [Visual Studio extension authentication](https://docs.snyk.io/ide-tools/visual-studio-extension/visual-studio-extension-authentication)
* [Run an analysis with Visual Studio extension](https://docs.snyk.io/ide-tools/visual-studio-extension/run-an-analysis-with-visual-studio-extension)
* [View analysis results from Visual Studio extension](https://docs.snyk.io/ide-tools/visual-studio-extension/view-analysis-results-from-visual-studio-extension)
* [Troubleshooting and known issues with Visual Studio extension](https://docs.snyk.io/ide-tools/visual-studio-extension/troubleshooting-and-known-issues-with-visual-studio-extension)

## Supported languages, package managers, and frameworks

Supported languages and frameworks include C#, JavaScript, TypeScript, Java, Go, Ruby, Python, Ruby, PHP, Scala, Swift, Objective-C, Kubernetes, Terraform, CloudFormation, Azure Resource Manager (ARM)

* For Snyk Open Source, the VS Code extension supports all the languages and package managers supported by Snyk Open Source and the CLI.
* For Snyk Code, the VS Code extension supports all the languages and frameworks supported by Snyk Code.

See [Supported languages and frameworks](https://docs.snyk.io/scan-applications/supported-languages-and-frameworks) for more details.

## Supported operating systems and architecture

You can use the Snyk Visual Studio Code extension in the following environments:

* Linux: AMD64 and ARM64
* Windows: 386 and AMD64
* MacOS: AMD64 and ARM64

## Install the extension

The Snyk Visual Studio Code extension is available for installation on the [Visual Studio code marketplace](https://marketplace.visualstudio.com/items?itemName=snyk-security.snyk-vulnerability-scanner).

Follow these steps to install:

* Open the settings or preferences in your IDE.
* Navigate to the [Snyk Extension on the Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=snyk-security.snyk-vulnerability-scanner) and click **Install**.\
  For more information, see the [installation instructions](https://code.visualstudio.com/docs/editor/extension-marketplace#\_install-an-extension).
* Configure the Snyk CLI (downloaded when the extension in installed); see [Visual Studio extension configuration](https://docs.snyk.io/integrations/ide-tools/visual-studio-extension/visual-studio-extension-configuration).
* Authenticate with Snyk; see [Visual Studio extension authentication](https://docs.snyk.io/ide-tools/visual-studio-extension/visual-studio-extension-authentication). For additional information, including how to authenticate using your API token, see [Authenticate the CLI with your account](https://docs.snyk.io/snyk-cli/authenticate-the-cli-with-your-account).
* Navigate back to the IDE; the first scan starts automatically.

## Support

If you need help, submit a request to [Snyk Support](https://support.snyk.io/hc/en-us/requests/new).
