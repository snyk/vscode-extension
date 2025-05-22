/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

type SummaryMessage = {
  type: 'sendSummaryParams';
  args: {
    summary: Summary;
  };
};

type Summary = {
  toggleDelta: boolean;
};
const vscode = acquireVsCodeApi();

const summary: Summary = {
  // @ts-expect-error this will be injected in a func coming from LS that has isEnabled as arg.
  toggleDelta: isEnabled,
};

const message: SummaryMessage = {
  type: 'sendSummaryParams',
  args: { summary },
};
vscode.postMessage(message);
