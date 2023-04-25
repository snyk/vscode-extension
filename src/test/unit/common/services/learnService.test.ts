import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
import { LearnService } from '../../../../snyk/common/services/learnService';
import { OssIssueCommandArg } from '../../../../snyk/snykOss/views/ossVulnerabilityTreeProvider';
import { CodeIssueData, Issue, IssueSeverity } from '../../../../snyk/common/languageServer/types';
import { completeFileSuggestionType } from '../../../../snyk/snykCode/interfaces';
import { AnalysisSeverity } from '@snyk/code-client';

suite('LearnService', () => {
  let commands: IVSCodeCommands;
  const executeCommandFake = sinon.fake();
  setup(() => {
    executeCommandFake.resetHistory();
    commands = {
      executeCommand: executeCommandFake,
    } as IVSCodeCommands;
  });

  teardown(() => {
    sinon.restore();
  });

  test('getOssLesson executes correct command', () => {
    const learnService = new LearnService(commands);

    const vulnerability: OssIssueCommandArg = {
      id: 'id',
      packageManager: 'packageManager',
    } as OssIssueCommandArg;

    void learnService.getOssLesson(vulnerability).then(() => {
      strictEqual(executeCommandFake.calledOnce, true);
      strictEqual(executeCommandFake.calledWith(vulnerability.id, vulnerability.packageManager), true);
    });
  });
  test('getCodeLesson executes correct command', () => {
    const learnService = new LearnService(commands);
    const issue: Issue<CodeIssueData> = {
      id: 'javascript/nosqli',
      additionalData: {
        ruleId: 'javascript/nosqli',
        cwe: ['CWE-79', 'CWE-89'],
        message: 'not used',
        rule: 'not used',
        repoDatasetSize: 100,
        exampleCommitFixes: [],
        text: 'not used',
        cols: [1, 2],
        rows: [1, 2],
        isSecurityType: true,
      },
      title: 'not used',
      severity: IssueSeverity.Critical,
      filePath: 'not used',
    };

    void learnService.getCodeLesson(issue).then(() => {
      strictEqual(executeCommandFake.calledOnce, true);
      strictEqual(executeCommandFake.calledWith('nosqli', 'javascript', 'CWE-79'), true);
    });
  });
  test('getCodeLessonOld executes correct command', () => {
    const learnService = new LearnService(commands);
    const issue: completeFileSuggestionType = {
      categories: [],
      cols: [0, 0],
      cwe: ['CWE-79', 'CWE-89'],
      exampleCommitDescriptions: [],
      exampleCommitFixes: [],
      isSecurityType: false,
      message: '',
      repoDatasetSize: 0,
      rows: [0, 0],
      rule: '',
      severity: AnalysisSeverity.critical,
      tags: [],
      text: '',
      title: '',
      uri: '',
      id: 'javascript/nosqli',
    };

    void learnService.getCodeLessonOld(issue).then(() => {
      strictEqual(executeCommandFake.calledOnce, true);
      strictEqual(executeCommandFake.calledWith('nosqli', 'javascript', 'CWE-79'), true);
    });
  });
});
