import { Command, Range } from 'vscode';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_OPEN_ISSUE_COMMAND, VSCODE_GO_TO_SETTINGS_COMMAND } from '../../common/constants/commands';
import { CodeIssueData, Issue } from '../../common/languageServer/types';
import { IContextService } from '../../common/services/contextService';
import { IProductService } from '../../common/services/productService';
import { ProductIssueTreeProvider } from '../../common/views/issueTreeProvider';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { messages } from '../messages/analysis';
import { messages as analysisMessages } from '../../common/messages/analysisMessages';
import { IssueUtils } from '../utils/issueUtils';
import { CodeIssueCommandArg } from './interfaces';
import { IFolderConfigs } from '../../common/configuration/folderConfigs';
import { ILog } from '../../common/logger/interfaces';
import { FEATURE_FLAGS } from '../../common/constants/featureFlags';
import { SNYK_NAME_EXTENSION, SNYK_PUBLISHER } from '../../common/constants/general';
import { TreeNode } from '../../common/views/treeNode';

export class IssueTreeProvider extends ProductIssueTreeProvider<CodeIssueData> {
  constructor(
    protected readonly logger: ILog,
    protected contextService: IContextService,
    protected codeService: IProductService<CodeIssueData>,
    protected configuration: IConfiguration,
    protected languages: IVSCodeLanguages,
    protected readonly isSecurityType: boolean,
    protected readonly folderConfigs: IFolderConfigs,
  ) {
    super(logger, contextService, codeService, configuration, languages, folderConfigs);
  }

  shouldShowTree(): boolean {
    return this.contextService.shouldShowCodeAnalysis;
  }

  filterIssues(issues: Issue<CodeIssueData>[]): Issue<CodeIssueData>[] {
    return issues.filter(i => i.additionalData.isSecurityType == this.isSecurityType);
  }

  getRunTestMessage = () => messages.runTest;

  // The title in the tree is taken from the title for vulnerabilities and from the message for quality rules
  getIssueTitle(issue: Issue<CodeIssueData>): string {
    const fixIcon = issue.additionalData.hasAIFix ? '⚡️' : '';
    const issueTitle = issue.additionalData.isSecurityType
      ? issue.title.split(':')[0]
      : issue.additionalData.message.split('.')[0];

    let prefixIgnored = '';
    if (issue.isIgnored) {
      prefixIgnored = '[ Ignored ] ';
    }

    return fixIcon + prefixIgnored + issueTitle;
  }

  getIssueRange(issue: Issue<CodeIssueData>): Range {
    return IssueUtils.createVsCodeRange(issue.additionalData, this.languages);
  }

  getOpenIssueCommand(issue: Issue<CodeIssueData>, folderPath: string, filePath: string): Command {
    return {
      command: SNYK_OPEN_ISSUE_COMMAND,
      title: '',
      arguments: [
        {
          issueType: OpenCommandIssueType.CodeIssue,
          issue: {
            id: issue.id,
            folderPath,
            filePath,
            range: this.getIssueRange(issue),
          } as CodeIssueCommandArg,
        } as OpenIssueCommandArg,
      ],
    };
  }

  isFixableIssue(issue: Issue<CodeIssueData>): boolean {
    return issue.additionalData.hasAIFix;
  }

  getFixableIssuesText(fixableIssueCount: number): string | null {
    const isIgnoresEnabled = this.configuration.getFeatureFlag(FEATURE_FLAGS.consistentIgnores);
    const showingOpen = this.configuration.issueViewOptions.openIssues;
    if (isIgnoresEnabled && !showingOpen) {
      return null;
    }

    return fixableIssueCount > 0
      ? `⚡️ ${fixableIssueCount}${isIgnoresEnabled ? ' open' : ''} issue${fixableIssueCount === 1 ? ' is' : 's are'}` +
          ' fixable by Snyk Agent Fix.'
      : analysisMessages.noFixableIssues;
  }

  protected getNoIssueViewOptionsSelectedTreeNode(): TreeNode | null {
    const isIgnoresEnabled = this.configuration.getFeatureFlag(FEATURE_FLAGS.consistentIgnores);
    if (!isIgnoresEnabled) {
      return null;
    }

    const showingOpen = this.configuration.issueViewOptions.openIssues;
    const showingIgnored = this.configuration.issueViewOptions.ignoredIssues;

    if (!showingOpen && !showingIgnored) {
      return new TreeNode({
        text: analysisMessages.allIssueViewOptionsDisabled,
        command: {
          command: VSCODE_GO_TO_SETTINGS_COMMAND,
          title: '',
          arguments: [`@ext:${SNYK_PUBLISHER}.${SNYK_NAME_EXTENSION} snyk.issueViewOptions`],
        },
      });
    }

    if (!showingOpen) {
      return new TreeNode({
        text: analysisMessages.openIssueViewOptionDisabled,
        command: {
          command: VSCODE_GO_TO_SETTINGS_COMMAND,
          title: '',
          arguments: [`@ext:${SNYK_PUBLISHER}.${SNYK_NAME_EXTENSION} snyk.issueViewOptions`],
        },
      });
    }

    if (!showingIgnored) {
      return new TreeNode({
        text: analysisMessages.ignoredIssueViewOptionDisabled,
        command: {
          command: VSCODE_GO_TO_SETTINGS_COMMAND,
          title: '',
          arguments: [`@ext:${SNYK_PUBLISHER}.${SNYK_NAME_EXTENSION} snyk.issueViewOptions`],
        },
      });
    }

    return null;
  }

  protected getIssueFoundText(totalIssueCount: number, openIssueCount: number, ignoredIssueCount: number): string {
    const isIgnoresEnabled = this.configuration.getFeatureFlag(FEATURE_FLAGS.consistentIgnores);
    if (!isIgnoresEnabled) {
      return super.getIssueFoundText(totalIssueCount, openIssueCount, ignoredIssueCount);
    }

    const showingOpen = this.configuration.issueViewOptions.openIssues;
    const showingIgnored = this.configuration.issueViewOptions.ignoredIssues;

    const openIssuesText = `${openIssueCount} open issue${openIssueCount === 1 ? '' : 's'}`;
    const ignoredIssuesText = `${ignoredIssueCount} ignored issue${ignoredIssueCount === 1 ? '' : 's'}`;

    if (showingOpen && showingIgnored) {
      if (totalIssueCount === 0) {
        return analysisMessages.congratsNoIssuesFound;
      } else {
        return `✋ ${openIssuesText} & ${ignoredIssuesText}`;
      }
    }
    if (showingOpen) {
      if (openIssueCount === 0) {
        return analysisMessages.congratsNoOpenIssuesFound;
      } else {
        return `✋ ${openIssuesText}`;
      }
    }
    if (showingIgnored) {
      if (ignoredIssueCount === 0) {
        return analysisMessages.noIgnoredIssues;
      } else {
        return `✋ ${ignoredIssuesText}, open issues are disabled`;
      }
    }
    return analysisMessages.openAndIgnoredIssuesAreDisabled;
  }
}
