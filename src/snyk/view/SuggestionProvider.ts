import { reportEvent } from '@snyk/code-client';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  completeFileSuggestionType,
  ExtensionInterface,
  SuggestionProviderInterface,
} from '../../interfaces/SnykInterfaces';
import { configuration } from '../configuration';
import { SNYK_IGNORE_ISSUE_COMMAND, SNYK_OPEN_BROWSER_COMMAND, SNYK_OPEN_LOCAL_COMMAND } from '../constants/commands';
import { SNYK_VIEW_SUGGESTION } from '../constants/views';
import { errorsLogs } from '../messages/errorsServerLogMessages';
import { createIssueCorrectRange, getVSCodeSeverity } from '../utils/analysisUtils';

// This is outside of the class just for a stylistic choice, to have clear indentation structure.
// NOTES: tags must be closed by matching pairs (<tag/> is not valid)
function getWebviewContent(images: Record<string, string>) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Snyk Suggestion</title>
    <style>
      html { height: 100%; font-size: 62.5% }
      body { height: 100%; padding: 0; font-size: 1.4rem; line-height: 1.5;  }
      body * { box-sizing: border-box }

      .button { vertical-align: middle; padding: .9rem 1.5rem 1rem; border: 1px #7754DB solid; border-radius: 30px; line-height: 1; background: none; color: #7754DB; text-align: center; font-weight: 700; font-family: inherit; transition: all 0.25s; cursor: pointer; }
      .button.disabled { border: 1px #676C6F solid; color: #676C6F; }
      .button:hover { background-color: #7754DB; color: #fff; }
      .button.disabled:hover { background-color: #676C6F; }

      .font-light { opacity: .75 }
      .font-blue { color: #7754DB; }
      .font-red { color: #FC3838; }

      .row { display: flex; flex-direction: row; width: 100%; }
      .row.between { justify-content: space-between; }
      .row.center { justify-content: center; }

      .vscode-light { background-color: rgba(0,0,0,.05); border-right: 1px solid rgba(0,0,0,.05); }
      .vscode-dark { background-color: rgba(255,255,255,.075); border-right: 1px solid rgba(255,255,255,.075); }
      .vscode-light .delimiter-top { border-top: 1px solid rgba(0,0,0,.05); }
      .vscode-dark .delimiter-top { border-top: 1px solid rgba(255,255,255,.075); }

      .icon { display: inline-flex; vertical-align: middle; width: 18px; height: 18px; }

      section { padding: 20px }
      .suggestion { position: relative; display: flex; flex-direction: column; width: 100%; height: 100%; }
      #suggestion-info { padding-left: 12rem }
      .suggestion-text { float:left; margin-bottom: 2rem; font-size:1.6rem; line-height: 1.6; }
      .suggestion-text.critical .mark-position { color: #CE5019 }
      .suggestion-text.warning .mark-position { color: #d68000 }
      .suggestion-text.info .mark-position { color: #88879e }
      .suggestion-text.critical .mark-message:hover { color: #CE5019 }
      .suggestion-text.warning .mark-message:hover { color: #d68000 }
      .suggestion-text.info .mark-message:hover { color: #88879e }
      .mark-message { font-weight: bold; }

      #severity { display:flex; flex-direction: column; flex-grow: 0; float:left; width:80px; margin:1rem 0 0 -10rem; text-align: center }
      #severity .icon { width: 32px; height: 32px; margin: 0 auto 10px;  }
      #severity-text {  }

      .vscode-dark .light-only { display: none; }
      .vscode-light .dark-only { display: none; }
      .hidden { display: none; }
      .clickable:hover { cursor: pointer; }

      .chip { opacity:.75; display: inline-flex; padding: 2px 8px; border-radius: 15px; margin: 3px; background-color: rgba(150, 150, 150, 0.15); text-transform: capitalize; }

      #info-top { margin-bottom: 8px; }
      #example-top { margin-bottom: 16px; }
      #explanations-group { padding-top:16px }

      .arrow { display: inline-flex; vertical-align: middle; cursor: pointer; }
      .arrow.enabled { fill: #7754DB; color: #7754DB; }
      .arrow:hover { fill: #7754DB; color: #7754DB; }
      .arrow.left { transform: rotate(90deg); }
      .arrow.right { transform: rotate(-90deg); }
      .arrow.down { transform: rotate(-180deg); I }

      #example { width: 100%; border: 1px solid; border-radius: 3px; line-height: 1.5; background-color: #fff; font-weight: 600 }
      .vscode-light #example { border-color: rgba(0,0,0,.15) }
      .example-line.removed { background-color: #ffeef0; }
      .example-line.removed>code {font-weight:600 }
      .example-line.added { background-color: #e6ffed; }
      .example-line.added>code { font-weight:600 }
      .example-line>code { padding-left: 30px; white-space: pre-wrap; color: #231F20; font-weight:400 }
      #explanations-top { margin-top: 16px; margin-bottom: 8px; }

      .vscode-dark #example { border-color: rgba(255,255,255,.075); background-color: rgba(0,0,0,.15)  }
      .vscode-dark .removed { background-color:rgba(201,60,55,0.2); color:#fff }
      .vscode-dark .added { background-color:rgba(70,149,74,0.2); color:#fff }
      .vscode-dark .example-line>code { color: #ccc; font-weight:400 }
      .vscode-dark .added>code { color: #fff; }
      .vscode-dark .removed>code { color: #fff; }


      #ignore-top { width: 100%; margin-bottom: 8px; text-align: center; }
      .ignore-actions { justify-content: center }
      .ignore-actions .button { margin: 0 1rem 2rem }

      #feedback-close { padding: 15px; border-radius: 5px; border: 1px solid; }
      .vscode-light #feedback-close { border-color: rgba(0,0,0,.15); }
      .vscode-dark #feedback-close { border-color: rgba(255,255,255,.075); }
      #feedback-close:hover { background-color: rgba(80, 200, 239, 0.1); }
      #feedback-open { width: 100%; }
      .vscode-light #feedback-textarea { border-color: rgba(0,0,0,.15) }
      .vscode-dark #feedback-textarea { border-color: rgba(255,255,255,.075);  }
      #feedback-textarea { width: 100%; padding:5px; margin-top:1rem; line-height: 1.5 }
      #feedback-sent-message { width: 100%; }

      .suggestion-links { display:flex; width: 100%; line-height: 1 }
      #lead-url { margin-left: auto }

      .feedback-section { margin-top: auto }
      .false-positive { float:right; }

      .feedback-actions { justify-content: center }
      .feedback-actions .button { margin: 2rem 1rem }


    </style>
</head>
<body>
    <div class="suggestion">
      <section id="suggestion-info">
        <div id="severity">
          <img id="sev1l" class="icon light-only hidden" src="${images['dark-low-severity']}" />
          <img id="sev1d" class="icon dark-only hidden" src="${images['dark-low-severity']}" />
          <img id="sev2l" class="icon light-only hidden" src="${images['dark-medium-severity']}" />
          <img id="sev2d" class="icon dark-only hidden" src="${images['dark-medium-severity']}" />
          <img id="sev3l" class="icon light-only hidden" src="${images['dark-high-severity']}" />
          <img id="sev3d" class="icon dark-only hidden" src="${images['dark-high-severity']}" />
          <span id="severity-text"></span>
        </div>
        <div id="title" class="suggestion-text"></div>
        <div class="suggestion-links">
          <div class="clickable" onclick="navigateToIssue()">
            <img class="icon" src="${images['icon-lines']}" /> This issue happens on line <span id="line-position"></span>
          </div>
          <div id="lead-url" class="clickable hidden" onclick="navigateToLeadURL()">
            <img class="icon" src="${images['icon-external']}" /> More info
          </div>
        </div>
      </section>
      <section class="delimiter-top" id="labels"></section>
      <section class="delimiter-top">
        <div id="info-top" class="font-light">
          This issue was fixed by <span id="dataset-number"></span> projects. Here are <span id="example-number"></span> example fixes.
        </div>
        <div id="example-top" class="row between">
          <div class="clickable" onclick="navigateToCurrentExample()">
            <img class="icon" src="${images['icon-github']}"></img>
            <span id="example-link"></span>
          </div>
          <div>
            <div class="arrow left" onclick="previousExample()">▾</div>
            <span>
              Example <span id="example-counter">1</span>/<span id="example-number2"></span>
            </span>
            <div class="arrow right" onclick="nextExample()">▾</div>
          </div>
        </div>
        <div id="example"></div>
        <div id="explanations-group">
          <div id="explanations-top">Explanations from other repositories</div>
          <div id="explanations"></div>
        </div>
      </section>
      <section class="feedback-section delimiter-top" style="margin-top: auto">
        <div id="ignore-section">
          <div id="ignore-top">Do you want to hide this suggestion from the results?</div>
          <div class="ignore-actions row">
            <div class="button" onclick="ignoreIssue(true)">Ignore on line <span id="line-position2"></span></div>
            <div class="button" onclick="ignoreIssue(false)">Ignore in this file</div>
          </div>
        </div>
        <div id="feedback-close" onclick="openFeebackSection()">
          <div class="row between clickable">
            <span>A false positive? Helpful? Let us know here</span>
            <div class="arrow">»</div>
          </div>
        </div>
        <div id="feedback-open" class="hidden">
          <div>
            Feedback
            <label id="feedback-fp" class="false-positive">
              <input type="checkbox" id="feedback-checkbox">
              False postive
              <img class="icon" src="${images['light-icon-info']}" onclick="navigateToFP()"></img>
            </label>
          </div>
          <div>
            <textarea id="feedback-textarea" rows="8" onInput="enableFeedback(this.value)" placeholder="Send us your feedback and comments for this suggestion - we love feedback!"></textarea>
          </div>
          <div id="feedback-disclaimer">* This form will not send any of your code</div>
          <div class="row center hidden">
            <img id="feedback-dislike" class="icon arrow down" src="${images['icon-like']}" onclick="likeFeedback(false)"></img>
            <img id="feedback-like enabled" class="icon arrow" src="${images['icon-like']}" onclick="likeFeedback(true)"></img>
          </div>
          <div class="row feedback-actions">
            <div id="feedback-cancel" class="button" onclick="closeFeebackSection()"> Cancel </div>
            <div id="feedback-send" class="button disabled" onclick="sendFeedback()"> Send Feedback </div>
          </div>
        </div>
        <div id="feedback-sent" class="hidden">
          <div class="row center font-blue">Thank you for your feedback!</div>
        </div>
      </section>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      let exampleCount = 0;
      let feedbackVisibility = 'close';
      let feedbackLike = 3;
      let feedbackEnabled = false;
      let suggestion = {};

      function navigateToLeadURL() {
        if (!suggestion.leadURL) return;
        sendMessage({
          type: 'openBrowser',
          args: {
            url: suggestion.leadURL
          },
        });
      }
      function navigateToIssue(range) {
        sendMessage({
          type: 'openLocal',
          args: getSuggestionPosition(range),
        });
      }
      function navigateToCurrentExample() {
        const url = suggestion.exampleCommitFixes[exampleCount].commitURL;
        sendMessage({
          type: 'openBrowser',
          args: { url }
        });
      }
      function navigateToFP() {
        const url = "https://en.wikipedia.org/wiki/False_positives_and_false_negatives";
        sendMessage({
          type: 'openBrowser',
          args: { url }
        });
      }
      function ignoreIssue(lineOnly) {
        sendMessage({
          type: 'ignoreIssue',
          args: {
            ...getSuggestionPosition(),
            message: suggestion.message,
            rule: suggestion.rule,
            id: suggestion.id,
            severity: suggestion.severity,
            lineOnly: !!lineOnly
          }
        });
      }
      function sendFeedback() {
        if (!feedbackEnabled) return;
        const feedback = document.getElementById('feedback-textarea').value;
        const falsePositive = !!document.getElementById('feedback-checkbox').value ? 'yes' : 'no';
        const suggestionId = suggestion.id;
        sendMessage({
          type: 'sendFeedback',
          args: {
            feedback,
            falsePositive,
            suggestionId,
            rating: feedbackLike,
            project: suggestion.uri,
          }
        });
        feedbackVisibility = 'sent';
        showCurrentFeedback();
      }
      function getSuggestionPosition(range) {
        return {
          uri: suggestion.uri,
          rows: range ? range.rows : suggestion.rows,
          cols: range ? range.cols : suggestion.cols,
        }
      }
      function openFeebackSection() {
        feedbackVisibility = 'open';
        showCurrentFeedback();
      }
      function closeFeebackSection() {
        feedbackVisibility = 'close';
        showCurrentFeedback();
      }
      function showCurrentFeedback() {
        const fbClose = document.getElementById('feedback-close');
        fbClose.className = feedbackVisibility === 'close' ? "" : "hidden";
        const fbOpen = document.getElementById('feedback-open');
        fbOpen.className = feedbackVisibility === 'open' ? "" : "hidden";
        const fbSent = document.getElementById('feedback-sent');
        fbSent.className = feedbackVisibility === 'sent' ? "" : "hidden";

        const ignore = document.getElementById('ignore-section');
        ignore.className = feedbackVisibility === 'open' ? "hidden" : "";
      }
      function likeFeedback(like) {
        feedbackLike = like ? 5 : 1;
        const fbLike = document.getElementById('feedback-like');
        const fbDislike = document.getElementById('feedback-dislike');
        if (like) {
          fbDislike.className = "icon arrow down";
          fbLike.className = "icon arrow enabled";
        } else {
          fbDislike.className = "icon arrow down enabled";
          fbLike.className = "icon arrow";
        }
      }
      function enableFeedback(content) {
        feedbackEnabled = !!content;
        const fbSend = document.getElementById('feedback-send');
        if (content) fbSend.className = "button";
        else fbSend.className = "button disabled";
      }
      function previousExample() {
        if (!suggestion || !suggestion.exampleCommitFixes ||
          exampleCount <= 0
        ) return;
        --exampleCount;
        showCurrentExample();
      }
      function nextExample() {
        if (!suggestion || !suggestion.exampleCommitFixes ||
          exampleCount >= suggestion.exampleCommitFixes.length - 1
        ) return;
        ++exampleCount;
        showCurrentExample();
      }
      function showCurrentExample() {
        if (!suggestion || !suggestion.exampleCommitFixes.length ||
          exampleCount < 0 || exampleCount >= suggestion.exampleCommitFixes.length
        ) return;
        const counter = document.getElementById('example-counter');
        counter.innerHTML = exampleCount + 1;
        const url = suggestion.exampleCommitFixes[exampleCount].commitURL;
        const repo = url.match(/https?:\\/\\/[^\\/]+\\/([^\\/]+\\/[^\\/]+)/);
        if (repo && repo[1]) {
          const exLink = document.getElementById('example-link');
          exLink.innerHTML = repo[1];
        }
        const example = document.getElementById('example');
        example.querySelectorAll('*').forEach(n => n.remove());
        for (let l of suggestion.exampleCommitFixes[exampleCount].lines) {
          const line = document.createElement("div");
          line.className = "example-line "+l.lineChange;
          example.appendChild(line);
          const code = document.createElement("code");
          code.innerHTML = l.line;
          line.appendChild(code);
        }
      }
      function getCurrentSeverity() {
        const stringMap = {
          1: "Low",
          2: "Medium",
          3: "High"
        };
        return suggestion ? {
         value: suggestion.severity,
         text: stringMap[suggestion.severity],
        }: undefined;
      }
      function showCurrentSuggestion() {
        exampleCount = 0;
        const currentSeverity = getCurrentSeverity();
        const severity = document.getElementById('severity');
        const title = document.getElementById('title');

        if (currentSeverity && currentSeverity.text) {
          severity.querySelectorAll('img').forEach(n => {
            if (n.id.slice(-1) === 'l') {
              if (n.id.includes(currentSeverity.value)) n.className = 'icon light-only';
              else  n.className = 'icon light-only hidden';
            } else {
              if (n.id.includes(currentSeverity.value)) n.className = 'icon dark-only';
              else  n.className = 'icon dark-only hidden';
            }
          });
          const sevText = document.getElementById('severity-text');
          sevText.innerHTML = currentSeverity.text;
          title.className = "suggestion-text "+currentSeverity.text.toLowerCase();
        } else {
          severity.querySelectorAll('img').forEach(n => n.className = 'icon hidden');
          sevText.innerHTML = "";
        }

        title.querySelectorAll('*').forEach(n => n.remove());
        title.innerHTML = "";
        if (suggestion.markers && suggestion.markers.length) {
          let i = 0;
          for (let m of suggestion.markers) {
            const preText = suggestion.message.substring(i, m.msg[0]);
            const preMark = document.createTextNode(preText);
            title.appendChild(preMark);
            const mark = document.createElement("span");
            mark.className = "mark-message clickable";
            mark.onclick = function(){
              navigateToIssue(m.pos[0]);
            };
            title.appendChild(mark);
            const markMsg = document.createElement("span");
            markMsg.innerHTML = suggestion.message.substring(m.msg[0], m.msg[1] + 1);
            mark.appendChild(markMsg);
            let markLineText = " [";
            let first = true;
            for (let p of m.pos) {
              markLineText += (first ? "" : ", ") + ":" + p.rows[0];
              first = false;
            }
            markLineText += "]";
            const markLine = document.createElement("span");
            markLine.innerHTML = markLineText;
            markLine.className = "mark-position";
            mark.appendChild(markLine);
            i = m.msg[1] + 1;
          }
          const postText = suggestion.message.substring(i);
          const postMark = document.createTextNode(postText);
          title.appendChild(postMark);
        } else {
          title.innerHTML = suggestion.message;
        }

        const moreInfo = document.getElementById('lead-url');
        moreInfo.className = suggestion.leadURL ? "clickable" : "clickable hidden";

        const suggestionPosition = document.getElementById('line-position');
        suggestionPosition.innerHTML = suggestion.rows[0];
        const suggestionPosition2 = document.getElementById('line-position2');
        suggestionPosition2.innerHTML = suggestion.rows[0];

        const labels = document.getElementById('labels');
        labels.querySelectorAll('*').forEach(n => n.remove());
        for (let l of [...suggestion.categories, ...suggestion.tags]) {
          const chip = document.createElement("div");
          chip.className = "chip";
          chip.innerHTML = l;
          labels.appendChild(chip);
        }

        const dataset = document.getElementById('dataset-number');
        const infoTop = document.getElementById('info-top');
        if (suggestion.repoDatasetSize) {
          dataset.innerHTML = suggestion.repoDatasetSize;
          infoTop.className = "font-light";
        } else {
          infoTop.className = "font-light hidden";
        }

        const exampleTop = document.getElementById('example-top');
        const example = document.getElementById('example');
        if (suggestion.exampleCommitFixes.length) {
          exampleTop.className = "row between";
          example.className = "";
          const exNum = document.getElementById('example-number');
          exNum.innerHTML = suggestion.exampleCommitFixes.length;
          const exNum2 = document.getElementById('example-number2');
          exNum2.innerHTML = suggestion.exampleCommitFixes.length;
          showCurrentExample();
        } else {
          exampleTop.className = "row between hidden";
          example.className = "hidden";
        }

        const explanationTop = document.getElementById('explanations-top');
        explanationTop.className = suggestion.exampleCommitDescriptions.lenght ? '' : 'hidden';

        const explanations = document.getElementById('explanations');
        explanations.querySelectorAll('*').forEach(n => n.remove());
        for (let e of suggestion.exampleCommitDescriptions) {
          const exp = document.createElement("div");
          exp.className = "explanation font-light";
          exp.innerHTML = e;
          explanations.appendChild(exp);
        }

        feedbackVisibility = 'close';
        showCurrentFeedback();
      }
      function sendMessage(message) {
        vscode.postMessage(message);
      }
      window.addEventListener('message', event => {
        const { type, args } = event.data
        switch (type) {
          case 'set': {
            suggestion = args;
            vscode.setState(suggestion);
            break;
          }
          case 'get': {
            suggestion = vscode.getState();
            break;
          }
        }
        showCurrentSuggestion();
      });
    </script>
</body>
</html>
`;
}

export class SuggestionProvider implements SuggestionProviderInterface {
  private extension: ExtensionInterface | undefined;
  private panel: vscode.WebviewPanel | undefined;
  // For consistency reasons, the single source of truth for the current suggestion is the
  // panel state. The following field is only used in
  private suggestion: completeFileSuggestionType | undefined;

  activate(extension: ExtensionInterface) {
    this.extension = extension;
    vscode.window.registerWebviewPanelSerializer(SNYK_VIEW_SUGGESTION, new SuggestionSerializer(this));
  }

  show(suggestionId: string, uri: vscode.Uri, position: vscode.Range) {
    if (!this.extension) {
      this.disposePanel();
      return;
    }
    const suggestion = this.extension.analyzer.getFullSuggestion(suggestionId, uri, position);
    if (!suggestion) {
      this.disposePanel();
      return;
    }
    void this.showPanel(suggestion);
  }

  checkCurrentSuggestion() {
    if (!this.panel || !this.suggestion || !this.extension) return;
    const found = this.extension.analyzer.checkFullSuggestion(this.suggestion);
    if (!found) this.disposePanel();
  }

  private disposePanel() {
    if (this.panel) this.panel.dispose();
  }

  private onPanelDispose() {
    this.panel = undefined;
  }

  private checkVisibility(_e: vscode.WebviewPanelOnDidChangeViewStateEvent) {
    if (this.panel && this.panel.visible) {
      void this.panel.webview.postMessage({ type: 'get' });
    }
  }

  restorePanel(panel: vscode.WebviewPanel) {
    if (this.panel) this.panel.dispose();
    this.panel = panel;
  }

  async showPanel(suggestion: completeFileSuggestionType) {
    try {
      if (
        !vscode.window.activeTextEditor?.viewColumn ||
        !this.panel?.viewColumn ||
        this.panel.viewColumn !== vscode.ViewColumn.Two
      ) {
        // workaround for: https://github.com/microsoft/vscode/issues/71608
        // when resolved, we can set showPanel back to sync execution.
        await vscode.commands.executeCommand('workbench.action.focusSecondEditorGroup');
      }
      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.Two, true);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          SNYK_VIEW_SUGGESTION,
          'Snyk Suggestion',
          {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: true,
          },
          {
            localResourceRoots: [vscode.Uri.file(path.join(__filename, '..', '..', '..', '..', 'images'))],
            enableScripts: true,
          },
        );
      }
      const images: Record<string, string> = [
        ['icon-lines', 'svg'],
        ['icon-external', 'svg'],
        ['icon-code', 'svg'],
        ['icon-github', 'svg'],
        ['icon-like', 'svg'],
        ['light-icon-info', 'svg'],
        ['dark-high-severity', 'svg'],
        ['light-icon-warning', 'svg'],
        ['dark-medium-severity', 'svg'],
        ['light-icon-critical', 'svg'],
        ['dark-low-severity', 'svg'],
      ].reduce<Record<string, string>>((accumulator: Record<string, string>, [name, ext]) => {
        accumulator[name] = this.panel!.webview.asWebviewUri(
          vscode.Uri.file(path.join(__filename, '..', '..', '..', '..', 'images', `${name}.${ext}`)),
        ).toString();
        return accumulator;
      }, {});
      this.panel.webview.html = getWebviewContent(images);

      void this.panel.webview.postMessage({ type: 'set', args: suggestion });
      this.panel.onDidDispose(this.onPanelDispose.bind(this), null, this.extension?.context?.subscriptions);
      this.panel.onDidChangeViewState(
        this.checkVisibility.bind(this),
        undefined,
        this.extension?.context?.subscriptions,
      );
      // Handle messages from the webview
      this.panel.webview.onDidReceiveMessage(
        this.handleMessage.bind(this),
        undefined,
        this.extension?.context?.subscriptions,
      );
      this.suggestion = suggestion;
    } catch (e) {
      if (!this.extension) return;
      void this.extension.processError(e, {
        message: errorsLogs.suggestionView,
      });
    }
  }

  private async handleMessage(message: any) {
    if (!this.extension) return;
    try {
      const { type, args } = message;
      switch (type) {
        case 'openLocal': {
          let { uri, cols, rows } = args;
          uri = vscode.Uri.parse(uri);
          const range = createIssueCorrectRange({ cols, rows });
          await vscode.commands.executeCommand(SNYK_OPEN_LOCAL_COMMAND, uri, range);
          break;
        }
        case 'openBrowser': {
          const { url } = args;
          await vscode.commands.executeCommand(SNYK_OPEN_BROWSER_COMMAND, url);
          break;
        }
        case 'ignoreIssue': {
          // eslint-disable-next-line no-shadow
          let { lineOnly, message, id, rule, severity, uri, cols, rows } = args;
          uri = vscode.Uri.parse(uri);
          severity = getVSCodeSeverity(severity);
          const range = createIssueCorrectRange({ cols, rows });
          await vscode.commands.executeCommand(SNYK_IGNORE_ISSUE_COMMAND, {
            uri,
            matchedIssue: { message, severity, range },
            issueId: id,
            ruleId: rule,
            isFileIgnore: !lineOnly,
          });
          this.panel?.dispose();
          break;
        }
        case 'sendFeedback': {
          await this.sendFeedback({ data: args });
          break;
        }
        default: {
          throw new Error('Unknown message type');
        }
      }
    } catch (e) {
      void this.extension.processError(e, {
        message: errorsLogs.suggestionViewMessage,
        data: { message },
      });
    }
  }

  private async sendFeedback(data: { [key: string]: any } = {}) {
    await reportEvent({
      baseURL: configuration.baseURL,
      type: 'suggestionFeedback',
      source: configuration.source,
      ...(configuration.token && { sessionToken: configuration.token }),
      ...data,
    });
  }
}

class SuggestionSerializer implements vscode.WebviewPanelSerializer {
  private suggestionProvider: SuggestionProvider;
  constructor(suggestionProvider: SuggestionProvider) {
    this.suggestionProvider = suggestionProvider;
  }

  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any): Promise<void> {
    // `state` is the state persisted using `setState` inside the webview
    console.log(`Snyk: Restoring webview state: ${state}`);
    if (!state) {
      webviewPanel.dispose();
      return Promise.resolve();
    }
    this.suggestionProvider.restorePanel(webviewPanel);
    return this.suggestionProvider.showPanel(state);
  }
}
