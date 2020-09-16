import * as vscode from 'vscode';
import * as path from 'path';
import DeepCode from "../../interfaces/DeepCodeInterfaces";
import { createIssueCorrectRange, getVSCodeSeverity } from "../utils/analysisUtils";
import { DEEPCODE_VIEW_SUGGESTION } from "../constants/views";
import {
  DEEPCODE_IGNORE_ISSUE_COMMAND,
  DEEPCODE_OPEN_BROWSER_COMMAND,
  DEEPCODE_OPEN_LOCAL_COMMAND,
} from "../constants/commands";

// This is outside of the class just for a stylistic choice, to have clear indentation structure.
// NOTES: tags must be closed by matching pairs (<tag/> is not valid)
function getWebviewContent(images: Record<string,string>) { return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DeepCode Suggestion</title>
    <style>
      body {
        background-color: #fff;
        color: #231F20;
      }
      section {
        padding: 20px
      }
      .suggestion {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }
      .font-light {
        color: #676C6F;
      }
      .font-blue {
        color: #01b9f7;
      }
      .font-red {
        color: #FC3838;
      }
      .mark-message {
        font-weight: bold;
      }
      .mark-message:hover {
        color: #FC3838;
      }
      .hidden {
        display: none;
      }
      .clickable:hover {
        cursor: pointer;
      }
      .delimiter-top {
        border-top: 1px solid #e6f1f6;
      }
      .row {
        width: 100%;
        display: flex;
        flex-direction: row;
      }
      .row.between {
        justify-content: space-between;
      }
      .row.around {
        justify-content: space-around;
      }
      .row.center {
        justify-content: center;
      }
      .icon {
        display: inline-flex;
        vertical-align: middle;
        width: 16px;
        height: 16px;
      }
      .chip {
        display: inline-flex;
        padding: 2px 6px;
        margin: 3px;
        background: rgba(80, 200, 239, 0.1);
        color: #01b9f7;
        border-radius: 10px;
        text-transform: capitalize;
        transition: color 0.15s, background 0.15s;
      }
      #info-top {
        margin-bottom: 8px;
      }
      #example-top {
        margin-bottom: 16px;
      }
      .arrow {
        display: inline-flex;
        vertical-align: middle;
        cursor: pointer;
      }
      .arrow.enabled {
        fill: #01b9f7;
        color: #01b9f7;
      }
      .arrow:hover {
        fill: #01b9f7;
        color: #01b9f7;
      }
      .arrow.left {
        transform: rotate(90deg);
      }
      .arrow.right {
        transform: rotate(-90deg);
      }
      .arrow.down {
        transform: rotate(-180deg);
      }
      #example {
        border: 1px solid #c1dce9;
        border-radius: 3px;
        line-height: 1.5;
        width: 100%;
      }
      .example-line.removed {
        background: #ffeef0;
      }
      .example-line.added {
        background: #e6ffed;
      }
      .example-line>code {
        padding-left: 30px;
        white-space: pre-wrap;
        color: #231F20;
      }
      #explanations-top {
        margin-top: 16px;
        margin-bottom: 8px;
      }
      #ignore-top {
        margin-bottom: 8px;
        width: 100%;
        text-align: center;
      }
      .button {
        text-align: center;
        vertical-align: middle;
        padding: 1rem 1.5rem .9rem;
        border-radius: 30px;
        border: 1px #01b9f7 solid;
        background: none;
        color: #01b9f7;
        font-weight: 700;
        font-family: inherit;
        transition: all 0.25s;
        cursor: pointer;
      }
      .button.disabled {
        border: 1px #676C6F solid;
        color: #676C6F;
      }
      .button:hover {
        background: #01b9f7;
        color: #FFFFFF;
      }
      .button.disabled:hover {
        background: #676C6F;
      }
      #feedback-close {
        padding: 15px;
        border-radius: 5px;
        border: 1px solid #cce4f6;
        color: #676C6F;
      }
      #feedback-close:hover {
        color: #231F20;
        background: #e6f1f6;
      }
      #feedback-open {
        width: 100%;
      }
      #feedback-open {
        width: 100%;
      }
      #feedback-textarea {
        width: 100%;
      }
      #feedback-sent-message {
        width: 100%;
      }
    </style>
</head>
<body>
    <div class="suggestion">
      <section>
        <div id="title"></div>
        <div id="lead-url" class="clickable hidden" onclick="navigateToLeadURL()">
          <img class="icon" src="${images['icon-newwindow']}"></img>
          More info
        </div>
        <div class="clickable font-light" onclick="navigateToIssue()">
          <img class="icon" src="${images['icon-code']}"></img>
          Line <span id="line-position"></span>
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
        <div>
          <div id="explanations-top">
            Explanations from other repositories
          </div>
          <div id="explanations"></div>
        </div>
      </section>
      <section class="delimiter-top">
        <div id="ignore-top">
          Do you want to hide this suggestion from the results?
        </div>
        <div class="row around">
          <div class="button" onclick="ignoreIssue(true)">
            Ignore on line <span id="line-position2"></span>
          </div>
          <div class="button" onclick="ignoreIssue(false)">
            Ignore in this file
          </div>
        </div>
      </section>
      <section>
        <div id="feedback-close" onclick="toggleFeedbackVisibility()">
          <div class="row between">
            <div>A false positive? Helpful? Let us know here</div>
            <div class="arrow">»</div>
          </div>
        </div>
        <div id="feedback-open" class="hidden">
          <div>Feedback</div>
          <div>
            <label id="feedback-fp">
              <input type="checkbox" id="feedback-checkbox">
              False postive
            </label>
            <img class="icon" src="${images['light-icon-info']}" onclick="navigateToFP()"></img>
          </div>
          <div>
            <textarea id="feedback-textarea" rows="8" onInput="enableFeedback(this.value)"
              placeholder="Send us your feedback and comments for this suggestion - we love feedback!"
            ></textarea>
          </div>
          <div id="feedback-disclaimer">
            * This form will not send any of your code
          </div>
          <div class="row center">
            <img id="feedback-dislike" class="icon arrow down" src="${images['icon-like']}" onclick="likeFeedback(false)"></img>
            <img id="feedback-like enabled" class="icon arrow" src="${images['icon-like']}" onclick="likeFeedback(true)"></img>
          </div>
          <div id="feedback-send" class="button disabled" onclick="sendFeedback()"> Send </div>
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
          type: 'openLocal',
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
            project: 'vscode',
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
      function toggleFeedbackVisibility() {
        feedbackVisibility = 'open';
        showCurrentFeedback();
      }
      function showCurrentFeedback() {
        const fbClose = document.getElementById('feedback-close');
        fbClose.className = feedbackVisibility === 'close' ? "" : "hidden";
        const fbOpen = document.getElementById('feedback-open');
        fbOpen.className = feedbackVisibility === 'open' ? "" : "hidden";
        const fbSent = document.getElementById('feedback-sent');
        fbSent.className = feedbackVisibility === 'sent' ? "" : "hidden";
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
      function sendMessage(message) {
        vscode.postMessage(message);
      }
      window.addEventListener('message', event => {
        suggestion = event.data;
        vscode.setState(suggestion);

        const title = document.getElementById('title');
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
            markLine.className = "font-red";
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
        sendMessage({lead_url: suggestion.lead_url, leadURL: suggestion.leadURL});

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

        if (suggestion.exampleCommitFixes.length) {
          const dataset = document.getElementById('dataset-number');
          dataset.innerHTML = suggestion.repoDatasetSize;
          const exNum = document.getElementById('example-number');
          exNum.innerHTML = suggestion.exampleCommitFixes.length;
          const exNum2 = document.getElementById('example-number2');
          exNum2.innerHTML = suggestion.exampleCommitFixes.length;
          showCurrentExample();
        }

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
      });
    </script>
</body>
</html>
`;}

export class SuggestionProvider implements DeepCode.SuggestionProviderInterface {
  private extension: DeepCode.ExtensionInterface | undefined;
  public panel: vscode.WebviewPanel | undefined;

  activate(extension: DeepCode.ExtensionInterface) {
    this.extension = extension;
    vscode.window.registerWebviewPanelSerializer(
      DEEPCODE_VIEW_SUGGESTION, new SuggestionSerializer(this)
    );
  }

  show(suggestionId: string, filePath: string, position: vscode.Range): void {
    if (!this.extension) return;
    const suggestion = this.extension.analyzer.getFullSuggestion(suggestionId, filePath, position);
    if (!suggestion) return;
    this.showPanel(suggestion);
  }

  private disposePanel() {
    this.panel = undefined;
  }

  restorePanel(panel: vscode.WebviewPanel) {
    if(this.panel) this.panel.dispose();
    this.panel = panel;
  }

  showPanel(suggestion: DeepCode.completeAnalysisSuggestionsType) {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        DEEPCODE_VIEW_SUGGESTION,
        'DeepCode Suggestion',
        vscode.ViewColumn.Beside,
        {
          localResourceRoots: [
            vscode.Uri.file(path.join(__filename, '..', '..', '..', '..', 'images'))
          ],
          enableScripts: true
        }
      );
    }
    const images: Record<string,string> = [
      [ "icon-newwindow", "svg" ],
      [ "icon-code", "svg" ],
      [ "icon-github", "svg" ],
      [ "icon-like", "svg" ],
      [ "light-icon-info", "svg" ],
    ].reduce<Record<string,string>>((accumulator: Record<string,string>, [name, ext]) => {
      accumulator[name] = this.panel!.webview.asWebviewUri(vscode.Uri.file(
        path.join(__filename, '..', '..', '..', '..', 'images', `${name}.${ext}`))
      ).toString();
      return accumulator;
    },{});
    this.panel.webview.html = getWebviewContent(images);
    // This is just for persistence and serialization
    this.panel.webview.postMessage(suggestion);
    this.panel.onDidDispose(
      this.disposePanel.bind(this),
      null,
      this.extension?.context?.subscriptions
    );
    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      this.handleMessage.bind(this),
      undefined,
      this.extension?.context?.subscriptions
    );
  }

  async handleMessage(message: any) {
    if (!this.extension) return;
    try {
      const { type, args } = message;
      switch (type) {
        case 'openLocal' : {
          let { uri, cols, rows } = args;
          uri = vscode.Uri.parse(uri);
          const range = createIssueCorrectRange({ cols , rows });
          await vscode.commands.executeCommand(DEEPCODE_OPEN_LOCAL_COMMAND, uri, range);
          break;
        }
        case 'openBrowser' : {
          const { url } = args;
          await vscode.commands.executeCommand(DEEPCODE_OPEN_BROWSER_COMMAND, url);
          break;
        }
        case 'ignoreIssue' : {
          let { lineOnly, message, id, severity, uri, cols, rows } = args;
          uri = vscode.Uri.parse(uri);
          severity = getVSCodeSeverity(severity);
          const range = createIssueCorrectRange({ cols , rows });
          await vscode.commands.executeCommand(DEEPCODE_IGNORE_ISSUE_COMMAND, {
            uri,
            matchedIssue: { message, severity, range },
            issueId: id,
            isFileIgnore: !lineOnly,
          });
          this.panel?.dispose();
          break;
        }
        case 'sendFeedback' : {
          const { url } = args;
          await vscode.commands.executeCommand(DEEPCODE_OPEN_BROWSER_COMMAND, url);
          break;
        }
        default: {
          console.error("DeepCode: Failed to parse suggestion view message",message);
        }
      }
    } catch (e) {
      this.extension.processError(e, {
        //TODO
      })
    }
  }
}

class SuggestionSerializer implements vscode.WebviewPanelSerializer {
  private suggestionProvider: SuggestionProvider;
  constructor(suggestionProvider: SuggestionProvider) {
    this.suggestionProvider = suggestionProvider;
  }

  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
    // `state` is the state persisted using `setState` inside the webview
    console.log(`DeepCode: Restoring webview state: ${state}`);
    if (!state) {
      webviewPanel.dispose();
      return;
    }
    this.suggestionProvider.restorePanel(webviewPanel)
    this.suggestionProvider.showPanel(state);
  }
}