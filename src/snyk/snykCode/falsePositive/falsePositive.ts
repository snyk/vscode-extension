import { Marker } from '@snyk/code-client';
import path from 'path';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import { completeFileSuggestionType } from '../interfaces';
import { IssueUtils } from '../utils/issueUtils';

export class FalsePositive {
  private files: Set<string>;

  readonly message: string;
  readonly id: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly primaryFilePath: string;
  readonly rule: string;
  content: string | undefined;

  constructor(private workspace: IVSCodeWorkspace, suggestion: completeFileSuggestionType) {
    if (!suggestion.markers || suggestion.markers.length === 0) {
      throw new Error('Cannot create false positive without markers.');
    }

    this.message = suggestion.message;
    this.id = decodeURIComponent(suggestion.id);
    this.rule = suggestion.rule;
    this.primaryFilePath = suggestion.uri;

    const issuePosition = IssueUtils.createCorrectIssuePlacement(suggestion);
    this.startLine = issuePosition.rows.start;
    this.endLine = issuePosition.rows.end;

    this.files = this.getFiles(suggestion.markers, suggestion.uri);
  }

  private getFiles(markers: Marker[], uri: string): Set<string> {
    const markerPositions = markers.flatMap(marker => marker.pos);
    const filesArray = markerPositions.map(markerPosition => FalsePositive.getAbsoluteMarkerFilePath(this.workspace, markerPosition.file, uri));

    return new Set(filesArray);
  }

  static getAbsoluteMarkerFilePath(workspace: IVSCodeWorkspace, markerFilePath: string, suggestionFilePath: string): string {
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
  }

  /**
   * May throw an error if file cannot be resolved.
   */
  async getGeneratedContent(): Promise<string> {
    let content = this.getMainHeader();

    for await (const file of this.files) {
      const doc = await this.workspace.openFileTextDocument(file);
      content += this.appendFileHeader(doc.getText(), file);
    }

    return content;
  }

  private getMainHeader() {
    return `/**
 * The following code will be uploaded to Snyk to be reviewed.
 * Make sure there are no sensitive information sent.
 */

`;
  }

  private appendFileHeader(text: string, filePath: string) {
    return `/**
 * Code from ${filePath}
 */
${text}`;
  }
}
