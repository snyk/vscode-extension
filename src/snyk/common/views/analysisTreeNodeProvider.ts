import _ from 'lodash';
import * as path from 'path';
import { AnalysisStatusProvider } from '../analysis/statusProvider';
import { IConfiguration } from '../configuration/configuration';
import { SNYK_SHOW_OUTPUT_COMMAND } from '../constants/commands';
import { messages } from '../messages/analysisMessages';
import { NODE_ICONS, TreeNode } from './treeNode';
import { TreeNodeProvider } from './treeNodeProvider';

export abstract class AnalysisTreeNodeProvder extends TreeNodeProvider {
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

  protected getDurationTreeNode(): TreeNode {
    const ts = new Date(this.statusProvider.lastAnalysisTimestamp);
    const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const day = ts.toLocaleDateString([], { year: '2-digit', month: '2-digit', day: '2-digit' });

    return new TreeNode({
      text: messages.duration(time, day),
    });
  }

  protected getNoSeverityFiltersSelectedTreeNode(): TreeNode | null {
    const anyFilterEnabled = Object.values<boolean>(this.configuration.severityFilter).find(enabled => !!enabled);
    if (anyFilterEnabled) {
      return null;
    }

    return new TreeNode({
      text: messages.allSeverityFiltersDisabled,
    });
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
        command: SNYK_SHOW_OUTPUT_COMMAND,
        title: '',
      },
    });
  }

  protected getNoWorkspaceTrustTreeNode(): TreeNode {
    return new TreeNode({
      text: messages.noWorkspaceTrust,
      command: {
        command: SNYK_SHOW_OUTPUT_COMMAND,
        title: '',
      },
    });
  }

  protected abstract getFilteredIssues(issues: readonly unknown[]): readonly unknown[];
}
