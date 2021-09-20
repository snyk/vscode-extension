import { AnalysisStatusProvider } from '../analysis/statusProvider';
import { messages } from '../messages/analysisMessages';
import { TreeNode } from './treeNode';
import { TreeNodeProvider } from './treeNodeProvider';

export abstract class AnalysisTreeNodeProvder extends TreeNodeProvider {
  constructor(private statusProvider: AnalysisStatusProvider) {
    super();
  }

  protected compareNodes = (n1: TreeNode, n2: TreeNode): number => {
    if (n2.internal.severity - n1.internal.severity) return n2.internal.severity - n1.internal.severity;
    if (n2.internal.nIssues - n1.internal.nIssues) return n2.internal.nIssues - n1.internal.nIssues;
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
    const sDuration = Math.round((this.statusProvider.lastAnalysisDuration / 1000 + Number.EPSILON) * 100) / 100;
    const ts = new Date(this.statusProvider.lastAnalysisTimestamp);
    const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const day = ts.toLocaleDateString([], { year: '2-digit', month: '2-digit', day: '2-digit' });

    return new TreeNode({
      text: messages.duration(sDuration, time, day),
    });
  }

  protected abstract getFilteredIssues(issues: readonly unknown[]): unknown[];
}
