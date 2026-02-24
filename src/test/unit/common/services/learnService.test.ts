import { strictEqual } from 'assert';
import sinon from 'sinon';
import { SNYK_GET_LESSON_COMMAND } from '../../../../snyk/common/constants/commands';
import { CodeIssueData, Issue, IssueSeverity } from '../../../../snyk/common/languageServer/types';
import { LearnService } from '../../../../snyk/common/services/learnService';
import { CommandsMock } from '../../mocks/commands.mock';

suite('LearnService', () => {
  let commandsMock: CommandsMock;
  let learnService: LearnService;

  setup(() => {
    commandsMock = new CommandsMock();
    learnService = new LearnService(commandsMock);
  });

  teardown(() => {
    sinon.restore();
  });

  test('getCodeLesson executes correct command', async () => {
    const issue: Issue<CodeIssueData> = {
      id: 'javascript/nosqli',
      range: {
        start: {
          line: 1,
          character: 2,
        },
        end: {
          line: 3,
          character: 4,
        },
      },
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
      contentRoot: '//folderName',
      isIgnored: false,
      isNew: false,
      filterableIssueType: 'Code Security',
    };

    await learnService.getCodeLesson(issue);
    strictEqual(commandsMock.executeCommand.calledOnce, true);
    strictEqual(
      commandsMock.executeCommand.calledWith(SNYK_GET_LESSON_COMMAND, 'nosqli', 'javascript', 'CWE-79', '', 2),
      true,
    );
  });
});
