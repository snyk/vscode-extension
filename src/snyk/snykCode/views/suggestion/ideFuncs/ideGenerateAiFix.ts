type GetAutofixDiffsMesssage = {
  type: 'getAutofixDiffs';
  args: {
    suggestion: Suggestion;
  };
};

const autoFixMessage: GetAutofixDiffsMesssage = {
  type: 'getAutofixDiffs',
  // @ts-expect-error
  args: { suggestion },
};
vscode.postMessage(autoFixMessage);
