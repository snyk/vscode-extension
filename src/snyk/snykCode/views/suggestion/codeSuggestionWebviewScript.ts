/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/// <reference lib="dom" />

// eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-explicit-any
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
    uri: string;
    markers?: Marker[];
    cols: Point;
    rows: Point;
    priorityScore: number;
  };
  type CurrentSeverity = {
    value: number;
    text: string;
  };

  const vscode = acquireVsCodeApi();

  const elements = {
    readMoreBtn: document.querySelector('.read-more-btn') as HTMLElement,
    suggestionDetails: document.querySelector('#suggestion-details') as HTMLElement,
    suggestionDetailsContent: document.querySelector('.suggestion-details-content') as HTMLElement,
    meta: document.getElementById('meta') as HTMLElement,

    severity: document.getElementById('severity') as HTMLElement,
    title: document.getElementById('title') as HTMLElement,
    description: document.getElementById('description') as HTMLElement,

    moreInfo: document.getElementById('lead-url') as HTMLElement,
    suggestionPosition2: document.getElementById('line-position2') as HTMLElement,
    dataset: document.getElementById('dataset-number') as HTMLElement,
    infoTop: document.getElementById('info-top') as HTMLElement,

    exampleTop: document.getElementById('example-top') as HTMLElement,
    example: document.getElementById('example') as HTMLElement,
    noExamples: document.getElementById('info-no-examples') as HTMLElement,
    exNum: document.getElementById('example-number') as HTMLElement,
    exNum2: document.getElementById('example-number2') as HTMLElement,
  };

  let isReadMoreBtnEventBound = false;

  function navigateToUrl(url: string) {
    sendMessage({
      type: 'openBrowser',
      args: { url },
    });
  }

  let exampleCount = 0;

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
    sendMessage({
      type: 'openLocal',
      args: getSuggestionPosition(suggestion, range),
    });
  }
  function navigateToCurrentExample() {
    if (!suggestion?.exampleCommitFixes) return;

    const url = suggestion.exampleCommitFixes[exampleCount].commitURL;
    sendMessage({
      type: 'openBrowser',
      args: { url },
    });
  }
  function ignoreIssue(lineOnly: boolean) {
    if (!suggestion) return;

    sendMessage({
      type: 'ignoreIssue',
      args: {
        ...getSuggestionPosition(suggestion),
        message: suggestion.message,
        rule: suggestion.rule,
        id: suggestion.id,
        severity: suggestion.severity,
        lineOnly: lineOnly,
      },
    });
  }
  function getSuggestionPosition(suggestionParam: Suggestion, position?: { file: string; rows: any; cols: any }) {
    return {
      uri: position?.file ?? suggestionParam.uri,
      rows: position ? position.rows : suggestionParam.rows,
      cols: position ? position.cols : suggestionParam.cols,
      suggestionUri: suggestionParam.uri,
    };
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
      line.className = `example-line ${l.lineChange}`;
      example.appendChild(line);
      const code = document.createElement('code');
      code.innerHTML = l.line;
      line.appendChild(code);
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

    const { severity, title, description } = elements;
    const currentSeverity = getCurrentSeverity(suggestion.severity);

    toggleSeverityIcons(severity, currentSeverity);

    title.innerText = suggestion.title.split(':')[0];

    description.querySelectorAll('*').forEach(n => n.remove());
    description.innerHTML = '';
    if (suggestion.markers && suggestion.markers.length) {
      let i = 0;
      for (const m of suggestion.markers) {
        const preText = suggestion.message.substring(i, m.msg[0]);
        const preMark = document.createTextNode(preText);
        description.appendChild(preMark);
        const mark = document.createElement('a');
        mark.className = 'mark-message clickable';
        mark.onclick = function () {
          navigateToIssue(undefined, m.pos[0]);
        };
        description.appendChild(mark);
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
      description.appendChild(postMark);
    } else {
      description.innerHTML = suggestion.message;
    }

    const { moreInfo, suggestionPosition2, dataset, infoTop } = elements;

    moreInfo.className = suggestion.leadURL ? 'clickable' : 'clickable hidden';

    suggestionPosition2.innerHTML = (Number(suggestion.rows[0]) + 1).toString();

    if (suggestion.repoDatasetSize) {
      dataset.innerHTML = suggestion.repoDatasetSize.toString();
      infoTop.className = 'font-light';
    } else {
      infoTop.className = 'font-light hidden';
    }

    const { exampleTop, example, noExamples, exNum, exNum2 } = elements;

    if (suggestion?.exampleCommitFixes?.length) {
      exampleTop.className = 'row between';
      example.className = '';

      exNum.innerHTML = suggestion.exampleCommitFixes.length.toString();

      exNum2.innerHTML = suggestion.exampleCommitFixes.length.toString();
      noExamples.className = 'hidden';
      showCurrentExample();
    } else {
      exampleTop.className = 'row between hidden';
      example.className = 'hidden';
      noExamples.className = 'font-light';
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
    const { meta } = elements;

    // Clear previously metadata.
    meta.querySelectorAll('.suggestion-meta').forEach(element => element.remove());

    // Append issue type: 'Vulnerability' or 'Issue'.
    const issueTypeElement = document.createElement('span');
    issueTypeElement.className = 'suggestion-meta';
    issueTypeElement.textContent = suggestion.isSecurityType ? 'Vulnerability' : 'Issue';
    meta.appendChild(issueTypeElement);

    // Append the CWE information and link to CWE definition.
    if (suggestion.cwe) {
      suggestion.cwe.forEach(cwe => {
        const cweElement = document.createElement('a');
        cweElement.className = 'suggestion-meta suggestion-cwe';
        cweElement.href = `https://cwe.mitre.org/data/definitions/${cwe.split('-')[1]}.html`;
        cweElement.textContent = cwe;
        meta.appendChild(cweElement);
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
    meta.appendChild(issuePositionLineElement);

    // Append the priority score if available.
    if (suggestion.priorityScore !== undefined) {
      const priorityScoreElement = document.createElement('span');
      priorityScoreElement.className = 'suggestion-meta';
      priorityScoreElement.textContent = `Priority Score: ${suggestion.priorityScore}`;
      meta.appendChild(priorityScoreElement);
    }
  }

  function showSuggestionDetails(suggestion: Suggestion) {
    const { suggestionDetails, readMoreBtn, suggestionDetailsContent } = elements;

    if (!suggestion || !suggestion.text || !suggestionDetails || !readMoreBtn) {
      readMoreBtn.classList.add('hidden');
      suggestionDetailsContent.classList.add('hidden');
      return;
    }

    suggestionDetails.innerHTML = suggestion.text;
    suggestionDetails.classList.add('collapsed');
    readMoreBtn.classList.remove('hidden');
    suggestionDetailsContent.classList.remove('hidden');

    if (!isReadMoreBtnEventBound) {
      readMoreBtn.addEventListener('click', () => {
        const isCollapsed = suggestionDetails.classList.contains('collapsed');

        if (isCollapsed) {
          suggestionDetails.classList.remove('collapsed');
          readMoreBtn.textContent = 'Read less';
        } else {
          suggestionDetails.classList.add('collapsed');
          readMoreBtn.textContent = 'Read more';
        }
      });
      isReadMoreBtnEventBound = true;
    }
  }

  function sendMessage(message: {
    type: string;
    args:
      | { uri: any; rows: any; cols: any }
      | { url: any }
      | { url: any }
      | { url: string }
      | { message: any; rule: any; id: any; severity: any; lineOnly: boolean; uri: any; rows: any; cols: any }
      | { suggestion: any };
  }) {
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
    const { type, args } = event.data;
    switch (type) {
      case 'set': {
        suggestion = args;
        vscode.setState({ ...vscode.getState(), suggestion });
        showCurrentSuggestion();
        break;
      }
      case 'get': {
        suggestion = vscode.getState()?.suggestion || {};
        showCurrentSuggestion();
        break;
      }
      case 'setLesson': {
        lesson = args;
        vscode.setState({ ...vscode.getState(), lesson });
        fillLearnLink();
        break;
      }
      case 'getLesson': {
        lesson = vscode.getState()?.lesson || null;
        fillLearnLink();
        break;
      }
    }
  });
})();
