export const deepCodeMessages = {
  configureBackend: {
    msg: `To use the cloud AI backend (https://www.deepcode.ai) select "Cloud". To configure an on-premise AI backend select "On-Premise".`,
    cloudBtn: "Cloud",
    onPremiseBtn: "On-Premise"
  },
  confirmUploadFilesToServer: {
    msg: (termsConditionsUrl: string, folderPath: string): string =>
      `Confirm remote analysis of ${folderPath} ([Terms & Conditions](${termsConditionsUrl}))`,
    button: "Confirm"
  },
  login: {
    msg: "Use your GitHub, Bitbucket or GitLab account to authenticate with DeepCode.",
    button: "Login"
  },
  unauthorized: {
    msg: "To use DeepCode extension you should login.",
    button: "Try login again"
  },
  error: {
    msg: "DeepCode encountered a problem.",
    button: "Restart"
  },
  payloadSizeError: {
    msg: "The current workspace is too big for DeepCode to process. You can manually exclude files and subdirectories by creating or editing the `.dcignore` file.",
    button: "Try again"
  },
  codeReviewFailed: {
    msg: (name: string): string =>
      `Whoops! DeepCode encountered a problem ${
        name ? `with "${name}" workspace` : ""
      }. This is an issue on our side and it will be looked into as soon as possible. You can manually retry the analysis by clicking "Retry" or we will retry after you edit and save a file.`,
    button: "Try again"
  },
  fileLoadingProgress: {
    msg: "DeepCode is loading files" // no "..." due to composite title
  },
  analysisProgress: {
    msg: "DeepCode analysis is running..."
  },
  configureAccountType: {
    msg: (termsConditionsUrl: string): string =>
      `The DeepCode extension works only with private DeepCode accounts at the moment. Please click on the "Configure" button to change your account type. [Terms & Conditions](${termsConditionsUrl})`,
    button: "Configure"
  }
};
