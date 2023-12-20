/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
    severity: string;
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
  };

  const vscode = acquireVsCodeApi();

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
  function getCurrentSeverity() {
    const stringMap = {
      Low: 1,
      Medium: 2,
      High: 3,
    };
    return suggestion
      ? {
          value: stringMap[suggestion.severity],
          text: suggestion.severity,
        }
      : undefined;
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

    showSuggestionDetails(suggestion);

    exampleCount = 0;
    const currentSeverity = getCurrentSeverity();
    const severity = document.getElementById('severity')!;
    const title = document.getElementById('title')!;
    const description = document.getElementById('description')!;
    const meta = document.getElementById('meta')!;
    let type = '';

    // Set issue type: vulnerability or issue
    type = suggestion.isSecurityType ? 'vulnerability' : 'issue';

    // Remove existing meta
    const metas = meta.querySelectorAll('.suggestion-meta');
    metas.forEach(element => {
      element.remove();
    });

    // Append CWEs
    if (suggestion.cwe !== null && suggestion.cwe.length) {
      // add the new CWEs
      suggestion.cwe.forEach(cwe => {
        meta.insertAdjacentHTML(
          'afterbegin',
          '<a href="https://cwe.mitre.org/data/definitions/' +
            cwe.split('-')[1] +
            '.html" class="suggestion-meta suggestion-cwe">' +
            cwe +
            '</a>',
        );
      });
    }

    // Append issue type in the meta section
    meta.insertAdjacentHTML('afterbegin', '<span id="suggestion-type" class="suggestion-meta">' + type + '</span>');

    // Append line number
    const issuePosition = document.getElementById('navigateToIssue')!;
    issuePosition.innerHTML = '';
    issuePosition.insertAdjacentHTML(
      'afterbegin',
      'Position: line <a id="line-position">' + (Number(suggestion.rows[0]) + 1).toString() + '</a>',
    );

    if (currentSeverity && currentSeverity.text) {
      severity.querySelectorAll('img').forEach(n => {
        if (n.id.includes(currentSeverity.value)) {
          n.className = 'icon';
          severity.setAttribute('title', currentSeverity.text);
        } else {
          n.className = 'icon hidden';
        }
      });
    } else {
      severity.querySelectorAll('img').forEach(n => (n.className = 'icon hidden'));
    }

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

    const moreInfo = document.getElementById('lead-url')!;
    moreInfo.className = suggestion.leadURL ? 'clickable' : 'clickable hidden';

    const suggestionPosition2 = document.getElementById('line-position2')!;
    suggestionPosition2.innerHTML = (Number(suggestion.rows[0]) + 1).toString();

    const dataset = document.getElementById('dataset-number')!;
    const infoTop = document.getElementById('info-top')!;
    if (suggestion.repoDatasetSize) {
      dataset.innerHTML = suggestion.repoDatasetSize.toString();
      infoTop.className = 'font-light';
    } else {
      infoTop.className = 'font-light hidden';
    }

    const exampleTop = document.getElementById('example-top')!;
    const example = document.getElementById('example')!;
    const noExamples = document.getElementById('info-no-examples')!;
    if (suggestion?.exampleCommitFixes?.length) {
      exampleTop.className = 'row between';
      example.className = '';
      const exNum = document.getElementById('example-number')!;
      exNum.innerHTML = suggestion.exampleCommitFixes.length.toString();
      const exNum2 = document.getElementById('example-number2')!;
      exNum2.innerHTML = suggestion.exampleCommitFixes.length.toString();
      noExamples.className = 'hidden';
      showCurrentExample();
    } else {
      exampleTop.className = 'row between hidden';
      example.className = 'hidden';
      noExamples.className = 'font-light';
    }
  }

  function showSuggestionDetails(suggestion: Suggestion) {
    const suggestionDetails = document.querySelector('#suggestion-details') as HTMLElement;
    const readMoreBtn = document.querySelector('.read-more-btn') as HTMLElement;

    if (!suggestion || !suggestion.text || !suggestionDetails || !readMoreBtn) {
      return;
    }

    suggestionDetails.innerHTML = suggestion.text;
    suggestionDetails.classList.add('collapsed');

    readMoreBtn.style.display = 'block';

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

  document.getElementById('navigateToIssue')!.addEventListener('click', navigateToIssue.bind(undefined));
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
