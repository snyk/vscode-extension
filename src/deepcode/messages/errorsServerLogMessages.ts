export const errorsLogs = {
  login: "Login of new user has failed",
  // loginStatus: "Check login status of user has failed",
  filtersFiles: "Failed fetching filters files for bundles from server",
  // createBundle: "Failed to create bundle on server",
  // uploadFiles: "Failed to upload missing files in bundle to server",
  // checkBundle: "Failed to check bundle status on server",
  // checkBundleAfterAttempts: (attempts: number) =>
  //   `Failed fetching bundle status on server after ${attempts} attempts`,
  // extendBundle: "Failed to extend bundle on server with files",
  // failedStatusOfAnalysis: "Analysis results have status FAILED",
  // analyze: "Analysis request failed",
  failedAnalysis: "Failed executing analysis",
  failedServiceAI: "ServiceAI returned an error",
  failedExecution: "Failed extension pipeline execution",
  failedExecutionDebounce: "Failed extension pipeline execution after debounce",
  failedExecutionTransient: "Failed extension pipeline execution after transient error",
  undefinedError: "Unrecognized error",
  watchFileBeforeExtendBundle:
    "Failed on watching file changes before extending bundle",
  updateReviewPositions:
    "Failed to update review results positions while editing file",
  errorReportFail: "Failed to send error report",
  modifiedFile: (type: string) => `Failed to handle file change of type ${type}`,
  // vscodeFileChanges: "Failed to process vscode file content changes",
  command: (type: string) => `Failed to execute ${type} command`,
};
