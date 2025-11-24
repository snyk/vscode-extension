import _ from 'lodash';
import { AnalysisStatusProvider } from '../analysis/statusProvider';
import { IConfiguration } from '../configuration/configuration';
import { SNYK_SHOW_LS_OUTPUT_COMMAND, VSCODE_GO_TO_SETTINGS_COMMAND } from '../constants/commands';
import { messages } from '../messages/analysisMessages';
import { NODE_ICONS, TreeNode } from './treeNode';
import { TreeNodeProvider } from './treeNodeProvider';
import { SNYK_NAME_EXTENSION, SNYK_PUBLISHER } from '../constants/general';
import { FEATURE_FLAGS } from '../constants/featureFlags';
import { PresentableError } from '../languageServer/types';

export abstract class AnalysisTreeNodeProvider extends TreeNodeProvider {
  constructor(protected readonly configuration: IConfiguration, private statusProvider: AnalysisStatusProvider) {
    super();
  }

  protected compareNodes = (n1: TreeNode, n2: TreeNode): number => {
    if (!n1.internal.isError && n2.internal.isError) {
      return 1;
    } else if (n1.internal.isError && !n2.internal.isError) {
      return -1;
    }

    if (!_.isUndefined(n1.internal.severity) && !_.isUndefined(n2.internal.severity)) {
      if (n2.internal.severity - n1.internal.severity) return n2.internal.severity - n1.internal.severity;
    }
    if (!_.isUndefined(n1.internal.nIssues) && !_.isUndefined(n2.internal.nIssues)) {
      if (n2.internal.nIssues - n1.internal.nIssues) return n2.internal.nIssues - n1.internal.nIssues;
    }
    if (n1.label && n2.label) {
      if (n1.label < n2.label) return -1;
      if (n1.label > n2.label) return 1;
    }
    if (n1.description && n2.description) {
      if (n1.description < n2.description) return -1;
      if (n1.description > n2.description) return 1;
    }
    return 0;
  };

  protected getNoSeverityFiltersSelectedTreeNode(): TreeNode | null {
    const anyFilterEnabled = Object.values<boolean>(this.configuration.severityFilter).find(enabled => !!enabled);
    if (anyFilterEnabled) {
      return null;
    }

    return new TreeNode({
      text: messages.allSeverityFiltersDisabled,
    });
  }

  protected getNoIssueViewOptionsSelectedTreeNode(): TreeNode | null {
    const isIgnoresEnabled = this.configuration.getFeatureFlag(FEATURE_FLAGS.consistentIgnores);
    if (!isIgnoresEnabled) {
      return null;
    }

    const showingOpen = this.configuration.issueViewOptions.openIssues;
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

  protected getErrorEncounteredTreeNode(error: PresentableError, showErrorIcon: boolean = true): TreeNode {
    return new TreeNode({
      ...(showErrorIcon ? { icon: NODE_ICONS.error } : {}),
      text: '',
      description: messages.clickToProblem,
      internal: {
        isError: true,
      },
      command: {
        command: SNYK_SHOW_LS_OUTPUT_COMMAND,
        title: '',
        arguments: [error],
      },
    });
  }

  protected getNoWorkspaceTrustTreeNode(): TreeNode {
    return new TreeNode({
      text: messages.noWorkspaceTrust,
      command: {
        command: SNYK_SHOW_LS_OUTPUT_COMMAND,
        title: '',
      },
    });
  }
}
