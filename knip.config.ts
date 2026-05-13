import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/extension.ts', 'src/test/**/*.ts'],
  project: ['src/**/*.ts'],
  ignore: [
    'out/**',
    '.claude/**',
    'scripts/**',
    // Webview scripts: compiled to JS and loaded at runtime via vscode.Uri / readFileSync,
    // not imported by TypeScript, so knip cannot trace them from the entry points.
    'src/snyk/common/views/summaryWebviewScript.ts',
    'src/snyk/common/views/treeViewWebviewScript.ts',
    'src/snyk/snykCode/views/suggestion/codeSuggestionWebviewScriptLS.ts',
    'src/snyk/snykCode/views/suggestion/ideFuncs/ideApplyAiFix.ts',
    'src/snyk/snykCode/views/suggestion/ideFuncs/ideGenerateAiFix.ts',
    'src/snyk/snykCode/views/suggestion/ideFuncs/ideSubmitIgnoreRequest.ts',
  ],
  ignoreDependencies: ['@types/*'],
  ignoreBinaries: ['ovsx'], // used in CI release workflows, installed separately
  ignoreExports: [
    // DiagnosticSeverity enum members mirror vscode's own numeric enum; the enum is used as a
    // type parameter to createDiagnostic but callers pass vscode values directly (no member access).
    'src/snyk/common/vscode/types.ts',
  ],
  // DiagnosticSeverity mirrors vscode's numeric enum; its members may not be referenced by name but
  // the enum is part of the IVSCodeLanguages public API contract. Suppress enumMember findings.
  exclude: ['enumMembers'],
};

export default config;
