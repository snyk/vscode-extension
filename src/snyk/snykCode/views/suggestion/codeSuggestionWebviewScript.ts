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
  type Lesson = {
    url: string;
    title: string;
  };

  type ExampleCommitFix = {
    commitURL: string;
    lines: CommitChangeLine[];
  };
  type CommitChangeLine = {
    line: string;
    lineNumber: number;
    lineChange: 'removed' | 'added' | 'none';
    isExampleLineEncoded?: boolean;
  };
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
    leadURL?: string;
    rule: string;
    repoDatasetSize: number;
    exampleCommitFixes: ExampleCommitFix[];
    cwe: string[];
    title: string;
    text: string;
    isSecurityType: boolean;
    markers?: Marker[];
    cols: Point;
    rows: Point;
    priorityScore: number;
    hasAIFix: boolean;
    diffs: AutofixUnifiedDiffSuggestion[];
    filePath: string;
  };

  type CurrentSeverity = {
    value: number;
    text: string;
  };

  type AutofixUnifiedDiffSuggestion = {
    fixId: string;
    unifiedDiffsPerFile: { [key: string]: string };
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

  type OpenBrowserMessage = {
    type: 'openBrowser';
    args: {
      url: string;
    };
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
    };
  };

  type SetSuggestionMessage = {
    type: 'set';
    args: Suggestion;
  };

  type GetSuggestionMessage = {
    type: 'get';
  };

  type SetLessonMessage = {
    type: 'setLesson';
    args: Lesson;
  };

  type GetLessonMessage = {
    type: 'getLesson';
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
    | OpenBrowserMessage
    | IgnoreIssueMessage
    | GetAutofixDiffsMesssage
    | ApplyGitDiffMessage
    | SetSuggestionMessage
    | GetSuggestionMessage
    | SetLessonMessage
    | GetLessonMessage
    | SetAutofixDiffsMessage
    | SetAutofixErrorMessage;

  const vscode = acquireVsCodeApi();

  const elements = {
    suggestionDetailsElem: document.querySelector('#suggestion-details') as HTMLElement,
    suggestionDetailsContentElem: document.querySelector('.suggestion-details-content') as HTMLElement,
    metaElem: document.getElementById('meta') as HTMLElement,

    severityElem: document.getElementById('severity') as HTMLElement,
    titleElem: document.getElementById('title') as HTMLElement,
    descriptionElem: document.getElementById('description') as HTMLElement,

    moreInfoElem: document.getElementById('lead-url') as HTMLElement,
    suggestionPosition2Elem: document.getElementById('line-position2') as HTMLElement,
    datasetElem: document.getElementById('dataset-number') as HTMLElement,
    infoTopElem: document.getElementById('info-top') as HTMLElement,

    diffTopElem: document.getElementById('diff-top') as HTMLElement,
    diffElem: document.getElementById('diff') as HTMLElement,
    noDiffsElem: document.getElementById('info-no-diffs') as HTMLElement,
    diffNumElem: document.getElementById('diff-number') as HTMLElement,
    diffNum2Elem: document.getElementById('diff-number2') as HTMLElement,
    nextDiffElem: document.getElementById('next-diff') as HTMLElement,
    previousDiffElem: document.getElementById('previous-diff') as HTMLElement,
    diffSelectedIndexElem: document.getElementById('diff-counter') as HTMLElement,

    applyFixButton: document.getElementById('apply-fix') as HTMLElement,
    retryGenerateFixButton: document.getElementById('retry-generate-fix') as HTMLElement,
    generateAIFixButton: document.getElementById('generate-ai-fix') as HTMLElement,

    fixAnalysisTabElem: document.getElementById('fix-analysis-tab') as HTMLElement,
    fixAnalysisContentElem: document.getElementById('fix-analysis-content') as HTMLElement,
    vulnOverviewTabElem: document.getElementById('vuln-overview-tab') as HTMLElement,
    vulnOverviewContentElem: document.getElementById('vuln-overview-content') as HTMLElement,

    fixLoadingIndicatorElem: document.getElementById('fix-loading-indicator') as HTMLElement,
    fixWrapperElem: document.getElementById('fix-wrapper') as HTMLElement,
    fixSectionElem: document.getElementById('fixes-section') as HTMLElement,
    fixErrorSectionElem: document.getElementById('fixes-error-section') as HTMLElement,

    exampleTopElem: document.getElementById('example-top') as HTMLElement,
    exampleElem: document.getElementById('example') as HTMLElement,
    noExamplesElem: document.getElementById('info-no-examples') as HTMLElement,
    exNumElem: document.getElementById('example-number') as HTMLElement,
    exNum2Elem: document.getElementById('example-number2') as HTMLElement,
  };

  function navigateToUrl(url: string) {
    const message: OpenBrowserMessage = {
      type: 'openBrowser',
      args: { url },
    };
    sendMessage(message);
  }

  let exampleCount = 0;
  let diffSelectedIndex = 0;

  // Try to restore the previous state
  let lesson: Lesson | null = vscode.getState()?.lesson || null;
  fillLearnLink();
  let suggestion: Suggestion | null = vscode.getState()?.suggestion || null;
  showCurrentSuggestion();

  function navigateToLeadURL() {
    if (!suggestion?.leadURL) return;
    navigateToUrl(suggestion.leadURL);
  }

  function navigateToIssue(_e: any, range: any) {
    if (!suggestion) return;
    const message: OpenLocalMessage = {
      type: 'openLocal',
      args: getSuggestionPosition(suggestion, range),
    };

    sendMessage(message);
  }

  function navigateToCurrentExample() {
    if (!suggestion?.exampleCommitFixes) return;

    const url = suggestion.exampleCommitFixes[exampleCount].commitURL;
    const message: OpenBrowserMessage = {
      type: 'openBrowser',
      args: { url },
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

  function getSuggestionPosition(suggestionParam: Suggestion, position?: { file: string; rows: any; cols: any }) {
    return {
      uri: position?.file ?? suggestionParam.filePath,
      rows: position ? position.rows : suggestionParam.rows,
      cols: position ? position.cols : suggestionParam.cols,
      suggestionUri: suggestionParam.filePath,
    };
  }

  function nextDiff() {
    if (!suggestion || !suggestion.diffs || diffSelectedIndex >= suggestion.diffs.length - 1) return;
    ++diffSelectedIndex;
    showCurrentDiff();
  }

  function previousDiff() {
    if (!suggestion || !suggestion.diffs || diffSelectedIndex <= 0) return;
    --diffSelectedIndex;
    showCurrentDiff();
  }

  function applyFix() {
    if (!suggestion) return;
    const diffSuggestion = suggestion.diffs[diffSelectedIndex];
    const filePath = suggestion.filePath;
    const patch = diffSuggestion.unifiedDiffsPerFile[filePath];

    const message: ApplyGitDiffMessage = {
      type: 'applyGitDiff',
      args: { filePath, patch },
    };
    sendMessage(message);
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

  function previousExample() {
    if (!suggestion || !suggestion.exampleCommitFixes || exampleCount <= 0) return;
    --exampleCount;
    showCurrentExample();
  }

  function nextExample() {
    if (!suggestion || !suggestion.exampleCommitFixes || exampleCount >= suggestion.exampleCommitFixes.length - 1)
      return;
    ++exampleCount;
    showCurrentExample();
  }

  function showCurrentDiff() {
    if (!suggestion?.diffs?.length || diffSelectedIndex < 0 || diffSelectedIndex >= suggestion.diffs.length) return;

    const { diffTopElem, diffElem, noDiffsElem, diffNumElem, diffNum2Elem, diffSelectedIndexElem } = elements;

    toggleElement(noDiffsElem, 'hide');
    toggleElement(diffTopElem, 'show');
    toggleElement(diffElem, 'show');

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
        lineDiv.className = 'code-line';

        if (line.startsWith('+')) {
          lineDiv.classList.add('added');
        } else if (line.startsWith('-')) {
          lineDiv.classList.add('removed');
        } else {
          lineDiv.classList.add('none');
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

  function showCurrentExample() {
    if (
      !suggestion?.exampleCommitFixes?.length ||
      exampleCount < 0 ||
      exampleCount >= suggestion.exampleCommitFixes.length
    )
      return;
    const counter = document.getElementById('example-counter')!;
    counter.innerHTML = (exampleCount + 1).toString();
    const url = suggestion.exampleCommitFixes[exampleCount].commitURL;
    const repo = url.match(/https?:\/\/[^\\/]+\/([^\\/]+\/[^\\/]+)/);
    if (repo && repo[1]) {
      const exLink = document.getElementById('example-link')!;
      exLink.innerHTML = repo[1];
    }
    const example = document.getElementById('example')!;
    example.querySelectorAll('*').forEach(n => n.remove());
    for (const l of suggestion.exampleCommitFixes[exampleCount].lines) {
      const line = document.createElement('div');
      line.className = `code-line ${l.lineChange}`;
      example.appendChild(line);
      const code = document.createElement('code');
      code.innerHTML = l.line;
      line.appendChild(code);
    }
  }

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

  /**
   * Transforms a severity string from a `Suggestion` object into a `CurrentSeverity` object.
   *
   * This function maps a severity string ('Low', 'Medium', 'High') to its corresponding
   * numeric value. If the provided severity string is not one of the allowed values, the function
   * returns `undefined`.
   *
   * @param {Suggestion['severity']} severity - The severity string to be mapped.
   * @returns {CurrentSeverity | undefined} The mapped severity object, or undefined
   */
  function getCurrentSeverity(severity: Suggestion['severity']): CurrentSeverity | undefined {
    const severityMap = {
      Low: 1,
      Medium: 2,
      High: 3,
    };

    const severityAllowedValues = Object.keys(severityMap);
    if (!severityAllowedValues.includes(severity)) {
      return undefined;
    }

    return {
      value: severityMap[severity],
      text: severity,
    };
  }

  /**
   * Toggles visibility of severity icons based on the current severity level.
   *
   * If `currentSeverity` is undefined, all icons are hidden.
   * It also updates the title attribute of the `severity` element to the text
   * representation of the current severity.
   *
   * @param {HTMLElement} severity - The HTML element containing severity icons.
   * @param {CurrentSeverity | undefined} currentSeverity - The current severity object, or
   *        undefined if there is no current severity.
   */
  function toggleSeverityIcons(severity: HTMLElement, currentSeverity: CurrentSeverity | undefined) {
    const severityIcons = severity.querySelectorAll('img');
    const validIconsIds: { [key: number]: string } = { 1: 'sev1', 2: 'sev2', 3: 'sev3' };

    if (!currentSeverity) {
      severityIcons.forEach(icon => (icon.className = 'icon hidden'));
      return;
    }

    severity.setAttribute('title', currentSeverity.text);

    severityIcons.forEach(icon => {
      const currentIconId = validIconsIds[currentSeverity.value];
      icon.className = icon.id === currentIconId ? 'icon' : 'icon hidden';
    });
  }

  function fillLearnLink() {
    const learnWrapper = document.querySelector('.learn')!;
    learnWrapper.className = 'learn learn__code';

    if (lesson) {
      const learnLink = document.querySelector<HTMLAnchorElement>('.learn--link')!;
      learnLink.innerText = lesson.title;
      const lessonUrl = lesson.url;
      learnLink.onclick = () => navigateToUrl(lessonUrl);
      learnWrapper.className = 'learn learn__code show';
    }
  }

  function showCurrentSuggestion() {
    if (!suggestion) {
      return;
    }

    exampleCount = 0;

    showSuggestionMeta(suggestion);
    showSuggestionDetails(suggestion);

    const {
      severityElem,
      titleElem,
      descriptionElem,
      moreInfoElem,
      suggestionPosition2Elem,
      infoTopElem,
      datasetElem,
      exampleTopElem,
      exampleElem,
      noExamplesElem,
      exNumElem,
      exNum2Elem,
    } = elements;

    const currentSeverity = getCurrentSeverity(suggestion.severity);

    toggleSeverityIcons(severityElem, currentSeverity);
    const suggestionTitle = suggestion.title.split(':')[0];

    // Manipulate DOM only if the title has changed
    if (titleElem.innerText !== suggestionTitle) {
      titleElem.innerText = suggestionTitle;
    }

    descriptionElem.innerHTML = '';

    if (suggestion.markers && suggestion.markers.length) {
      let i = 0;
      for (const m of suggestion.markers) {
        const preText = suggestion.message.substring(i, m.msg[0]);
        const preMark = document.createTextNode(preText);
        descriptionElem.appendChild(preMark);
        const mark = document.createElement('a');
        mark.className = 'mark-message clickable';
        mark.onclick = function () {
          navigateToIssue(undefined, m.pos[0]);
        };
        descriptionElem.appendChild(mark);
        const markMsg = document.createElement('span');
        markMsg.className = 'mark-string';
        markMsg.innerHTML = suggestion.message.substring(m.msg[0], m.msg[1] + 1);
        mark.appendChild(markMsg);
        let markLineText = '[';
        let first = true;
        for (const p of m.pos) {
          const rowStart = Number(p.rows[0]) + 1; // editors are 1-based
          markLineText += (first ? '' : ', ') + ':' + rowStart.toString();
          first = false;
        }
        markLineText += ']';
        const markLine = document.createElement('span');
        markLine.innerHTML = markLineText;
        markLine.className = 'mark-position';
        mark.appendChild(markLine);
        i = m.msg[1] + 1;
      }
      const postText = suggestion.message.substring(i);
      const postMark = document.createTextNode(postText);
      descriptionElem.appendChild(postMark);
    } else {
      descriptionElem.innerHTML = suggestion.message;
    }

    toggleElement(moreInfoElem, suggestion.leadURL ? 'show' : 'hide');

    suggestionPosition2Elem.innerText = (Number(suggestion.rows[0]) + 1).toString();

    infoTopElem.classList.add('font-light');
    if (suggestion.repoDatasetSize) {
      datasetElem.innerText = suggestion.repoDatasetSize.toString();
    } else {
      toggleElement(infoTopElem, 'hide');
    }

    if (suggestion?.exampleCommitFixes?.length) {
      toggleElement(exampleTopElem, 'show');
      exNumElem.innerText = suggestion.exampleCommitFixes.length.toString();
      exNum2Elem.innerText = suggestion.exampleCommitFixes.length.toString();

      toggleElement(exampleElem, 'show');
      toggleElement(noExamplesElem, 'hide');

      showCurrentExample();
    } else {
      toggleElement(exampleTopElem, 'hide');
      noExamplesElem.className = 'font-light';

      toggleElement(exampleElem, 'hide');
    }
  }

  /**
   * Constructs and displays the metadata section for a given suggestion.
   * This includes the issue type (Vulnerability or Issue), the associated CWE information,
   * the position of the issue in the code (line number), and the priority score if available.
   *
   * The line number is clickable and will trigger the navigateToIssue function when clicked.
   *
   * @param {Suggestion} suggestion - The suggestion object containing the details to be displayed.
   */
  function showSuggestionMeta(suggestion: Suggestion) {
    const { metaElem } = elements;

    // Clear previously metadata.
    metaElem.querySelectorAll('.suggestion-meta').forEach(element => element.remove());

    // Append issue type: 'Vulnerability' or 'Issue'.
    const issueTypeElement = document.createElement('span');
    issueTypeElement.className = 'suggestion-meta';
    issueTypeElement.textContent = suggestion.isSecurityType ? 'Vulnerability' : 'Issue';
    metaElem.appendChild(issueTypeElement);

    // Append the CWE information and link to CWE definition.
    if (suggestion.cwe) {
      suggestion.cwe.forEach(cwe => {
        const cweElement = document.createElement('a');
        cweElement.className = 'suggestion-meta suggestion-cwe is-external';
        cweElement.href = `https://cwe.mitre.org/data/definitions/${cwe.split('-')[1]}.html`;
        cweElement.textContent = cwe;
        metaElem.appendChild(cweElement);
      });
    }

    // Append the issue code position.
    // The line number triggers navigation to the issue location.
    const issuePositionLineElement = document.createElement('span');
    const linePositionAnchor = document.createElement('a');

    issuePositionLineElement.className = 'suggestion-meta';
    linePositionAnchor.id = 'navigateToIssue';
    linePositionAnchor.textContent = ` ${Number(suggestion.rows[0]) + 1}`;
    linePositionAnchor.href = 'javascript:void(0)';
    linePositionAnchor.addEventListener('click', navigateToIssue.bind(undefined));
    issuePositionLineElement.appendChild(document.createTextNode('Position: line '));
    issuePositionLineElement.appendChild(linePositionAnchor);
    metaElem.appendChild(issuePositionLineElement);

    // Append the priority score if available.
    if (suggestion.priorityScore !== undefined) {
      const priorityScoreElement = document.createElement('span');
      priorityScoreElement.className = 'suggestion-meta';
      priorityScoreElement.textContent = `Priority score: ${suggestion.priorityScore}`;
      metaElem.appendChild(priorityScoreElement);
    }

    const fixesSection = document.querySelector('.ai-fix');
    const communityFixesSection = document.querySelector('.sn-community-fixes');

    if (!suggestion.hasAIFix) {
      toggleElement(fixesSection, 'hide');
      toggleElement(communityFixesSection, 'show');
    } else {
      toggleElement(fixesSection, 'show');
      toggleElement(communityFixesSection, 'hide');
    }
  }

  function showSuggestionDetails(suggestion: Suggestion) {
    const {
      suggestionDetailsElem,
      fixAnalysisTabElem,
      fixAnalysisContentElem,
      vulnOverviewTabElem,
      vulnOverviewContentElem,
    } = elements;

    suggestionDetailsElem.innerHTML = suggestion.text;

    fixAnalysisTabElem.addEventListener('click', () => {
      fixAnalysisTabElem.classList.add('is-selected');
      fixAnalysisContentElem.classList.add('is-selected');
      vulnOverviewTabElem.classList.remove('is-selected');
      vulnOverviewContentElem.classList.remove('is-selected');
    });

    vulnOverviewTabElem.addEventListener('click', () => {
      vulnOverviewContentElem.classList.add('is-selected');
      vulnOverviewTabElem.classList.add('is-selected');
      fixAnalysisTabElem.classList.remove('is-selected');
      fixAnalysisContentElem.classList.remove('is-selected');
    });
  }

  const {
    generateAIFixButton,
    retryGenerateFixButton,
    applyFixButton,
    nextDiffElem,
    previousDiffElem,
    fixSectionElem,
    fixLoadingIndicatorElem,
    fixWrapperElem,
    fixErrorSectionElem,
  } = elements;

  generateAIFixButton?.addEventListener('click', generateAIFix);
  retryGenerateFixButton?.addEventListener('click', retryGenerateAIFix);
  nextDiffElem.addEventListener('click', nextDiff);
  previousDiffElem.addEventListener('click', previousDiff);
  applyFixButton.addEventListener('click', applyFix);

  function sendMessage(message: SuggestionMessage) {
    vscode.postMessage(message);
  }

  document.getElementById('lead-url')!.addEventListener('click', navigateToLeadURL);
  document.getElementById('current-example')!.addEventListener('click', navigateToCurrentExample);
  document.getElementById('previous-example')!.addEventListener('click', previousExample);
  document.getElementById('next-example')!.addEventListener('click', nextExample);
  document.getElementById('ignore-line-issue')!.addEventListener('click', () => {
    ignoreIssue(true);
  });
  document.getElementById('ignore-file-issue')!.addEventListener('click', () => {
    ignoreIssue(false);
  });

  // deepcode ignore InsufficientValidation: Content Security Policy applied in provider
  window.addEventListener('message', event => {
    const message = event.data as SuggestionMessage;
    switch (message.type) {
      case 'set': {
        suggestion = message.args;
        vscode.setState({ ...vscode.getState(), suggestion });
        showCurrentSuggestion();
        break;
      }
      case 'get': {
        const newSuggestion = vscode.getState()?.suggestion || {};
        if (newSuggestion != suggestion) {
          suggestion = newSuggestion;
          showCurrentSuggestion();
        }
        break;
      }
      case 'setLesson': {
        lesson = message.args;
        vscode.setState({ ...vscode.getState(), lesson });
        fillLearnLink();
        break;
      }
      case 'getLesson': {
        lesson = vscode.getState()?.lesson || null;
        fillLearnLink();
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
