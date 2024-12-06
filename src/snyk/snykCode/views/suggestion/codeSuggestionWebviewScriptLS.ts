/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/// <reference lib="dom" />
declare const acquireVsCodeApi: any;

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

  type GetAutofixDiffsMesssage = {
    type: 'getAutofixDiffs';
    args: {
      suggestion: Suggestion;
    };
  };

  type ApplyGitDiffMessage = {
    type: 'applyGitDiff';
    args: {
      patch: string;
      filePath: string;
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
    | ApplyGitDiffMessage
    | SetAutofixDiffsMessage
    | SetAutofixErrorMessage;

  const vscode = acquireVsCodeApi();

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

  function toggleElement(element: Element | null, toggle: 'hide' | 'show') {
    if (!element) {
      return;
    }

    if (toggle === 'show') {
      element.classList.remove('hidden');
    } else if (toggle === 'hide') {
      element.classList.add('hidden');
    } else {
      console.error('Unexpected toggle value', toggle);
    }
  }

  // different AI fix buttons
  const applyFixButton = document.getElementById('apply-fix') as HTMLButtonElement;
  const retryGenerateFixButton = document.getElementById('retry-generate-fix') as HTMLElement;
  const generateAIFixButton = document.getElementById('generate-ai-fix') as HTMLElement;

  const ignoreContainerElements = document.getElementsByClassName('ignore-action-container');
  if (ignoreContainerElements) {
    toggleElement(ignoreContainerElements[0] as HTMLElement, 'show');
    (ignoreContainerElements[0] as HTMLElement).style.display = suggestion?.showInlineIgnoresButton ? 'block' : 'none';
  }

  function generateAIFix() {
    if (!suggestion) {
      return;
    }

    toggleElement(generateAIFixButton, 'hide');
    toggleElement(fixLoadingIndicatorElem, 'show');
    const message: GetAutofixDiffsMesssage = {
      type: 'getAutofixDiffs',
      args: { suggestion },
    };
    sendMessage(message);
  }

  function retryGenerateAIFix() {
    console.log('retrying generate AI Fix');

    toggleElement(fixWrapperElem, 'show');
    toggleElement(fixErrorSectionElem, 'hide');

    generateAIFix();
  }

  function applyFix() {
    if (!suggestion) return;
    const diffSuggestion = suggestion.diffs[diffSelectedIndex];
    const filePath = suggestion.filePath;
    const patch = diffSuggestion.unifiedDiffsPerFile[filePath];
    const fixId = diffSuggestion.fixId;
    lastAppliedFix = diffSelectedIndex;
    applyFixButton.disabled = true;
    const message: ApplyGitDiffMessage = {
      type: 'applyGitDiff',
      args: { filePath, patch, fixId },
    };
    sendMessage(message);
  }

  generateAIFixButton?.addEventListener('click', generateAIFix);
  retryGenerateFixButton?.addEventListener('click', retryGenerateAIFix);
  applyFixButton?.addEventListener('click', applyFix);

  // different AI fix states
  const fixLoadingIndicatorElem = document.getElementById('fix-loading-indicator') as HTMLElement;
  const fixWrapperElem = document.getElementById('fix-wrapper') as HTMLElement;
  const fixSectionElem = document.getElementById('fixes-section') as HTMLElement;
  const fixErrorSectionElem = document.getElementById('fixes-error-section') as HTMLElement;

  // generated AI fix diffs
  const nextDiffElem = document.getElementById('next-diff') as HTMLElement;
  const previousDiffElem = document.getElementById('previous-diff') as HTMLElement;
  const diffSelectedIndexElem = document.getElementById('diff-counter') as HTMLElement;

  const diffTopElem = document.getElementById('diff-top') as HTMLElement;
  const diffElem = document.getElementById('diff') as HTMLElement;
  const noDiffsElem = document.getElementById('info-no-diffs') as HTMLElement;
  if (noDiffsElem) {
    noDiffsElem.innerText = "We couldn't determine any fixes for this issue.";
  }
  const diffNumElem = document.getElementById('diff-number') as HTMLElement;
  const diffNum2Elem = document.getElementById('diff-number2') as HTMLElement;

  let diffSelectedIndex = 0;
  let lastAppliedFix = -1;
  function nextDiff() {
    if (!suggestion || !suggestion.diffs || diffSelectedIndex >= suggestion.diffs.length - 1) return;
    ++diffSelectedIndex;
    applyFixButton.disabled = diffSelectedIndex == lastAppliedFix;
    showCurrentDiff();
  }

  function previousDiff() {
    if (!suggestion || !suggestion.diffs || diffSelectedIndex <= 0) return;
    --diffSelectedIndex;
    applyFixButton.disabled = diffSelectedIndex == lastAppliedFix;
    showCurrentDiff();
  }

  function showCurrentDiff() {
    if (!suggestion?.diffs?.length) {
      toggleElement(noDiffsElem, 'show');
      toggleElement(diffTopElem, 'hide');
      toggleElement(diffElem, 'hide');
      toggleElement(applyFixButton, 'hide');
      return;
    }

    if (!suggestion?.diffs?.length || diffSelectedIndex < 0 || diffSelectedIndex >= suggestion.diffs.length) return;

    toggleElement(noDiffsElem, 'hide');
    toggleElement(diffTopElem, 'show');
    toggleElement(diffElem, 'show');
    toggleElement(applyFixButton, 'show');

    diffNumElem.innerText = suggestion.diffs.length.toString();
    diffNum2Elem.innerText = suggestion.diffs.length.toString();

    diffSelectedIndexElem.innerText = (diffSelectedIndex + 1).toString();

    const diffSuggestion = suggestion.diffs[diffSelectedIndex];

    const filePath = suggestion.filePath;
    const patch = diffSuggestion.unifiedDiffsPerFile[filePath];

    // clear all elements
    while (diffElem.firstChild) {
      diffElem.removeChild(diffElem.firstChild);
    }
    diffElem.appendChild(generateDiffHtml(patch));
  }

  function generateDiffHtml(patch: string): HTMLElement {
    const codeLines = patch.split('\n');

    // the first two lines are the file names
    codeLines.shift();
    codeLines.shift();

    const diffHtml = document.createElement('div');
    let blockDiv: HTMLElement | null = null;

    for (const line of codeLines) {
      if (line.startsWith('@@ ')) {
        blockDiv = document.createElement('div');
        blockDiv.className = 'example';

        if (blockDiv) {
          diffHtml.appendChild(blockDiv);
        }
      } else {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'example-line';

        if (line.startsWith('+')) {
          lineDiv.classList.add('added');
        } else if (line.startsWith('-')) {
          lineDiv.classList.add('removed');
        }

        const lineCode = document.createElement('code');
        // if line is empty, we need to fallback to ' '
        // to make sure it displays in the diff
        lineCode.innerText = line.slice(1, line.length) || ' ';

        lineDiv.appendChild(lineCode);
        blockDiv?.appendChild(lineDiv);
      }
    }

    return diffHtml;
  }

  nextDiffElem.addEventListener('click', nextDiff);
  previousDiffElem.addEventListener('click', previousDiff);

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
          toggleElement(fixSectionElem, 'show');
          toggleElement(fixLoadingIndicatorElem, 'hide');
          toggleElement(fixWrapperElem, 'hide');

          const { diffs } = message.args;
          suggestion.diffs = diffs;

          vscode.setState({ ...vscode.getState(), suggestion });
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
        toggleElement(fixWrapperElem, 'hide');
        toggleElement(fixErrorSectionElem, 'show');
      }
    }
  });
})();
