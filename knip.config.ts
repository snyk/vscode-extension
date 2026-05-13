import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/extension.ts', 'src/test/**/*.ts'],
  project: ['src/**/*.ts'],
  ignore: [
    'out/**',
    '.claude/**',
    'scripts/**',
    // Webview scripts compiled to JS and loaded at runtime via vscode.Uri/readFileSync, not TS imports.
    'src/snyk/common/views/summaryWebviewScript.ts',
    'src/snyk/common/views/treeViewWebviewScript.ts',
    'src/snyk/snykCode/views/suggestion/codeSuggestionWebviewScriptLS.ts',
    'src/snyk/snykCode/views/suggestion/ideFuncs/ideApplyAiFix.ts',
    'src/snyk/snykCode/views/suggestion/ideFuncs/ideGenerateAiFix.ts',
    'src/snyk/snykCode/views/suggestion/ideFuncs/ideSubmitIgnoreRequest.ts',
    // Imported as namespace (`import * as dcIgnoreConstant`) — individual members appear unused to knip.
    'src/snyk/snykCode/constants/dcignore.ts',
    // DiagnosticSeverity mirrors vscode's numeric enum; members not referenced by name but part of public API.
    'src/snyk/common/vscode/types.ts',
    // Webview message types used across the JS/TS boundary — knip cannot trace webview-side usage.
    'src/snyk/snykCode/views/suggestion/types.ts',
    // Webview config message types — used via webview JS message protocol.
    'src/snyk/common/views/workspaceConfiguration/types/workspaceConfiguration.types.ts',
    // Structural types used via structural typing — RepositoryState/Branch referenced via repo.state.HEAD.
    'src/snyk/common/git.ts',
    // WorkspaceFolderResultSuccess/Failure used in union type on same line — knip false positive.
    'src/snyk/common/services/productService.ts',
    // LS scan result types — Summary used structurally.
    'src/snyk/common/languageServer/types.ts',
  ],
  ignoreDependencies: ['@types/*', 'yalc'],
  ignoreBinaries: ['ovsx'],
  exclude: ['enumMembers'],
};

export default config;
