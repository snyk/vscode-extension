import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { CodeIssueData } from '../../common/languageServer/types';
import { IContextService } from '../../common/services/contextService';
import { IProductService } from '../../common/services/productService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { TreeNode } from '../../common/views/treeNode';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IssueTreeProvider } from './issueTreeProvider';
import { FEATURE_FLAGS } from '../../common/constants/featureFlags';
import { IFolderConfigs } from '../../common/configuration/folderConfigs';
import { ILog } from '../../common/logger/interfaces';
import { messages } from '../../common/messages/analysisMessages';
import { VSCODE_GO_TO_SETTINGS_COMMAND } from '../../common/constants/commands';
import { SNYK_NAME_EXTENSION, SNYK_PUBLISHER } from '../../common/constants/general';

export default class CodeSecurityIssueTreeProvider extends IssueTreeProvider {
  constructor(
    protected readonly logger: ILog,
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected codeService: IProductService<CodeIssueData>,
    protected configuration: IConfiguration,
    protected languages: IVSCodeLanguages,
    protected readonly folderConfigs: IFolderConfigs,
  ) {
    super(logger, contextService, codeService, configuration, languages, true, folderConfigs);
  }

  getRootChildren(): TreeNode[] {
    if (!this.configuration.getFeaturesConfiguration()?.codeSecurityEnabled) {
      return [
        new TreeNode({
          text: SNYK_ANALYSIS_STATUS.CODE_SECURITY_DISABLED,
        }),
      ];
    }

    return super.getRootChildren();
  }

  onDidChangeTreeData = this.viewManagerService.refreshCodeSecurityViewEmitter.event;

  protected getNoIssueViewOptionsSelectedTreeNode(numIssues: number): TreeNode | null {
    if (numIssues !== 0) {
      return null;
    }

    const isIgnoresEnabled = this.configuration.getFeatureFlag(FEATURE_FLAGS.consistentIgnores);
    const showingOpen = this.configuration.issueViewOptions.openIssues;

    if (!isIgnoresEnabled) {
      if (showingOpen) {
        return null;
      } else {
        return new TreeNode({
          text: messages.openIssueViewOptionDisabled,
          command: {
            command: VSCODE_GO_TO_SETTINGS_COMMAND,
            title: '',
            arguments: [`@ext:${SNYK_PUBLISHER}.${SNYK_NAME_EXTENSION} snyk.issueViewOptions`],
          },
        });
      }
    }

    const showingIgnored = this.configuration.issueViewOptions.ignoredIssues;

    if (!showingOpen && !showingIgnored) {
      return new TreeNode({
        text: messages.allIssueViewOptionsDisabled,
        command: {
          command: VSCODE_GO_TO_SETTINGS_COMMAND,
          title: '',
          arguments: [`@ext:${SNYK_PUBLISHER}.${SNYK_NAME_EXTENSION} snyk.issueViewOptions`],
        },
      });
    }

    if (!showingIgnored) {
      return new TreeNode({
        text: messages.ignoredIssueViewOptionDisabled,
        command: {
          command: VSCODE_GO_TO_SETTINGS_COMMAND,
          title: '',
          arguments: [`@ext:${SNYK_PUBLISHER}.${SNYK_NAME_EXTENSION} snyk.issueViewOptions`],
        },
      });
    }

    if (!showingOpen) {
      return new TreeNode({
        text: messages.openIssueViewOptionDisabled,
        command: {
          command: VSCODE_GO_TO_SETTINGS_COMMAND,
          title: '',
          arguments: [`@ext:${SNYK_PUBLISHER}.${SNYK_NAME_EXTENSION} snyk.issueViewOptions`],
        },
      });
    }

    return null;
  }

  protected getIssueDescriptionText(dir: string | undefined, issueCount: number): string | undefined {
    return `${dir} - ${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}`;
  }

  protected getIssueFoundText(totalIssueCount: number, openIssueCount: number, ignoredIssueCount: number): string {
    const isIgnoresEnabled = this.configuration.getFeatureFlag(FEATURE_FLAGS.consistentIgnores);
    const showingOpen = this.configuration.issueViewOptions.openIssues;
    if (!isIgnoresEnabled) {
      if (!showingOpen) {
        return 'Open issues are disabled!';
      }
      if (totalIssueCount === 0) {
        return '✅ Congrats! No issues found!';
      } else {
        return `✋ ${totalIssueCount} issue${totalIssueCount === 1 ? '' : 's'}`;
      }
    }

    const showingIgnored = this.configuration.issueViewOptions.ignoredIssues;
    const openIssuesText = `${openIssueCount} open issue${openIssueCount === 1 ? '' : 's'}`;
    const ignoredIssuesText = `${ignoredIssueCount} ignored issue${ignoredIssueCount === 1 ? '' : 's'}`;

    if (showingOpen) {
      if (showingIgnored) {
        if (totalIssueCount === 0) {
          return '✅ Congrats! No issues found!';
        } else {
          return `✋ ${openIssuesText}, ${ignoredIssuesText}`;
        }
      } else {
        if (openIssueCount === 0) {
          return '✅ Congrats! No open issues found!';
        } else {
          return `✋ ${openIssuesText}`;
        }
      }
    } else if (showingIgnored) {
      if (ignoredIssueCount === 0) {
        return '✋ No ignored issues, open issues are disabled';
      } else {
        return `✋ ${ignoredIssuesText}, open issues are disabled`;
      }
    } else {
      return 'Open and Ignored issues are disabled!';
    }
  }

  getFixableIssuesNode(fixableIssueCount: number): TreeNode | null {
    const isIgnoresEnabled = this.configuration.getFeatureFlag(FEATURE_FLAGS.consistentIgnores);
    const showingOpen = this.configuration.issueViewOptions.openIssues;
    if (isIgnoresEnabled && !showingOpen) {
      return null;
    }
    return super.getFixableIssuesNode(fixableIssueCount);
  }
}
