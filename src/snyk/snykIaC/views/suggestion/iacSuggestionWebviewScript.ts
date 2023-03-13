/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/// <reference lib="dom" />
// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  // TODO: Redefine types until bundling is introduced into extension
  // https://stackoverflow.com/a/56938089/1713082
  type Vulnerability = {
    id: string;
    license?: string;
    identifiers?: Identifiers;
    title: string;
    description: string;
    language: string;
    packageManager: string;
    packageName: string;
    severity: string;
    name: string;
    version: string;
    exploit?: string;

    CVSSv3?: string;
    cvssScore?: string;

    fixedIn?: Array<string>;
    from: Array<string>;
    upgradePath: Array<string>;
    isPatchable: boolean;
    isUpgradable: boolean;

    matchingIdVulnerabilities: Vulnerability[];
    overviewHtml: string;
  };

  type Lesson = {
    url: string;
    title: string;
  };

  type Identifiers = {
    CWE: string[];
    CVE: string[];
  };

  const vscode = acquireVsCodeApi();
  let vulnerability = {} as Vulnerability;

  let lesson: Lesson | null;

  function navigateToUrl(url: string) {
    vscode.postMessage({
      type: 'openBrowser',
      value: url,
    });
  }

  function fillLearnLink() {
    const learnWrapper = document.querySelector('.learn')!;
    learnWrapper.className = 'learn';

    if (lesson) {
      const learnLink = document.querySelector<HTMLAnchorElement>('.learn--link')!;
      learnLink.innerText = lesson.title;
      const lessonUrl = lesson.url;
      learnLink.onclick = () => navigateToUrl(lessonUrl);
      learnWrapper.className = 'learn show';
    }
  }

  function showCurrentSuggestion() {
    const severity = document.querySelector('.severity')!;
    const title = document.querySelector('.suggestion .suggestion-text')!;

    // Set title
    title.innerHTML = vulnerability.title;

    // Set severity icon
    setSeverityIcon();

    // Fill identifiers line
    fillIdentifiers();

    // Fill summary
    fillSummary();

    // Fill detailed paths
    fillDetailedPaths();

    // Fill overview
    fillOverview();

    function setSeverityIcon() {
      if (vulnerability.severity) {
        severity.querySelectorAll('img').forEach(n => {
          if (n.id.slice(-1) === 'l') {
            if (n.id.includes(vulnerability.severity)) n.className = 'icon light-only';
            else n.className = 'icon light-only hidden';
          } else {
            if (n.id.includes(vulnerability.severity)) n.className = 'icon dark-only';
            else n.className = 'icon dark-only hidden';
          }
        });
      } else {
        severity.querySelectorAll('img').forEach(n => (n.className = 'icon hidden'));
      }
    }

    function fillIdentifiers() {
      const identifiers = document.querySelector('.identifiers')!;
      identifiers.innerHTML = ''; // reset node
      const type = vulnerability.license ? 'License' : 'Vulnerability';
      const typeNode = document.createTextNode(type);
      identifiers.appendChild(typeNode);

      vulnerability.identifiers?.CVE.forEach(cve =>
        appendIdentifierSpan(identifiers, cve, `https://cve.mitre.org/cgi-bin/cvename.cgi?name=${cve}`),
      );
      vulnerability.identifiers?.CWE.forEach(cwe => appendIdentifierSpan(identifiers, cwe, getCweLink(cwe)));
      if (vulnerability.cvssScore) appendIdentifierSpan(identifiers, `CVSS ${vulnerability.cvssScore}`);
      appendIdentifierSpan(identifiers, vulnerability.id.toUpperCase(), `https://snyk.io/vuln/${vulnerability.id}`);
    }

    function fillSummary() {
      const module = document.querySelector('.module > .content')!;
      module.textContent = vulnerability.name;

      const maturity = document.querySelector('.maturity > .content')!;
      if (!vulnerability.exploit) {
        maturity.classList.add('hidden');
      } else {
        maturity.textContent = vulnerability.exploit;
      }

      const introducedThrough = document.querySelector('.introduced-through > .content')!;
      introducedThrough.innerHTML = ''; // reset node
      if (vulnerability.from.length == 0) {
        introducedThrough.classList.add('hidden');
      } else {
        let modules = vulnerability.matchingIdVulnerabilities
          .filter(vuln => vuln.from.length > 1)
          .map(vuln => vuln.from[1]);
        modules = [...new Set(modules)]; // obtain distinct only

        modules.forEach((module, i, arr) => {
          appendIntroducedThroughSpan(introducedThrough, module, vulnerability.packageManager);
          if (i != arr.length - 1) introducedThrough.append(document.createTextNode(', '));
        });
      }

      const fixedIn = document.querySelector('.fixed-in > .content')!;
      fixedIn.innerHTML = ''; // reset node
      if (!vulnerability.fixedIn || vulnerability.fixedIn.length == 0) {
        fixedIn.append('Not fixed');
      } else {
        fixedIn.append(vulnerability.name + '@');
        vulnerability.fixedIn.forEach((version, i, arr) => {
          let versionStr = version;
          if (i != arr.length - 1) versionStr = versionStr + ', ';
          fixedIn.append(versionStr);
        });
      }
    }

    function fillDetailedPaths() {
      const paths = document.querySelector('.detailed-paths')!;
      paths.innerHTML = ''; // reset node

      vulnerability.matchingIdVulnerabilities.forEach(vuln => {
        const introducedThrough = vuln.from.join(' > ');

        const isOutdated = vuln.upgradePath && vuln.upgradePath[1] === vuln.from[1];

        // The logic as in registry
        // https://github.com/snyk/registry/blob/5fe141a3c5eeb6b2c5e62cfa2b5a8643df29403d/frontend/src/components/IssueCardVulnerablePath/IssueCardVulnerablePath.vue#L109
        let remediationAdvice: string;
        const upgradeMessage = `Upgrade to ${vuln.upgradePath[1]}`;

        if (vuln.isUpgradable || vuln.isPatchable) {
          if (isOutdated) {
            remediationAdvice = vuln.isPatchable ? upgradeMessage : getOutdatedDependencyMessage(vuln);
          } else {
            remediationAdvice = upgradeMessage;
          }
        } else {
          remediationAdvice = 'none';
        }

        const html = `
        <div class="path">
          <div class="label">Introduced through: <span class="font-light">${introducedThrough}</span></div>
          <div class="label">Remediation: <span class="font-light">${remediationAdvice}</span></div>
        </div>`;

        const path = document.createElement('div');
        path.innerHTML = html;
        paths.append(path);
      });
    }

    function fillOverview() {
      const overview = document.getElementById('overview')!;
      overview.innerHTML = vulnerability.overviewHtml;
    }
  }

  function getCweLink(cwe: string) {
    const id = cwe.toUpperCase().replace('CWE-', '');
    return `https://cwe.mitre.org/data/definitions/${id}.html`;
  }

  function appendIdentifierSpan(identifiers: Element, id: string, link?: string) {
    const delimiter = document.createElement('span');
    delimiter.innerText = ' | ';
    delimiter.className = 'delimiter';
    identifiers.appendChild(delimiter);

    let cveNode: HTMLElement;
    if (link) {
      cveNode = document.createElement('a');
      cveNode.onclick = () => navigateToUrl(link);
    } else {
      cveNode = document.createElement('span');
    }

    cveNode.innerText = id;

    identifiers.appendChild(cveNode);
  }

  function appendIntroducedThroughSpan(introducedThrough: Element, module: string, packageManager: string) {
    const supportedPackageManagers = ['npm'];

    let node: HTMLElement;
    // replicate app.snyk.io linking logic from https://github.com/snyk/registry/blob/c78f0ae84dc20f25146880b3d3d5661f3d3e4db2/frontend/src/lib/issue-utils.ts#L547
    if (supportedPackageManagers.includes(packageManager.toLowerCase())) {
      node = document.createElement('a');
      node.onclick = () => navigateToUrl(`https://app.snyk.io/test/${packageManager}/${module}`);
    } else {
      node = document.createElement('span');
    }

    node.innerText = module;
    introducedThrough.appendChild(node);
  }

  function getOutdatedDependencyMessage(vulnerability: Vulnerability) {
    return `Your dependencies are out of date, otherwise you would be using a newer ${vulnerability.name} than ${
      vulnerability.name
    }@${vulnerability.version}.
    ${
      ['npm', 'yarn', 'yarn-workspace'].includes(vulnerability.packageManager)
        ? `Try relocking your lockfile or deleting <code>node_modules</code> and reinstalling your dependencies. If the problem persists, one of your dependencies may be bundling outdated modules.`
        : 'Try reinstalling your dependencies. If the problem persists, one of your dependencies may be bundling outdated modules.'
    }`;
  }

  window.addEventListener('message', event => {
    const { type, args } = event.data;
    switch (type) {
      case 'set': {
        vulnerability = args;
        vscode.setState({ ...vscode.getState(), vulnerability });
        showCurrentSuggestion();
        break;
      }
      case 'get': {
        vulnerability = vscode.getState()?.vulnerability || {};
        showCurrentSuggestion();
        break;
      }
      case 'setLesson': {
        lesson = args;
        vscode.setState({ ...vscode.getState(), lesson });
        fillLearnLink();
        break;
      }
      case 'getLesson': {
        lesson = vscode.getState()?.lesson || null;
        fillLearnLink();
        break;
      }
    }
  });
})();
