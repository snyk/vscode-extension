import { Marker } from '@snyk/code-client';
import path from 'path';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';

export class FalsePositive {
  readonly files: Set<string>;

  constructor(private workspace: IVSCodeWorkspace, suggestionFilePath: string, markers: Marker[]) {
    const markerPositions = markers.flatMap(marker => marker.pos);
    const filesArray = markerPositions.map(markerPosition =>
      this.getAbsoluteMarkerFilePath(markerPosition.file, suggestionFilePath),
    );

    this.files = new Set(filesArray);
  }

  getAbsoluteMarkerFilePath(filePath: string, suggestionFilePath: string): string {
    if (!filePath) {
      // If no filePath reported, use suggestion file path as marker's path. Suggestion path is always absolute.
      return suggestionFilePath;
    }

    const workspaceFolders = this.workspace.getWorkspaceFolders();
    if (workspaceFolders.length > 1) {
      return filePath;
    }

    // The Snyk Code analysis reported marker path is relative when in workspace with a single folder, thus need to convert to an absolute
    return path.resolve(workspaceFolders[0], filePath);
  }

  /**
   * May throw an error if file cannot be resolved.
   */
  async getContent(): Promise<string> {
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
