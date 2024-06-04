/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/// <reference lib="dom" />

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  // TODO: Redefine types until bundling is introduced into extension
  // https://stackoverflow.com/a/56938089/1713082
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
    hasAIFix: boolean;
    filePath: string;
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

  type SuggestionMessage =
    | OpenLocalMessage
    | IgnoreIssueMessage
    | SetSuggestionMessage
    | GetSuggestionMessage

  const vscode = acquireVsCodeApi();

  function sendMessage(message: SuggestionMessage) {
    vscode.postMessage(message);
  }

  function navigateToIssue(_e: any, range: any) {
    if (!suggestion) return;
    const message: OpenLocalMessage = {
      type: 'openLocal',
      args: getSuggestionPosition(suggestion, range),
    };

    sendMessage(message);
  }

  let suggestion: Suggestion | null = vscode.getState()?.suggestion || null;

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

  function getSuggestionPosition(suggestionParam: Suggestion, position?: { file: string; rows: any; cols: any }) {
    return {
      uri: position?.file ?? suggestionParam.filePath,
      rows: position ? position.rows : suggestionParam.rows,
      cols: position ? position.cols : suggestionParam.cols,
      suggestionUri: suggestionParam.filePath,
    };
  }
  
  const dataFlows = document.getElementsByClassName('data-flow-clickable-row')
  for(let i = 0; i < dataFlows.length; i++) {
    dataFlows[i].addEventListener('click', (e) => {
      if (!suggestion) {
        return;
      }
      const markers = suggestion.markers
      if (!markers) {
        return;
      }
      navigateToIssue(e, { file: suggestion?.filePath, rows: markers[i]?.pos[0].rows, cols: markers[i].pos[0].cols } )
    });    
  }
  document.getElementById('ignore-line-issue')!.addEventListener('click', () => {
    ignoreIssue(true);
  });
  document.getElementById('ignore-file-issue')!.addEventListener('click', () => {
    ignoreIssue(false);
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
    }
  });
})();
