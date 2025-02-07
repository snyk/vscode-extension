/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

const applyFixMessage: ApplyGitDiffMessage = {
  type: 'applyGitDiff',
  //@ts-expect-error these will be injected from a func coming from LS
  args: { filePath, patch, fixId },
};

vscode.postMessage(applyFixMessage);
