import sinon from 'sinon';
import { IVSCodeLanguages } from '../../../snyk/common/vscode/languages';
import { DiagnosticRelatedInformation, Position, Range as vsRange, Uri } from '../../../snyk/common/vscode/types';

export const languagesMock = {
  createDiagnostic: sinon.fake(),
  createDiagnosticCollection: sinon.fake(),
  registerCodeActionsProvider: sinon.fake(),
  registerHoverProvider: sinon.fake(),

  createDiagnosticRelatedInformation(
    uri: Uri,
    rangeOrPosition: vsRange | Position,
    message: string,
  ): DiagnosticRelatedInformation {
    const range = isRange(rangeOrPosition)
      ? rangeOrPosition
      : ({
          start: {
            line: rangeOrPosition.line,
            character: rangeOrPosition.character,
          },
          end: {
            line: rangeOrPosition.line,
            character: rangeOrPosition.character,
          },
        } as unknown as vsRange);

    return {
      message,
      location: {
        uri,
        range,
      },
    };
  },

  createRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): vsRange {
    return {
      start: {
        line: startLine,
        character: startCharacter,
      } as unknown as Position,
      end: {
        line: endLine,
        character: endCharacter,
      } as unknown as Position,
    } as unknown as vsRange;
  },
} as IVSCodeLanguages;

function isRange(pet: vsRange | Position): pet is vsRange {
  return (pet as vsRange).start !== undefined;
}
