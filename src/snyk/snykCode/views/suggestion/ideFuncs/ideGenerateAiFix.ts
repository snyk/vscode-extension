/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

type GetAutofixDiffsMesssage = {
  type: 'getAutofixDiffs';
  args: {
    suggestion: Suggestion;
  };
};

const autoFixMessage: GetAutofixDiffsMesssage = {
  type: 'getAutofixDiffs',
  // @ts-expect-error this will be injected from a func coming from LS
  args: { suggestion },
};
vscode.postMessage(autoFixMessage);
