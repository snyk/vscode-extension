import sinon from 'sinon';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { createIssueRange } from '../../../../snyk/snykCode/utils/analysisUtils';
import { IssuePlacementPosition } from '../../../../snyk/snykCode/utils/issueUtils';

suite('Snyk Code Analysis Utils', () => {
  const createRangeMock = sinon.mock();
  let languages: IVSCodeLanguages;

  setup(() => {
    languages = ({
      createRange: createRangeMock,
    } as unknown) as IVSCodeLanguages;
  });

  teardown(() => createRangeMock.reset());

  test('Create issue range copes with non-negative values', () => {
    const position: IssuePlacementPosition = {
      cols: {
        start: 1,
        end: 1,
      },
      rows: {
        start: 1,
        end: 1,
      },
    };

    createIssueRange(position, languages);

    sinon.assert.calledOnceWithExactly(createRangeMock, 1, 1, 1, 1);
  });

  test('Create issue range copes with negative values', () => {
    const position: IssuePlacementPosition = {
      cols: {
        start: -1,
        end: -1,
      },
      rows: {
        start: -1,
        end: -1,
      },
    };

    createIssueRange(position, languages);

    sinon.assert.calledOnceWithExactly(createRangeMock, 0, 0, 0, 0);
  });
});
