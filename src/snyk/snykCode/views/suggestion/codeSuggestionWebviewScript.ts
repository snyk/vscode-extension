/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/// <reference lib="dom" />

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  // TODO: Redefine types until bundling is introduced into extension
  // https://stackoverflow.com/a/56938089/1713082
  type Lesson = {
    url: string;
    title: string;
  };

  let lesson: Lesson | null;

  const vscode = acquireVsCodeApi();
  function navigateToUrl(url: string) {
    sendMessage({
      type: 'openBrowser',
      args: { url },
    });
  }

  let exampleCount = 0;
  let suggestion = {} as any;

  function navigateToLeadURL() {
    if (!suggestion.leadURL) return;
    navigateToUrl(suggestion.leadURL);
  }
  function navigateToIssue(_e: any, range: any) {
    sendMessage({
      type: 'openLocal',
      args: getSuggestionPosition(range),
    });
  }
  function navigateToCurrentExample() {
    const url = suggestion.exampleCommitFixes[exampleCount].commitURL;
    sendMessage({
      type: 'openBrowser',
      args: { url },
    });
  }
  function ignoreIssue(lineOnly: any) {
    sendMessage({
      type: 'ignoreIssue',
      args: {
        ...getSuggestionPosition(),
        message: suggestion.message,
        rule: suggestion.rule,
        id: suggestion.id,
        severity: suggestion.severity,
        lineOnly: !!lineOnly,
      },
    });
  }
  function openFalsePositiveCode() {
    sendMessage({
      type: 'openFalsePositive',
      args: {
        suggestion: suggestion,
      },
    });
  }
  function getSuggestionPosition(position?: { file: string; rows: any; cols: any }) {
    return {
      uri: position?.file ?? suggestion.uri,
      rows: position ? position.rows : suggestion.rows,
      cols: position ? position.cols : suggestion.cols,
      suggestionUri: suggestion.uri,
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
      !suggestion ||
      !suggestion.exampleCommitFixes.length ||
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
      1: 'Low',
      2: 'Medium',
      3: 'High',
    };
    return suggestion
      ? {
          value: suggestion.severity,
          text: stringMap[suggestion.severity],
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
    exampleCount = 0;
    const currentSeverity = getCurrentSeverity();
    const severity = document.getElementById('severity')!;
    const title = document.getElementById('title')!;

    // Display correct issue type text
    const issueType = document.getElementsByClassName('issue-type');
    for (const typeElement of issueType as any) {
      typeElement.innerHTML = suggestion.isSecurityType ? 'vulnerability' : 'issue';
    }

    const sevText = document.getElementById('severity-text')!;
    if (currentSeverity && currentSeverity.text) {
      severity.querySelectorAll('img').forEach(n => {
        if (n.id.slice(-1) === 'l') {
          if (n.id.includes(currentSeverity.value)) n.className = 'icon light-only';
          else n.className = 'icon light-only hidden';
        } else {
          if (n.id.includes(currentSeverity.value)) n.className = 'icon dark-only';
          else n.className = 'icon dark-only hidden';
        }
      });
      sevText.innerHTML = currentSeverity.text;
      title.className = `suggestion-text ${currentSeverity.text.toLowerCase()}`;
    } else {
      severity.querySelectorAll('img').forEach(n => (n.className = 'icon hidden'));
      sevText.innerHTML = '';
    }

    title.querySelectorAll('*').forEach(n => n.remove());
    title.innerHTML = '';
    if (suggestion.markers && suggestion.markers.length) {
      let i = 0;
      for (const m of suggestion.markers) {
        const preText = suggestion.message.substring(i, m.msg[0]);
        const preMark = document.createTextNode(preText);
        title.appendChild(preMark);
        const mark = document.createElement('span');
        mark.className = 'mark-message clickable';
        mark.onclick = function () {
          navigateToIssue(undefined, m.pos[0]);
        };
        title.appendChild(mark);
        const markMsg = document.createElement('span');
        markMsg.innerHTML = suggestion.message.substring(m.msg[0], (m.msg[1] as number) + 1);
        mark.appendChild(markMsg);
        let markLineText = ' [';
        let first = true;
        for (const p of m.pos) {
          markLineText += (first ? '' : ', ') + ':' + (p.rows[0] as string);
          first = false;
        }
        markLineText += ']';
        const markLine = document.createElement('span');
        markLine.innerHTML = markLineText;
        markLine.className = 'mark-position';
        mark.appendChild(markLine);
        i = (m.msg[1] as number) + 1;
      }
      const postText = suggestion.message.substring(i);
      const postMark = document.createTextNode(postText);
      title.appendChild(postMark);
    } else {
      title.innerHTML = suggestion.message;
    }

    const moreInfo = document.getElementById('lead-url')!;
    moreInfo.className = suggestion.leadURL ? 'clickable' : 'clickable hidden';

    const suggestionPosition = document.getElementById('line-position')!;
    suggestionPosition.innerHTML = suggestion.rows[0];
    const suggestionPosition2 = document.getElementById('line-position2')!;
    suggestionPosition2.innerHTML = suggestion.rows[0];

    const labels = document.getElementById('labels')!;
    labels.querySelectorAll('*').forEach(n => n.remove());
    for (const l of [...suggestion.categories, ...suggestion.tags]) {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = l;
      labels.appendChild(chip);
    }

    const dataset = document.getElementById('dataset-number')!;
    const infoTop = document.getElementById('info-top')!;
    if (suggestion.repoDatasetSize) {
      dataset.innerHTML = suggestion.repoDatasetSize;
      infoTop.className = 'font-light';
    } else {
      infoTop.className = 'font-light hidden';
    }

    const exampleTop = document.getElementById('example-top')!;
    const example = document.getElementById('example')!;
    const noExamples = document.getElementById('info-no-examples')!;
    if (suggestion.exampleCommitFixes.length) {
      exampleTop.className = 'row between';
      example.className = '';
      const exNum = document.getElementById('example-number')!;
      exNum.innerHTML = suggestion.exampleCommitFixes.length;
      const exNum2 = document.getElementById('example-number2')!;
      exNum2.innerHTML = suggestion.exampleCommitFixes.length;
      noExamples.className = 'hidden';
      showCurrentExample();
    } else {
      exampleTop.className = 'row between hidden';
      example.className = 'hidden';
      noExamples.className = 'font-light';
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
  document.getElementById('ignore-line-issue')!.addEventListener('click', ignoreIssue.bind(true));
  document.getElementById('ignore-file-issue')!.addEventListener('click', ignoreIssue.bind(false));
  document.getElementById('report-fp')?.addEventListener('click', openFalsePositiveCode);

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
