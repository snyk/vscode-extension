import _ from 'lodash';
import * as path from 'path';
import { AnalysisStatusProvider } from '../analysis/statusProvider';
import { IConfiguration } from '../configuration/configuration';
import { SNYK_SHOW_LS_OUTPUT_COMMAND, VSCODE_GO_TO_SETTINGS_COMMAND } from '../constants/commands';
import { messages } from '../messages/analysisMessages';
import { NODE_ICONS, TreeNode } from './treeNode';
import { TreeNodeProvider } from './treeNodeProvider';
import { SNYK_NAME_EXTENSION, SNYK_PUBLISHER } from '../constants/general';
import { configuration } from '../configuration/instance';
import { FEATURE_FLAGS } from '../constants/featureFlags';

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

  protected getNoIssueViewOptionsSelectedTreeNode(numIssues: number, ignoredIssueCount: number): TreeNode | null {
    const isIgnoresEnabled = configuration.getFeatureFlag(FEATURE_FLAGS.consistentIgnores);
    if (!isIgnoresEnabled) {
      return null;
    }

    const anyOptionEnabled = Object.values<boolean>(this.configuration.issueViewOptions).find(enabled => !!enabled);
    if (!anyOptionEnabled) {
      return new TreeNode({
        text: messages.allIssueViewOptionsDisabled,
      });
    }

    if (numIssues === 0) {
      return null;
    }

    // if only ignored issues are enabled, then let the customer know to adjust their settings
    if (numIssues === ignoredIssueCount && !this.configuration.issueViewOptions.ignoredIssues) {
      return new TreeNode({
        text: messages.ignoredIssueViewOptionDisabled,
        command: {
          command: VSCODE_GO_TO_SETTINGS_COMMAND,
          title: '',
          arguments: [`@ext:${SNYK_PUBLISHER}.${SNYK_NAME_EXTENSION}`],
        },
      });
    }

    // if only open issues are enabled, then let the customer know to adjust their settings
    if (ignoredIssueCount === 0 && !this.configuration.issueViewOptions.openIssues) {
      return new TreeNode({
        text: messages.openIssueViewOptionDisabled,
        command: {
          command: VSCODE_GO_TO_SETTINGS_COMMAND,
          title: '',
          arguments: [`@ext:${SNYK_PUBLISHER}.${SNYK_NAME_EXTENSION}`],
        },
      });
    }

    // if all options are enabled we don't want to show a warning
    return null;
  }

  protected getErrorEncounteredTreeNode(scanPath?: string): TreeNode {
    return new TreeNode({
      icon: NODE_ICONS.error,
      text: scanPath ? path.basename(scanPath) : messages.scanFailed,
      description: messages.clickToProblem,
      internal: {
        isError: true,
      },
      command: {
        command: SNYK_SHOW_LS_OUTPUT_COMMAND,
        title: '',
      },
    });
  }

  protected getFaultyRepositoryErrorTreeNode(scanPath?: string, errorMessage?: string): TreeNode {
    return new TreeNode({
      icon: NODE_ICONS.error,
      text: scanPath ? path.basename(scanPath) : messages.scanFailed,
      description: errorMessage,
      internal: {
        isError: true,
      },
      command: {
        command: SNYK_SHOW_LS_OUTPUT_COMMAND,
        title: 'errorMessage',
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
