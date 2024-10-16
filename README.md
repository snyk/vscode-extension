# Visual Studio Code extension

## **Scan early, fix as you develop: elevate your security posture**

Integrating security checks early in your development lifecycle helps you pass security reviews seamlessly and avoid expensive fixes down the line.

The Snyk Visual Studio Code extension allows you to analyze your code, open-source dependencies, and Infrastructure as Code (IaC) configurations. With actionable insights directly in your IDE, you can address issues as they arise.

**Key features:**

* **In-line issue highlighting:** Security issues are flagged directly within your code, categorized by type and severity for quick identification and resolution.
* **Comprehensive scanning:** The extension scans for a wide range of security issues, including:
  * [**Open Source Security**](https://snyk.io/product/open-source-security-management/)**:** Detects vulnerabilities and license issues in both direct and transitive open-source dependencies. Automated fix suggestions simplify remediation. Explore more in the [Snyk Open Source documentation](https://docs.snyk.io/scan-using-snyk/snyk-open-source).
  * [**Code Security**](https://snyk.io/product/snyk-code/)**:** Identifies security vulnerabilities in your custom code. Explore more in the [Snyk Code documentation](https://docs.snyk.io/scan-using-snyk/snyk-code).
  * [**IaC Security**](https://snyk.io/product/infrastructure-as-code-security/)**:** Uncovers configuration issues in your Infrastructure as Code templates (Terraform, Kubernetes, CloudFormation, Azure Resource Manager). Explore more in the [IaC documentation](https://docs.snyk.io/scan-using-snyk/snyk-iac).
* **Broad language and framework support:** Snyk Open Source and Snyk Code cover a wide array of package managers, programming languages, and frameworks, with ongoing updates to support the latest technologies. For the most up-to-date information on supported languages, package managers, and frameworks, see the [supported language technologies pages](https://docs.snyk.io/supported-languages-package-managers-and-frameworks).

## How to install and set up the extension

You can use the Snyk Visual Studio Code extension in the following environments:

* Linux: AMD64 and ARM64
* Windows: 386, AMD64, and ARM64
* macOS: AMD64 and ARM64

Snyk Visual Studio Code extension does not support remote and containerized environments:

* [Cloud VS Code IDE](https://code.visualstudio.com/docs/editor/vscode-web)
* [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview)
* [Inside a Container](https://code.visualstudio.com/docs/devcontainers/containers)

Install the plugin at any time free of charge from the  [Visual Studio Code marketplace](https://marketplace.visualstudio.com/items?itemName=snyk-security.snyk-vulnerability-scanner) and use it with any Snyk account, including a Free account. For more information, see the[VS Code extension installation guide](https://code.visualstudio.com/docs/editor/extension-marketplace#\_install-an-extension).

When the extension is installed, it automatically downloads the [Snyk CLI,](https://docs.snyk.io/snyk-cli) which includes the [Language Server](https://docs.snyk.io/scm-ide-and-ci-cd-integrations/snyk-ide-plugins-and-extensions/snyk-language-server).

Continue by following the instructions in the other Visual Studio Code extension docs:

* [Visual Studio Code extension configuration](https://docs.snyk.io/scm-ide-and-ci-cd-integrations/snyk-ide-plugins-and-extensions/visual-studio-code-extension/visual-studio-code-extension-authentication)
* [Visual Studio Code extension authentication](https://docs.snyk.io/scm-ide-and-ci-cd-integrations/snyk-ide-plugins-and-extensions/visual-studio-code-extension/visual-studio-code-extension-authentication)
* [Visual Studio Code Workspace trust](https://docs.snyk.io/scm-ide-and-ci-cd-integrations/snyk-ide-plugins-and-extensions/visual-studio-code-extension/workspace-trust)
* [Run an analysis with Visual Studio Code extension](https://docs.snyk.io/integrate-with-snyk/use-snyk-in-your-ide/visual-studio-code-extension/run-an-analysis-with-visual-studio-code-extension)
* [View analysis results from Visual Studio Code extension](https://docs.snyk.io/integrate-with-snyk/use-snyk-in-your-ide/visual-studio-code-extension/view-analysis-results-from-visual-studio-code-extension)

## Support

For troubleshooting and known issues, see [Troubleshooting for Visual Studio Code extension](https://docs.snyk.io/scm-ide-and-ci-cd-integrations/snyk-ide-plugins-and-extensions/visual-studio-code-extension/troubleshooting-for-visual-studio-code-extension).

If you need help, submit a request to [Snyk Support](https://support.snyk.io/hc/en-us/requests/new).
