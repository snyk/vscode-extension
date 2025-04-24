/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

type SubmitIgnoreRequestMessage = {
  type: 'submitIgnoreRequest';
  args: {
    id: string;
    ignoreType: string;
    ignoreExpirationDate: string;
    ignoreReason: string;
  };
};

const submitIgnoreRequestMessage: SubmitIgnoreRequestMessage = {
  type: 'submitIgnoreRequest',
  args: {
    // @ts-expect-error this will be injected from a func coming from LS
    id: issueId,
    // @ts-expect-error this will be injected from a func coming from LS
    ignoreType: ignoreType,
    // @ts-expect-error this will be injected from a func coming from LS
    ignoreExpirationDate: ignoreExpirationDate,
    // @ts-expect-error this will be injected from a func coming from LS
    ignoreReason: ignoreReason,
  },
};
vscode.postMessage(submitIgnoreRequestMessage);
