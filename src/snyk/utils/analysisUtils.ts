/* eslint-disable @typescript-eslint/no-array-constructor */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { IAnalysisResult, IFilePath, IFileSuggestion, IMarker, ISuggestion } from '@snyk/code-client';
import * as vscode from 'vscode';
import { completeFileSuggestionType, openedTextEditorType } from '../../interfaces/SnykInterfaces';
import {
  FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT,
  IGNORE_ISSUE_BASE_COMMENT_TEXT,
  IGNORE_ISSUE_REASON_TIP,
  SNYK_SEVERITIES,
} from '../constants/analysis';

export const createSnykSeveritiesMap = () => {
  const { information, error, warning } = SNYK_SEVERITIES;
  return {
    [information]: {
      name: vscode.DiagnosticSeverity.Information,
      show: true,
    },
    [warning]: { name: vscode.DiagnosticSeverity.Warning, show: true },
    [error]: { name: vscode.DiagnosticSeverity.Error, show: true },
  };
};

export const getVSCodeSeverity = (snykSeverity: number) => {
  const { information, error, warning } = SNYK_SEVERITIES;
  return (
    {
      [information]: vscode.DiagnosticSeverity.Information,
      [warning]: vscode.DiagnosticSeverity.Warning,
      [error]: vscode.DiagnosticSeverity.Error,
    }[snykSeverity] || vscode.DiagnosticSeverity.Information
  );
};

export const getSnykSeverity = (vscodeSeverity: vscode.DiagnosticSeverity) => {
  const { information, error, warning } = SNYK_SEVERITIES;
  return {
    [vscode.DiagnosticSeverity.Information]: information,
    [vscode.DiagnosticSeverity.Warning]: warning,
    [vscode.DiagnosticSeverity.Error]: error,
    [vscode.DiagnosticSeverity.Hint]: information,
  }[vscodeSeverity];
};

export const createSnykProgress = (progress: number): number => {
  const progressOffset = 100;
  return Math.round(progress * progressOffset);
};

export const createCorrectIssuePlacement = (item: IFileSuggestion): { [key: string]: { [key: string]: number } } => {
  const rowOffset = 1;
  const createPosition = (i: number): number => (i - rowOffset < 0 ? 0 : i - rowOffset);
  return {
    cols: {
      start: createPosition(item.cols[0]),
      end: item.cols[1],
    },
    rows: {
      start: createPosition(item.rows[0]),
      end: createPosition(item.rows[1]),
    },
  };
};

export const createIssueRange = (position: { [key: string]: { [key: string]: number } }) => {
  return new vscode.Range(
    new vscode.Position(position.rows.start, position.cols.start),
    new vscode.Position(position.rows.end, position.cols.end),
  );
};

export const createIssueCorrectRange = (issuePosition: IFileSuggestion): vscode.Range => {
  return createIssueRange({
    ...createCorrectIssuePlacement(issuePosition),
  });
};

export const findIssueWithRange = (
  matchingRange: vscode.Range | vscode.Position,
  issuesList: readonly vscode.Diagnostic[] | undefined,
): vscode.Diagnostic | undefined => {
  return (
    issuesList &&
    issuesList.find((issue: vscode.Diagnostic) => {
      return issue.range.contains(matchingRange);
    })
  );
};

export const updateFileReviewResultsPositions = (
  analysisResults: IAnalysisResult,
  updatedFile: openedTextEditorType,
): IFilePath => {
  const changesRange = updatedFile.contentChanges[0].range;
  const changesText = updatedFile.contentChanges[0].text;
  const goToNewLine = '\n';
  // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
  const offsetedline = changesRange.start.line + 1;
  const charOffset = 1;

  const fileIssuesList = {
    ...analysisResults.files[updatedFile.fullPath],
  };
  for (const issue in fileIssuesList) {
    if (!Object.prototype.hasOwnProperty.call(fileIssuesList, issue)) {
      continue;
    }

    for (const [index, position] of fileIssuesList[issue].entries()) {
      const currentLineIsOnEdgeOfIssueRange = offsetedline === position.rows[0] || offsetedline === position.rows[1];

      for (const row in position.rows) {
        if (offsetedline < position.rows[row]) {
          position.rows[row] += updatedFile.lineCount.prevOffset;
        } else if (offsetedline === position.rows[row]) {
          if (changesRange.start.character < position.rows[row]) {
            position.rows[row] += updatedFile.lineCount.prevOffset;
          }
        }
      }

      if (currentLineIsOnEdgeOfIssueRange || (offsetedline > position.rows[0] && offsetedline < position.rows[1])) {
        // when chars are added
        if (changesText.length && changesText !== goToNewLine && currentLineIsOnEdgeOfIssueRange) {
          if (changesRange.start.character < position.cols[0] && !changesText.includes(goToNewLine)) {
            for (const col in position.cols) {
              if (!Object.prototype.hasOwnProperty.call(position.cols, col)) continue;
              position.cols[col] += changesText.length;
            }
          }
          // if char is inside issue range
          if (changesRange.start.character >= position.cols[0] && changesRange.start.character <= position.cols[1]) {
            position.cols[1] += changesText.length;
          }
        }
        // when chars are deleted
        if (updatedFile.contentChanges[0].rangeLength && currentLineIsOnEdgeOfIssueRange) {
          if (updatedFile.lineCount.prevOffset < 0 && !changesText) {
            continue;
          }
          if (changesRange.start.character < position.cols[0] && !changesText.includes(goToNewLine)) {
            for (const char in position.cols) {
              if (!Object.prototype.hasOwnProperty.call(position.cols, char)) continue;
              position.cols[char] =
                position.cols[char] > 0 ? position.cols[char] - updatedFile.contentChanges[0].rangeLength : 0;
            }
          }
          // if char is in issue range
          if (changesRange.start.character >= position.cols[0] && changesRange.start.character <= position.cols[1]) {
            position.cols[1] = position.cols[1] > 0 ? position.cols[1] - updatedFile.contentChanges[0].rangeLength : 0;
          }
        }
        // hide issue
        if (position.cols[0] - charOffset === position.cols[1]) {
          fileIssuesList[issue].splice(index, 1);
        }
        position.cols[0] = position.cols[0] > 0 ? position.cols[0] : 0;
        position.cols[1] = position.cols[1] > 0 ? position.cols[1] : 0;
      }
    }
  }
  return fileIssuesList;
};

export const createIssueMarkerMsg = (originalMsg: string, [markerStartIdx, markerEndIdx]: number[]): string => {
  return originalMsg.substring(markerStartIdx, markerEndIdx + 1);
};

export const createIssuesMarkersDecorationOptions = (
  currentFileReviewIssues: readonly vscode.Diagnostic[] | undefined,
): vscode.DecorationOptions[] => {
  if (!currentFileReviewIssues) {
    return [];
  }
  const issueMarkersDecorationOptions = currentFileReviewIssues.reduce((markersRanges, issue) => {
    if (issue.relatedInformation) {
      for (const markerInfo of issue.relatedInformation) {
        markersRanges.push({
          range: markerInfo.location.range,
          hoverMessage: markerInfo.message,
        });
      }
    }
    return markersRanges;
  }, Array());
  return issueMarkersDecorationOptions;
};

export const createIssueRelatedInformation = (
  markersList: IMarker[],
  fileUri: vscode.Uri,
  message: string,
): vscode.DiagnosticRelatedInformation[] => {
  return markersList.reduce((res, marker) => {
    const { msg: markerMsgIdxs, pos: positions } = marker;

    positions.forEach(position => {
      const relatedInfo = new vscode.DiagnosticRelatedInformation(
        new vscode.Location(fileUri, createIssueCorrectRange(position)),
        createIssueMarkerMsg(message, markerMsgIdxs),
      );
      res.push(relatedInfo);
    });

    return res;
  }, Array());
};

export const findCompleteSuggestion = (
  analysisResults: IAnalysisResult,
  suggestionId: string,
  uri: vscode.Uri,
  position: vscode.Range,
): completeFileSuggestionType | undefined => {
  let filePath = uri.fsPath;
  if (!analysisResults.files[filePath]) return;
  const file: IFilePath = analysisResults.files[filePath];
  let fileSuggestion: IFileSuggestion | undefined;
  let suggestionIndex: string | number | undefined = Object.keys(file).find(i => {
    const index = parseInt(i, 10);
    if (analysisResults.suggestions[index].id !== suggestionId) return false;
    const pos = file[index].find(fs => {
      const r = createIssueCorrectRange(fs);
      return (
        r.start.character === position.start.character &&
        r.start.line === position.start.line &&
        r.end.character === position.end.character &&
        r.end.line === position.end.line
      );
    });
    if (pos) {
      fileSuggestion = pos;
      return true;
    }
    return false;
  });
  if (!fileSuggestion || !suggestionIndex) return;
  suggestionIndex = parseInt(suggestionIndex, 10);
  const suggestion = analysisResults.suggestions[suggestionIndex];
  if (!suggestion) return;
  // eslint-disable-next-line consistent-return
  return {
    uri: uri.toString(),
    ...suggestion,
    ...fileSuggestion,
  };
};

export const checkCompleteSuggestion = (
  analysisResults: IAnalysisResult,
  suggestion: completeFileSuggestionType,
): boolean => {
  let filePath = vscode.Uri.parse(suggestion.uri).fsPath;
  if (!analysisResults.files[filePath]) return false;
  const file: IFilePath = analysisResults.files[filePath];
  let suggestionIndex: string | undefined = Object.keys(file).find(i => {
    const index = parseInt(i, 10);
    if (
      analysisResults.suggestions[index].id !== suggestion.id ||
      analysisResults.suggestions[index].message !== suggestion.message
    )
      return false;
    const found = file[index].find(fs => {
      let equal = true;
      for (let dir of ['cols', 'rows']) {
        for (const ind of [0, 1]) {
          equal = equal && fs[dir][ind] === suggestion[dir][ind];
        }
      }
      return equal;
    });
    return !!found;
  });
  return !!suggestionIndex;
};

export const findSuggestionByMessage = (
  analysisResults: IAnalysisResult,
  suggestionName: string,
): ISuggestion | undefined => {
  return Object.values(analysisResults.suggestions).find(
    (suggestion: ISuggestion) => suggestion.message === suggestionName,
  );
};

export const ignoreIssueCommentText = (issueId: string, isFileIgnore?: boolean): string => {
  const snykComment = isFileIgnore ? FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT : IGNORE_ISSUE_BASE_COMMENT_TEXT;
  return `${snykComment} ${issueId}: ${IGNORE_ISSUE_REASON_TIP}`;
};

export const severityAsText = (severity: 1 | 2 | 3 | 4): 'Low' | 'Medium' | 'High' | 'Critical' => {
  switch (severity) {
    case 1:
      return 'Low';
    case 2:
      return 'Medium';
    case 3:
      return 'High';
    case 4:
      return 'Critical';
  }
};
