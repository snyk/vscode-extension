export const deepCodeMessages = {
  configureBackend: {
    msg: `Hey 👋, thanks for installing DeepCode 🚀. To use DeepCode with your Github, Bitbucket or Gitlab account select "Cloud". If you are using self-managed DeepCode server with Bitbucket or Gitlab select "Self-Managed".`,
    cloudBtn: "Cloud",
    selfManagedBtn: "Self-Managed"
  },
  login: {
    msg: "Cloud login selected 👍 🥰.\nPlease use your GitHub, Bitbucket or GitLab account to authenticate and start analysing the code with DeepCode.",
    button: "Login"
  },
  confirmUploadFilesToServer: {
    msg: (termsConditionsUrl: string, folderPath: string): string =>
      `You are almost set 🤗. Let's confirm the remote analysis of ${folderPath} ([DeepCode's Terms & Conditions](${termsConditionsUrl}))`,
    button: "Confirm and start analysing my code"
  },
  unauthorized: {
    msg: "Oh, it seems you are not logged in.",
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
  }
};
