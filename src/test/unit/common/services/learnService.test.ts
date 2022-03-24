import { deepStrictEqual, strictEqual } from 'assert';
import axios from 'axios';
import sinon from 'sinon';
import { OpenCommandIssueType } from '../../../../snyk/common/commands/types';
import { LearnService } from '../../../../snyk/common/services/learnService';
import type { completeFileSuggestionType } from '../../../../snyk/snykCode/interfaces';
import { OssIssueCommandArg } from '../../../../snyk/snykOss/views/ossVulnerabilityTreeProvider';
import { LoggerMock } from '../../mocks/logger.mock';

const ossIssueCommandArgFixture = { identifiers: { CWE: ['CWE-1'] }, packageManager: 'npm' } as OssIssueCommandArg;
const codeIssueCommandArgFixture = {
  cwe: ['CWE-2'],
  id: 'javascript%2Fdc_interfile_project%2FSqli',
} as completeFileSuggestionType;
const lessonFixture = {
  title: 'lesson title',
  lessonId: 'id',
  ecosystem: 'javascript',
  url: 'https://example.com',
};

teardown(() => {
  sinon.restore();
});

suite('OSS functionality', () => {
  suite('convertOSSProjectTypeToEcosystem', () => {
    test('will return the ecosystem of a package manager', () => {
      strictEqual(LearnService.convertOSSProjectTypeToEcosystem('npm'), 'javascript');
      strictEqual(LearnService.convertOSSProjectTypeToEcosystem('maven'), 'java');
    });

    test('returns "all" if package manager is not recognized', () => {
      strictEqual(LearnService.convertOSSProjectTypeToEcosystem('not-a-real-package-manager'), 'all');
    });
  });

  suite('getLesson', () => {
    test('resolves a lesson', async () => {
      const service = new LearnService(
        ossIssueCommandArgFixture,
        OpenCommandIssueType.OssVulnerability,
        new LoggerMock(),
      );
      const stub = sinon.stub(axios, 'get').resolves({ data: [lessonFixture] });
      const lesson = await service.getLesson();
      deepStrictEqual(lesson, lessonFixture);
      deepStrictEqual(stub.calledOnceWith('https://api.snyk.io/v1/learn/lessons?cwe=CWE-1'), true);
    });
  });
});

suite('CODE functionality', () => {
  suite('convertCodeIdToEcosystem', () => {
    test('gets the ecosystem from the id after / or url encoded slack (%2F)', () => {
      strictEqual(LearnService.convertCodeIdToEcosystem('javascript%2Fdc_interfile_project%2FSqli'), 'javascript');
      strictEqual(LearnService.convertCodeIdToEcosystem('javascript/dc_interfile_project/Sqli'), 'javascript');
    });

    test('invalid ecosystems returns all', () => {
      strictEqual(LearnService.convertCodeIdToEcosystem('notvalidecosystem/test'), 'all');
      strictEqual(LearnService.convertCodeIdToEcosystem(''), 'all');
      strictEqual(LearnService.convertCodeIdToEcosystem((undefined as unknown) as string), 'all');
    });
  });

  suite('getLesson', () => {
    test('resolves a lesson', async () => {
      const service = new LearnService(codeIssueCommandArgFixture, OpenCommandIssueType.CodeIssue, new LoggerMock());
      const stub = sinon.stub(axios, 'get').resolves({ data: [lessonFixture] });
      const lesson = await service.getLesson();
      deepStrictEqual(lesson, lessonFixture);
      deepStrictEqual(stub.calledOnceWith('https://api.snyk.io/v1/learn/lessons?cwe=CWE-2'), true);
    });
  });
});

suite('getLesson', () => {
  test('sorts lessons by ecosystem', async () => {
    const javascriptFixture = { ...ossIssueCommandArgFixture, packageManager: 'npm' };
    const service = new LearnService(javascriptFixture, OpenCommandIssueType.OssVulnerability, new LoggerMock());

    const pythonLesson = { ...lessonFixture, ecosystem: 'python' };
    const javascriptLesson = { ...lessonFixture, ecosystem: 'javascript' };

    sinon.stub(axios, 'get').resolves({ data: [pythonLesson, javascriptLesson] });
    const lesson = await service.getLesson();
    deepStrictEqual(lesson?.ecosystem, 'javascript');
  });

  test('returns null if no lessons are returned', async () => {
    const service = new LearnService(
      ossIssueCommandArgFixture,
      OpenCommandIssueType.OssVulnerability,
      new LoggerMock(),
    );
    sinon.stub(axios, 'get').resolves({ data: [] });
    const lesson = await service.getLesson();
    deepStrictEqual(lesson, null);
  });

  test('logs an error and returns null something goes wrong', async () => {
    const loggerMock = new LoggerMock();
    const service = new LearnService(ossIssueCommandArgFixture, OpenCommandIssueType.OssVulnerability, loggerMock);
    sinon.stub(axios, 'get').rejects({ message: 'test error' });
    const loggerStub = sinon.stub(loggerMock, 'error').returns(undefined);

    const lesson = await service.getLesson();
    deepStrictEqual(lesson, null);
    deepStrictEqual(loggerStub.calledOnceWith('error getting snyk learn lesson'), true);
  });
});
