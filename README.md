# Visual Studio Code extension

The Snyk Visual Studio Code plugin scans and provides analysis of your code including open source dependencies and infrastructure as code configurations. Download the plugin at any time free of charge and use it with any Snyk account. Scan your code early in the development lifecycle to help you pass security reviews and avoid costly fixes later in the development cycle.

Snyk scans for vulnerabilities and returns results with security issues categorized by issue type and severity.

For open source, you receive automated algorithm-based fix suggestions for both direct and transitive dependencies.

Results appear in context, in line with code in your IDE.

This single plugin provides a Java vulnerability scanner, a custom code vulnerability scanner, and an open-source security scanner.

In using the Visual Studio Code extension, you have the advantage of relying on the [Snyk Vulnerability Database](https://docs.snyk.io/introducing-snyk/getting-started-snyk-intel-vuln-db-access). You also have available the [Snyk Code AI Engine](https://docs.snyk.io/products/snyk-code/introducing-snyk-code/key-features/ai-engine).

Snyk scans for the following types of issues:

* [**Open Source Security**](https://snyk.io/product/open-source-security-management/) - security vulnerabilities and license issues in both direct and in-direct (transitive) open-source dependencies pulled into the Snyk Project. \
  See also the [Open Source docs](https://docs.snyk.io/products/snyk-open-source).
* [**Code Security and Code Quality**](https://snyk.io/product/snyk-code/) - security vulnerabilities and quality issues in your own code. See also the [Snyk Code](../../products/snyk-code/) docs.
* [**Infrastructure as Code (IaC) Security**](https://snyk.io/product/infrastructure-as-code-security/) - configuration issues in your IaC templates: Terraform, Kubernetes, CloudFormation, and Azure Resource Manager. See also the [IaC](https://docs.snyk.io/products/snyk-infrastructure-as-code) and [Snyk Cloud](https://docs.snyk.io/products/snyk-cloud) docs.

This page explains installation of the Visual Studio Code extension. **After you complete the steps on this page**, you will continue by following the instructions in the other Visual studio Code extension docs:

* [Visual Studio Code extension configuration](https://docs.snyk.io/ide-tools/visual-studio-code-extension-for-snyk-code/visual-studio-code-extension-configuration)
* [Visual Studio Code extension authentication](https://docs.snyk.io/ide-tools/visual-studio-code-extension-for-snyk-code/visual-studio-code-extension-authentication)&#x20;
* [Create a .dcignore file](https://docs.snyk.io/ide-tools/visual-studio-code-extension-for-snyk-code/create-a-.dcignore-file)
* [Run an analysis with Visual Studio Code extension](https://docs.snyk.io/ide-tools/visual-studio-code-extension-for-snyk-code/run-an-analysis-with-visual-studio-code-extension)
* [View analysis results from Visual Studio Code extension](https://docs.snyk.io/ide-tools/visual-studio-code-extension-for-snyk-code/view-analysis-results-from-visual-studio-code-extension)
* [Troubleshooting for Visual Studio Code extension ](https://docs.snyk.io/ide-tools/visual-studio-code-extension-for-snyk-code/troubleshooting-for-visual-studio-code-extension)

## Supported languages, package managers, and frameworks

Supported languages and frameworks include C#, JavaScript, TypeScript, Java, Go, Ruby, Python,  Ruby, PHP, Scala, Swift, Objective-C, Kubernetes, Terraform, CloudFormation, Azure Resource Manager (ARM)

* For Snyk Open Source, the VS Code extension supports all the languages and package managers supported by Snyk Open Source and the CLI. See the full [list in the docs](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support).
* For Snyk Code, the VS Code extension supports all the [languages and frameworks supported by Snyk Code](https://docs.snyk.io/products/snyk-code/snyk-code-language-and-framework-support#language-support-with-snyk-code-ai-engine).

## Install the extension

The Snyk Visual Studio Code extension is available for installation on the [Visual Studio code marketplace](https://marketplace.visualstudio.com/items?itemName=snyk-security.snyk-vulnerability-scanner).

Follow these steps to install:

* Open the settings or preferences in your IDE.
* Navigate to the [Snyk Extension on the Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=snyk-security.snyk-vulnerability-scanner) and click **Install**.\
  For more information see the [installation instructions](https://code.visualstudio.com/docs/editor/extension-marketplace#\_install-an-extension).
* Configure the Snyk CLI (downloaded when the extension in installed); see [Visual Studio Code extension configuration](https://docs.snyk.io/ide-tools/visual-studio-code-extension-for-snyk-code/visual-studio-code-extension-configuration).
* Authenticate with Snyk; see [Visual Studio Code extension authentication](https://docs.snyk.io/ide-tools/visual-studio-code-extension-for-snyk-code/visual-studio-code-extension-authentication).
* Navigate back to the IDE; the first scan starts automatically.

## Support&#x20;

If you need help, submit a [request](https://support.snyk.io/hc/en-us/requests/new) to Snyk Support.
