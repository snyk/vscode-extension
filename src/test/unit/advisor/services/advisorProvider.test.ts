import { notStrictEqual, strictEqual } from 'assert';
import AdvisorProvider from '../../../../snyk/advisor/services/advisorProvider';
import { ImportedModule } from '../../../../snyk/common/types';
import { LoggerMock } from '../../mocks/logger.mock';
import { advisorApiClientStub, postFake } from './advisorStubs';

suite('Advisor score provider.', () => {
  let advisorProvider: AdvisorProvider;

  const sampleFilePath = 'C:\\git\\project\\test.js';
  const sampleModuleName = 'mongo-express';
  const sampleImportedModule = {
    fileName: sampleFilePath,
    name: sampleModuleName,
    string: 'const x = require("mongo-express")',
    line: 1,
    loc: {
      start: {
        line: 1,
        column: 16,
      },
      end: {
        line: 1,
        column: 29,
      },
    },
  } as ImportedModule;

  const loggerMock = new LoggerMock();
  setup(() => {
    advisorProvider = new AdvisorProvider(advisorApiClientStub, loggerMock);
  });

  test('AdvisorProvider returns scores', async () => {
    const scores = await advisorProvider.getScores([sampleImportedModule]);

    notStrictEqual(scores, []);
    strictEqual(postFake.returned({ data: [] }), true);
  });
});
