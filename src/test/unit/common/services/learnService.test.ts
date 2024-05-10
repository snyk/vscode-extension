import { strictEqual } from 'assert';
import sinon from 'sinon';
import { SNYK_GET_LESSON_COMMAND } from '../../../../snyk/common/constants/commands';
import { CodeIssueData, Issue, IssueSeverity } from '../../../../snyk/common/languageServer/types';
import { LearnService } from '../../../../snyk/common/services/learnService';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';

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

  test('getCodeLesson executes correct command', async () => {
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
        priorityScore: 880,
        hasAIFix: false,
        details: 'not used',
      },
      title: 'not used',
      severity: IssueSeverity.Critical,
      filePath: 'not used',
      isIgnored: false,
    };

    await learnService.getCodeLesson(issue);
    strictEqual(executeCommandFake.calledOnce, true);
    strictEqual(executeCommandFake.calledWith(SNYK_GET_LESSON_COMMAND, 'nosqli', 'javascript', 'CWE-79', '', 2), true);
  });
});
