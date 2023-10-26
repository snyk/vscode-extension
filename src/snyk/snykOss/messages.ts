import { ModuleVulnerabilityCount } from './services/vulnerabilityCount/importedModule';

export const messages = {
  vulnerabilityCount: {
    fetchingVulnerabilities: 'Fetching vulnerabilities...',
    vulnerability: 'vulnerability',
    vulnerabilities: 'vulnerabilities',
    showMostSevereVulnerability: 'Show the most severe vulnerability (Snyk)',
    decoratorMessage: (vulnerabilityCount: string): string => {
      const vulnerabilityCountNumber = Number.parseInt(vulnerabilityCount, 10);
      if (isNaN(vulnerabilityCountNumber)) {
        return vulnerabilityCount;
      }
      return `${vulnerabilityCountNumber} ${vulnerabilityCountNumber > 1 ? 'vulnerabilities' : 'vulnerability'}`;
    },
    diagnosticMessagePrefix: (module: ModuleVulnerabilityCount): string => {
      return `Dependency ${module.name}${module.version ? `@${module.version}` : ''} has `;
    },
  },
  treeView: {
    cookingDependencies: 'Scanning...',
    runTest: 'Run scan for Open Source security vulnerabilities.',
    noVulnerabilitiesFound: ' ✅ Congrats! Snyk found no vulnerabilities.',
    singleVulnerabilityFound: 'Snyk found 1 vulnerability',
    vulnerability: 'vulnerability',
    vulnerabilities: 'vulnerabilities',
    multipleVulnerabilitiesFound: (issueCount: number): string => `Snyk found ${issueCount} vulnerabilities`,
  },
  test: {
    testFailed: 'Open Source Security test failed.',
    testStarted: 'Open Source Security test started.',
    viewResults: 'View results',
    hide: "Don't show again",
    testFailedForPath: (path: string): string => `Open Source Security test failed for "${path}".`,
    testFinished: (projectName: string): string => `Open Source Security test finished for "${projectName}".`,
  },
  errors: {
    suggestionViewShowFailed: 'Failed to show Snyk OSS suggestion view',
  },
};
