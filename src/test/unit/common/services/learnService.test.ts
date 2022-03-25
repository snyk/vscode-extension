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
  isSecurityType: true,
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

const loggerMock = new LoggerMock();
const learnService = new LearnService(loggerMock, false);

suite('LearnService', () => {
  suite('OSS specific functionality', () => {
    test('convertOSSProjectTypeToEcosystem - will return the ecosystem of a package manager', () => {
      strictEqual(LearnService.convertOSSProjectTypeToEcosystem('npm'), 'javascript');
      strictEqual(LearnService.convertOSSProjectTypeToEcosystem('maven'), 'java');
    });

    test('convertOSSProjectTypeToEcosystem - returns "all" if package manager is not recognized', () => {
      strictEqual(LearnService.convertOSSProjectTypeToEcosystem('not-a-real-package-manager'), 'all');
    });

    test('getOSSIssueParams - returns ecosystem & cwes', () => {
      deepStrictEqual(LearnService.getOSSIssueParams(ossIssueCommandArgFixture), {
        ecosystem: 'javascript',
        cwes: ['CWE-1'],
      });
    });

    test('getLesson - resolves a lesson', async () => {
      const stub = sinon.stub(axios, 'get').resolves({ data: [lessonFixture] });
      const lesson = await learnService.getLesson(ossIssueCommandArgFixture, OpenCommandIssueType.OssVulnerability);
      deepStrictEqual(lesson, lessonFixture);
      deepStrictEqual(
        stub.calledOnceWith('/lessons', {
          baseURL: 'https://api.snyk.io/v1/learn',
          params: {
            cwe: ossIssueCommandArgFixture.identifiers?.CWE[0],
          },
        }),
        true,
      );
    });

    test('getLesson - returns null if issue license is truthy', async () => {
      sinon.stub(axios, 'get').resolves({ data: [lessonFixture] });
      const lesson = await learnService.getLesson(
        { ...ossIssueCommandArgFixture, license: 'AGPL' },
        OpenCommandIssueType.OssVulnerability,
      );
      deepStrictEqual(lesson, null);
    });
  });

  suite('CODE specific functionality', () => {
    test('convertCodeIdToEcosystem - gets the ecosystem from the id after / or url encoded slack (%2F)', () => {
      strictEqual(LearnService.convertCodeIdToEcosystem('javascript%2Fdc_interfile_project%2FSqli'), 'javascript');
      strictEqual(LearnService.convertCodeIdToEcosystem('javascript/dc_interfile_project/Sqli'), 'javascript');
    });

    test('convertCodeIdToEcosystem - invalid ecosystems returns all', () => {
      strictEqual(LearnService.convertCodeIdToEcosystem('notvalidecosystem/test'), 'all');
      strictEqual(LearnService.convertCodeIdToEcosystem(''), 'all');
      // @ts-expect-error - testing in case no string is given
      strictEqual(LearnService.convertCodeIdToEcosystem(undefined), 'all');
    });

    test('getCodeIssueParams - returns ecosystem & cwes', () => {
      deepStrictEqual(LearnService.getCodeIssueParams(codeIssueCommandArgFixture), {
        ecosystem: 'javascript',
        cwes: ['CWE-2'],
      });
    });

    test('getLesson - resolves a lesson', async () => {
      const stub = sinon.stub(axios, 'get').resolves({ data: [lessonFixture] });
      const lesson = await learnService.getLesson(codeIssueCommandArgFixture, OpenCommandIssueType.CodeIssue);
      deepStrictEqual(lesson, lessonFixture);
      deepStrictEqual(
        stub.calledOnceWith('/lessons', {
          baseURL: 'https://api.snyk.io/v1/learn',
          params: {
            cwe: codeIssueCommandArgFixture.cwe[0],
          },
        }),
        true,
      );
    });

    test('getLesson - returns null if issue isSecurityType is false', async () => {
      sinon.stub(axios, 'get').resolves({ data: [lessonFixture] });
      const lesson = await learnService.getLesson(
        { ...codeIssueCommandArgFixture, isSecurityType: false },
        OpenCommandIssueType.CodeIssue,
      );
      deepStrictEqual(lesson, null);
    });
  });

  suite('getLesson', () => {
    test('returns null if issueType is not known', async () => {
      const lesson = await learnService.getLesson(
        ossIssueCommandArgFixture,
        'not known' as unknown as OpenCommandIssueType,
      );
      deepStrictEqual(lesson, null);
    });

    test('returns null if the issue has no ecosystem or identifiers', async () => {
      const lessonNoCWE = await learnService.getLesson(
        { ...codeIssueCommandArgFixture, cwe: [] },
        OpenCommandIssueType.CodeIssue,
      );
      deepStrictEqual(lessonNoCWE, null);
      const lessonNoEcosystem = await learnService.getLesson(
        { ...codeIssueCommandArgFixture, id: '' },
        OpenCommandIssueType.CodeIssue,
      );
      deepStrictEqual(lessonNoEcosystem, null);
    });

    test('returns null if no lessons are returned', async () => {
      sinon.stub(axios, 'get').resolves({ data: [] });
      const lesson = await learnService.getLesson(ossIssueCommandArgFixture, OpenCommandIssueType.OssVulnerability);
      deepStrictEqual(lesson, null);
    });

    test('logs an error and returns null something goes wrong', async () => {
      sinon.stub(axios, 'get').rejects({ message: 'test error' });
      const loggerStub = sinon.stub(loggerMock, 'error').returns(undefined);

      const lesson = await learnService.getLesson(ossIssueCommandArgFixture, OpenCommandIssueType.OssVulnerability);
      deepStrictEqual(lesson, null);
      deepStrictEqual(loggerStub.getCall(0).args, ['Error getting Snyk Learn Lesson. {"message":"test error"}']);
    });

    test('sorts lessons by ecosystem', async () => {
      const javascriptFixture = { ...ossIssueCommandArgFixture, packageManager: 'npm' };
      const pythonLesson = { ...lessonFixture, ecosystem: 'python' };
      const javascriptLesson = { ...lessonFixture, ecosystem: 'javascript' };

      sinon.stub(axios, 'get').resolves({ data: [pythonLesson, javascriptLesson] });
      const lesson = await learnService.getLesson(javascriptFixture, OpenCommandIssueType.OssVulnerability);
      deepStrictEqual(lesson?.ecosystem, 'javascript');
    });

    test('caches lesson requests', async () => {
      const learnService = new LearnService(loggerMock, true);
      const stub = sinon.stub(axios, 'get').resolves({ data: [lessonFixture] });
      await learnService.getLesson(ossIssueCommandArgFixture, OpenCommandIssueType.OssVulnerability);
      deepStrictEqual(stub.calledOnce, true);
      await learnService.getLesson(ossIssueCommandArgFixture, OpenCommandIssueType.OssVulnerability);
      deepStrictEqual(stub.calledOnce, true);
    });
  });
});
