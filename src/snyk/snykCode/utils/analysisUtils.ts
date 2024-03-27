/* eslint-disable @typescript-eslint/no-array-constructor */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import path from 'path';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import {
  FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT,
  IGNORE_ISSUE_BASE_COMMENT_TEXT,
  IGNORE_ISSUE_REASON_TIP,
} from '../constants/analysis';

export const ignoreIssueCommentText = (issueId: string, isFileIgnore?: boolean): string => {
  const snykComment = isFileIgnore ? FILE_IGNORE_ISSUE_BASE_COMMENT_TEXT : IGNORE_ISSUE_BASE_COMMENT_TEXT;
  return `${snykComment} ${issueId}: ${IGNORE_ISSUE_REASON_TIP}`;
};

export const getAbsoluteMarkerFilePath = (
  workspace: IVSCodeWorkspace,
  markerFilePath: string,
  suggestionFilePath: string,
): string => {
  if (!markerFilePath) {
    // If no filePath reported, use suggestion file path as marker's path. Suggestion path is always absolute.
    return suggestionFilePath;
  }

  const workspaceFolders = workspace.getWorkspaceFolders();
  if (workspaceFolders.length > 1) {
    return markerFilePath;
  }

  // The Snyk Code analysis reported marker path is relative when in workspace with a single folder, thus need to convert to an absolute
  return path.resolve(workspaceFolders[0], markerFilePath);
};
