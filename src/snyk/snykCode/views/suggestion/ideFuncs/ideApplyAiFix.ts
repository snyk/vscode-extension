/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

const fixApplyEditMessage: FixApplyEditMessage = {
  type: 'fixApplyEdit',
  //@ts-expect-error these will be injected from a func coming from LS
  args: { fixId },
};

vscode.postMessage(fixApplyEditMessage);
