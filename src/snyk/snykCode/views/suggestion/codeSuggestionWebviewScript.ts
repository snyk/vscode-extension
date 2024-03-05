/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/// <reference lib="dom" />

// eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-explicit-any
// import { AutofixUnifiedDiffSuggestion } from '../../../common/languageServer/types';

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
    uri: string;
    markers?: Marker[];
    cols: Point;
    rows: Point;
    priorityScore: number;
    hasAIFix: boolean;
    diffs: AutofixUnifiedDiffSuggestion[];
  };
  type CurrentSeverity = {
    value: number;
    text: string;
  };

  type AutofixUnifiedDiffSuggestion = {
    fixId: string;
    unifiedDiffsPerFile: { [key: string]: string };
  };

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

    exampleTopElem: document.getElementById('example-top') as HTMLElement,
    exampleElem: document.getElementById('example') as HTMLElement,
    noExamplesElem: document.getElementById('info-no-examples') as HTMLElement,
    exNumElem: document.getElementById('example-number') as HTMLElement,
    exNum2Elem: document.getElementById('example-number2') as HTMLElement,
  };

  function navigateToUrl(url: string) {
    sendMessage({
      type: 'openBrowser',
      args: { url },
    });
  }

  let exampleCount = 0;
  let diffCount = 0;

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

  function nextDiff() {
    if (!suggestion || !suggestion.diffs || diffCount >= suggestion.diffs.length - 1) return;
    ++diffCount;
    showCurrentDiff();
  }

  function previousDiff() {
    if (!suggestion || !suggestion.diffs || diffCount <= 0) return;
    --diffCount;
    showCurrentDiff();
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
    if (!suggestion?.diffs?.length || diffCount < 0 || diffCount >= suggestion.diffs.length) return;
    const counter = document.getElementById('diff-counter')!;
    counter.innerHTML = (diffCount + 1).toString();

    const diffSuggestion = suggestion.diffs[diffCount];
    const diff = document.getElementById('diff')!;
    diff.querySelectorAll('*').forEach(n => n.remove());
    const unifiedDiffElement = document.createElement('div');
    unifiedDiffElement.className = `example-line`; // TODO add line color
    diff.appendChild(unifiedDiffElement);
    const code = document.createElement('code');
    code.innerHTML = diffSuggestion.unifiedDiffsPerFile[suggestion.uri];
    unifiedDiffElement.appendChild(code);
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
      diffTopElem,
      diffElem,
      noDiffsElem,
      diffNumElem,
      diffNum2Elem,
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
        const uniqueRows = new Set();

        for (const p of m.pos) {
          const rowStart = Number(p.rows[0]) + 1; // editors are 1-based
          const rowStartStr = ':' + rowStart.toString();

          if (!uniqueRows.has(rowStartStr)) {
            uniqueRows.add(rowStartStr);
            markLineText += (first ? '' : ', ') + rowStartStr;
            first = false;
          }
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

    moreInfoElem.className = suggestion.leadURL ? 'clickable' : 'clickable hidden';

    suggestionPosition2Elem.innerHTML = (Number(suggestion.rows[0]) + 1).toString();

    infoTopElem.classList.add('font-light');
    if (suggestion.repoDatasetSize) {
      datasetElem.innerHTML = suggestion.repoDatasetSize.toString();
    } else {
      infoTopElem.classList.add('hidden');
    }

    // TODO fix
    // if (suggestion?.diffs?.length) {
    diffTopElem.className = 'row between';
    diffElem.className = '';

    diffNumElem.innerHTML = suggestion.diffs?.length.toString();
    diffNum2Elem.innerHTML = suggestion.diffs?.length.toString();
    noDiffsElem.className = 'hidden';
    showCurrentDiff();
    // } else {
    //   diffTopElem.className = 'row between hidden';
    //   diffElem.className = 'hidden';
    //   noDiffsElem.className = 'font-light';
    // }

    if (suggestion?.exampleCommitFixes?.length) {
      exampleTopElem.className = 'row between';
      exampleElem.className = '';
      exNumElem.innerHTML = suggestion.exampleCommitFixes.length.toString();
      exNum2Elem.innerHTML = suggestion.exampleCommitFixes.length.toString();
      noExamplesElem.className = 'hidden';
      showCurrentExample();
    } else {
      exampleTopElem.className = 'row between hidden';
      exampleElem.className = 'hidden';
      noExamplesElem.className = 'font-light';
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

    console.log(`hasAIFix: ${suggestion.hasAIFix}`);
    if (!suggestion.hasAIFix) {
      document.querySelector('.ai-fix')?.classList.add('hidden');
    } else {
      document.querySelector('.ai-fix')?.classList.remove('hidden');
    }
  }

  function showSuggestionDetails(suggestion: Suggestion) {
    const { suggestionDetailsElem } = elements;

    suggestionDetailsElem.innerHTML = suggestion.text;

    const fixAnalysisTab = document.querySelector('.sn-fix-analysis') as HTMLElement;
    const fixAnalysisContent = document.querySelector('.sn-fix-content') as HTMLElement;
    const vulnOverviewTab = document.querySelector('.sn-vuln-overview') as HTMLElement;
    const vulnOverviewContent = document.querySelector('.sn-vuln-content') as HTMLElement;

    const tabs = document.querySelector('.tabs-nav') as HTMLElement;
    tabs?.addEventListener('click', (event: Event) => {
      const target = event.target as Element;
      if (target.classList.contains('sn-fix-analysis')) {
        fixAnalysisTab.classList.add('is-selected');
        fixAnalysisContent.classList.add('is-selected');
        vulnOverviewTab.classList.remove('is-selected');
        vulnOverviewContent.classList.remove('is-selected');
      } else {
        vulnOverviewContent.classList.add('is-selected');
        vulnOverviewTab.classList.add('is-selected');
        fixAnalysisTab.classList.remove('is-selected');
        fixAnalysisContent.classList.remove('is-selected');
      }
    });
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
      case 'setAutoFixDiffs': {
        if (suggestion) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          suggestion.diffs = args;
        }
        break;
      }
    }
  });
})();
