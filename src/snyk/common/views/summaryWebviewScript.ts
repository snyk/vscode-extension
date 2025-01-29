/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

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
  // @ts-ignore
  toggleDelta: isEnabled,
};

const message: SummaryMessage = {
  type: 'sendSummaryParams',
  args: { summary },
};
vscode.postMessage(message);
