import { deepStrictEqual } from 'assert';
import axios from 'axios';
import sinon from 'sinon';
import { OpenCommandIssueType } from '../../../../snyk/common/commands/types';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { LearnService } from '../../../../snyk/common/services/learnService';
import type { completeFileSuggestionType } from '../../../../snyk/snykCode/interfaces';
import { OssIssueCommandArg } from '../../../../snyk/snykOss/views/ossVulnerabilityTreeProvider';
import { LoggerMock } from '../../mocks/logger.mock';

suite('LearnService', () => {
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

  const config = {
    baseApiUrl: 'https://snyk.example.com/',
  } as unknown as IConfiguration;

  const loggerMock = new LoggerMock();
  const learnService = new LearnService(config, loggerMock, false);

  teardown(() => {
    sinon.restore();
  });

  suite('OSS specific functionality', () => {
    test('getOSSIssueParams - returns ecosystem & cwes', () => {
      deepStrictEqual(LearnService.getOSSIssueParams(ossIssueCommandArgFixture), {
        rule: ossIssueCommandArgFixture.id,
        ecosystem: ossIssueCommandArgFixture.packageManager,
        cwes: ossIssueCommandArgFixture.identifiers?.CWE,
        cves: ossIssueCommandArgFixture.identifiers?.CVE,
      });
    });

    test('getLesson - resolves a lesson', async () => {
      const stub = sinon.stub(axios, 'get').resolves({ data: { lessons: [lessonFixture] } });
      const lesson = await learnService.getLesson(ossIssueCommandArgFixture, OpenCommandIssueType.OssVulnerability);
      deepStrictEqual(lesson?.lessonId, lessonFixture.lessonId);
      deepStrictEqual(stub.getCall(0).args, [
        '/lessons/lookup-for-cta',
        {
          baseURL: `${config.baseApiUrl}/v1/learn`,
          params: {
            source: 'ide',
            rule: ossIssueCommandArgFixture.id,
            ecosystem: ossIssueCommandArgFixture.packageManager,
            cwe: 'CWE-1',
            cve: undefined,
          },
        },
      ]);
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
    test('getCodeIssueParams - returns ecosystem & cwes', () => {
      deepStrictEqual(LearnService.getCodeIssueParams(codeIssueCommandArgFixture), {
        ecosystem: 'javascript',
        rule: 'Sqli',
        cwes: ['CWE-2'],
      });
    });

    test('getLesson - resolves a lesson', async () => {
      const stub = sinon.stub(axios, 'get').resolves({ data: { lessons: [lessonFixture] } });
      const lesson = await learnService.getLesson(codeIssueCommandArgFixture, OpenCommandIssueType.CodeIssue);
      deepStrictEqual(lesson?.lessonId, lessonFixture.lessonId);
      deepStrictEqual(stub.getCall(0).args, [
        '/lessons/lookup-for-cta',
        {
          baseURL: `${config.baseApiUrl}/v1/learn`,
          params: {
            source: 'ide',
            cwe: codeIssueCommandArgFixture.cwe[0],
            rule: 'Sqli',
            ecosystem: 'javascript',
            cve: undefined,
          },
        },
      ]);
    });

    test('getLesson - returns null if issue isSecurityType is false', async () => {
      sinon.stub(axios, 'get').resolves({ data: { lessons: [lessonFixture] } });
      const lesson = await learnService.getLesson(
        { ...codeIssueCommandArgFixture, isSecurityType: false },
        OpenCommandIssueType.CodeIssue,
      );
      deepStrictEqual(lesson, null);
    });
  });

  suite('getLesson', () => {
    test('adds loc=ide query parameter to lesson url', async () => {
      const lessonFixtureWithQueryParams = {
        ...lessonFixture,
        url: 'https://example.com/?test=true',
      };
      sinon.stub(axios, 'get').resolves({ data: { lessons: [lessonFixtureWithQueryParams] } });
      const lesson = await learnService.getLesson(ossIssueCommandArgFixture, OpenCommandIssueType.OssVulnerability);
      deepStrictEqual(lesson?.url, `${lessonFixtureWithQueryParams.url}&loc=ide`);
    });

    test('returns null if issueType is not known', async () => {
      const lesson = await learnService.getLesson(
        ossIssueCommandArgFixture,
        'not known' as unknown as OpenCommandIssueType,
      );
      deepStrictEqual(lesson, null);
    });

    test('returns null if the issue has no params', async () => {
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
      sinon.stub(axios, 'get').resolves({ data: { lessons: [] } });
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

    test('caches lesson requests', async () => {
      const learnService = new LearnService(config, loggerMock, true);
      const stub = sinon.stub(axios, 'get').resolves({ data: { lessons: [] } });
      await learnService.getLesson(ossIssueCommandArgFixture, OpenCommandIssueType.OssVulnerability);
      deepStrictEqual(stub.calledOnce, true);
      await learnService.getLesson(ossIssueCommandArgFixture, OpenCommandIssueType.OssVulnerability);
      deepStrictEqual(stub.calledOnce, true);
    });
  });
});
