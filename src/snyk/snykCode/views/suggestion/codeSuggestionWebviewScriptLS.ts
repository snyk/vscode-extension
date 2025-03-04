/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/// <reference lib="dom" />
declare const acquireVsCodeApi: any;

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
type Marker = {
  msg: Point;
  pos: MarkerPosition[];
};
type MarkerPosition = {
  cols: Point;
  rows: Point;
  file: string;
};
type Point = [number, number];
type AutofixUnifiedDiffSuggestion = {
  fixId: string;
  unifiedDiffsPerFile: { [key: string]: string };
};
type Suggestion = {
  id: string;
  message: string;
  severity: 'Low' | 'Medium' | 'High';
  rule: string;
  cwe: string[];
  title: string;
  text: string;
  markers?: Marker[];
  cols: Point;
  rows: Point;
  filePath: string;
  hasAIFix: boolean;
  diffs: AutofixUnifiedDiffSuggestion[];
  showInlineIgnoresButton: boolean;
};

type OpenLocalMessage = {
  type: 'openLocal';
  args: {
    uri: string;
    cols: [number, number];
    rows: [number, number];
    suggestionUri: string;
  };
};

type IgnoreIssueMessage = {
  type: 'ignoreIssue';
  args: {
    id: string;
    severity: 'Low' | 'Medium' | 'High';
    lineOnly: boolean;
    message: string;
    rule: string;
    uri: string;
    cols: [number, number];
    rows: [number, number];
  };
};

type SetSuggestionMessage = {
  type: 'set';
  args: Suggestion;
};

type GetSuggestionMessage = {
  type: 'get';
};

type FixApplyEditMessage = {
  type: 'fixApplyEdit';
  args: {
    fixId: string;
  };
};

type SetAutofixDiffsMessage = {
  type: 'setAutofixDiffs';
  args: {
    suggestion: Suggestion;
    diffs: AutofixUnifiedDiffSuggestion[];
  };
};

type SetAutofixErrorMessage = {
  type: 'setAutofixError';
  args: {
    suggestion: Suggestion;
  };
};

type SuggestionMessage =
  | OpenLocalMessage
  | IgnoreIssueMessage
  | SetSuggestionMessage
  | GetSuggestionMessage
  | GetAutofixDiffsMesssage
  | FixApplyEditMessage
  | SetAutofixDiffsMessage
  | SetAutofixErrorMessage;

vscode = acquireVsCodeApi();

function sendMessage(message: SuggestionMessage) {
  vscode.postMessage(message);
}

function navigateToIssue(position?: MarkerPosition) {
  if (!suggestion) {
    return;
  }

  const message: OpenLocalMessage = {
    type: 'openLocal',
    args: {
      ...getSuggestionPosition(suggestion, position),
      suggestionUri: suggestion.filePath,
    },
  };

  sendMessage(message);
}

function ignoreIssue(lineOnly: boolean) {
  if (!suggestion) return;

  const message: IgnoreIssueMessage = {
    type: 'ignoreIssue',
    args: {
      ...getSuggestionPosition(suggestion),
      message: suggestion.message,
      rule: suggestion.rule,
      id: suggestion.id,
      severity: suggestion.severity,
      lineOnly: lineOnly,
    },
  };
  sendMessage(message);
}

function getSuggestionPosition(suggestionParam: Suggestion, position?: MarkerPosition) {
  return {
    uri: position?.file ?? suggestionParam.filePath,
    rows: position ? position.rows : suggestionParam.rows,
    cols: position ? position.cols : suggestionParam.cols,
  };
}

const dataFlows = document.getElementsByClassName('data-flow-clickable-row');
for (let i = 0; i < dataFlows.length; i++) {
  dataFlows[i].addEventListener('click', () => {
    const rows: Point = [
      parseInt(dataFlows[i].getAttribute('start-line')!),
      parseInt(dataFlows[i].getAttribute('end-line')!),
    ];
    const cols: Point = [
      parseInt(dataFlows[i].getAttribute('start-character')!),
      parseInt(dataFlows[i].getAttribute('end-character')!),
    ];
    const position = {
      file: dataFlows[i].getAttribute('file-path')!,
      rows: rows,
      cols: cols,
    };
    navigateToIssue(position);
  });
}
document.getElementById('ignore-line-issue')?.addEventListener('click', () => {
  ignoreIssue(true);
});
document.getElementById('ignore-file-issue')?.addEventListener('click', () => {
  ignoreIssue(false);
});
document.getElementById('position-line')!.addEventListener('click', () => {
  navigateToIssue();
});

window.addEventListener('message', event => {
  const message = event.data as SuggestionMessage;
  switch (message.type) {
    case 'set': {
      suggestion = message.args;
      vscode.setState({ ...vscode.getState(), suggestion });
      break;
    }
    case 'get': {
      const newSuggestion = vscode.getState()?.suggestion || {};
      if (newSuggestion != suggestion) {
        suggestion = newSuggestion;
      }
      break;
    }
    case 'setAutofixDiffs': {
      if (suggestion?.id === message.args.suggestion.id) {
        //@ts-expect-error this function will be injected, defined in LS
        toggleElement(fixSectionElem, 'show');

        //@ts-expect-error this function will be injected, defined in LS
        toggleElement(fixLoadingIndicatorElem, 'hide');

        //@ts-expect-error this function will be injected, defined in LS
        toggleElement(fixWrapperElem, 'hide');

        const { diffs } = message.args;
        suggestion.diffs = diffs;

        vscode.setState({ ...vscode.getState(), suggestion });

        //@ts-expect-error this function will be injected, defined in LS
        showCurrentDiff();
      }
      break;
    }
    case 'setAutofixError': {
      const errorSuggestion = message.args.suggestion;

      if (errorSuggestion.id != suggestion?.id) {
        console.log('Got an error for a previously generated suggestion: ignoring');
        break;
      }
      //@ts-expect-error this function will be injected, defined in LS
      toggleElement(fixWrapperElem, 'hide');

      //@ts-expect-error this function will be injected, defined in LS
      toggleElement(fixErrorSectionElem, 'show');
    }
  }
});
