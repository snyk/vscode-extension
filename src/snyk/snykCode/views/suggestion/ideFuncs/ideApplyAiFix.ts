const applyFixMessage: ApplyGitDiffMessage = {
  type: 'applyGitDiff',
  //@ts-expect-error
  args: { filePath, patch, fixId },
};

vscode.postMessage(applyFixMessage)
