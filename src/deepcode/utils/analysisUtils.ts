import * as vscode from "vscode";
import DeepCode from "../../interfaces/DeepCodeInterfaces";

export const createDeepCodeProgress = (progress: number): number => {
  const progressOffset = 100;
  return Math.round(progress * progressOffset);
};

export const createCorrectIssuePlacement = (
  item: DeepCode.IssuePositionsInterface
): { [key: string]: { [key: string]: number } } => {
  const rowOffset = 1;
  const createPosition = (i: number): number =>
    i - rowOffset < 0 ? 0 : i - rowOffset;
  return {
    cols: {
      start: createPosition(item.cols[0]),
      end: item.cols[1]
    },
    rows: {
      start: createPosition(item.rows[0]),
      end: createPosition(item.rows[1])
    }
  };
};

export const createIssueRange = (position: {
  [key: string]: { [key: string]: number };
}) => {
  return new vscode.Range(
    new vscode.Position(position.rows.start, position.cols.start),
    new vscode.Position(position.rows.end, position.cols.end)
  );
};

export const createIssueCorrectRange = (
  issuePosition: DeepCode.IssuePositionsInterface
): vscode.Range => {
  return createIssueRange({
    ...createCorrectIssuePlacement(issuePosition)
  });
};

export const findIssueWithRange = (
  matchingRange: vscode.Range | vscode.Position,
  issuesList: readonly vscode.Diagnostic[] | undefined
): vscode.Diagnostic | undefined => {
  return (
    issuesList &&
    issuesList.find((issue: vscode.Diagnostic) => {
      return issue.range.contains(matchingRange);
    })
  );
};

export const updateFileReviewResultsPositions = (
  analysisResultsCollection: DeepCode.AnalysisResultsCollectionInterface,
  updatedFile: DeepCode.openedTextEditorType
): DeepCode.AnalysisResultsFileResultsInterface => {
  const changesRange = updatedFile.contentChanges[0].range;
  const changesText = updatedFile.contentChanges[0].text;
  const goToNewLine = "\n";
  const offsetedline = changesRange.start.line + 1;
  const charOffset = 1;

  const fileIssuesList = {
    ...analysisResultsCollection[updatedFile.workspace].files[
      updatedFile.filePathInWorkspace
    ]
  };

  for (const issue in fileIssuesList) {
    for (const [index, position] of fileIssuesList[issue].entries()) {
      const currentLineIsOnEdgeOfIssueRange =
        offsetedline === position.rows[0] || offsetedline === position.rows[1];

      for (const row in position.rows) {
        if (offsetedline < position.rows[row]) {
          position.rows[row] += updatedFile.lineCount.prevOffset;
        } else if (offsetedline === position.rows[row]) {
          if (!changesRange.start.character && !changesRange.end.character) {
            position.rows[row] += updatedFile.lineCount.prevOffset;
          }
        }
      }

      if (
        currentLineIsOnEdgeOfIssueRange ||
        (offsetedline > position.rows[0] && offsetedline < position.rows[1])
      ) {
        // when chars are added
        if (
          changesText.length &&
          changesText !== goToNewLine &&
          currentLineIsOnEdgeOfIssueRange
        ) {
          if (
            changesRange.start.character < position.cols[0] &&
            changesText.includes(goToNewLine)
          ) {
            for (const char in position.cols) {
              position.cols[char] += changesText.length;
            }
          }
          // if char is inside issue range
          if (
            changesRange.start.character >= position.cols[0] &&
            changesRange.start.character <= position.cols[1]
          ) {
            position.cols[1] += changesText.length;
          }
        }
        // when chars are deleted
        if (
          updatedFile.contentChanges[0].rangeLength &&
          currentLineIsOnEdgeOfIssueRange
        ) {
          if (updatedFile.lineCount.prevOffset < 0 && !changesText) {
            continue;
          }
          if (
            changesRange.start.character < position.cols[0] &&
            !changesText.includes(goToNewLine)
          ) {
            for (const char in position.cols) {
              position.cols[char] =
                position.cols[char] > 0
                  ? position.cols[char] -
                    updatedFile.contentChanges[0].rangeLength
                  : 0;
            }
          }
          // if char is in issue range
          if (
            changesRange.start.character >= position.cols[0] &&
            changesRange.start.character <= position.cols[1]
          ) {
            position.cols[1] =
              position.cols[1] > 0
                ? position.cols[1] - updatedFile.contentChanges[0].rangeLength
                : 0;
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
