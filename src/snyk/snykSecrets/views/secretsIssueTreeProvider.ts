import _ from 'lodash';
import { Command, Range } from 'vscode';
import { OpenCommandIssueType, OpenIssueCommandArg } from '../../common/commands/types';
import { IConfiguration } from '../../common/configuration/configuration';
import { configuration } from '../../common/configuration/instance';
import { SNYK_OPEN_ISSUE_COMMAND } from '../../common/constants/commands';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { Issue, SecretIssueData } from '../../common/languageServer/types';
import { IContextService } from '../../common/services/contextService';
import { IProductService } from '../../common/services/productService';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { ProductIssueTreeProvider } from '../../common/views/issueTreeProvider';
import { INodeIcon, TreeNode } from '../../common/views/treeNode';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { messages } from '../messages/analysis';
import { SecretIssueCommandArg } from './interfaces';
import { IFolderConfigs } from '../../common/configuration/folderConfigs';
import { ILog } from '../../common/logger/interfaces';

export default class SecretsIssueTreeProvider extends ProductIssueTreeProvider<SecretIssueData> {
  constructor(
    protected readonly logger: ILog,
    protected viewManagerService: IViewManagerService,
    protected contextService: IContextService,
    protected secretsService: IProductService<SecretIssueData>,
    protected configuration: IConfiguration,
    protected languages: IVSCodeLanguages,
    protected readonly folderConfigs: IFolderConfigs,
  ) {
    super(logger, contextService, secretsService, configuration, languages, folderConfigs);
  }

  getRootChildren(): TreeNode[] {
    if (!configuration.getFeaturesConfiguration()?.secretsEnabled) {
      return [
        new TreeNode({
          text: SNYK_ANALYSIS_STATUS.SECRETS_DISABLED,
        }),
      ];
    }

    // Build issue id -> fingerprint lookup from raw issues before tree construction
    this.fingerprintById = new Map<string, string>();
    for (const result of this.productService.result.values()) {
      if (result.isSuccess) {
        for (const issue of result.issues) {
          if (issue.additionalData.fingerprint) {
            this.fingerprintById.set(issue.id, issue.additionalData.fingerprint);
          }
        }
      }
    }

    const nodes = super.getRootChildren();
    return this.groupDuplicateIssues(nodes);
  }

  private fingerprintById = new Map<string, string>();

  /**
   * Groups issue nodes that share the same fingerprint (same finding, different locations)
   * under a single parent node. Traverses file-level nodes and replaces
   * duplicate children with a grouped parent containing all occurrences.
   */
  private groupDuplicateIssues(nodes: TreeNode[]): TreeNode[] {
    for (const node of nodes) {
      const children = node.getChildren();
      if (children.length === 0) continue;

      // Recurse into folder nodes (multi-workspace) that contain file nodes
      const firstChild = children[0];
      if (firstChild.getChildren().length > 0 && !firstChild.issue) {
        this.groupDuplicateIssues(children);
        continue;
      }

      // Group issue children by fingerprint
      const grouped = _.groupBy(children, child => {
        const issueId = child.issue?.id;
        return issueId ? this.fingerprintById.get(issueId) ?? issueId : child.label;
      });
      const hasAnyDuplicates = Object.values(grouped).some(group => group.length > 1);
      if (!hasAnyDuplicates) continue;

      const newChildren: TreeNode[] = [];
      for (const issueNodes of Object.values(grouped)) {
        if (issueNodes.length === 1) {
          newChildren.push(issueNodes[0]);
        } else {
          const title = issueNodes[0].label as string;
          const highestSeverity = issueNodes.reduce((max, n) => Math.max(max, n.internal.severity ?? 0), 0);
          const icon = issueNodes[0].iconPath as INodeIcon;
          const groupNode = new TreeNode({
            text: title,
            description: `${issueNodes.length} locations`,
            icon,
            children: issueNodes,
            internal: { severity: highestSeverity },
          });
          newChildren.push(groupNode);
        }
      }

      // Replace the file node's children by recreating it
      const fileIcon = node.iconPath as INodeIcon;
      const replacement = new TreeNode({
        text: node.label as string,
        description: node.description as string,
        icon: fileIcon,
        children: newChildren,
        internal: node.internal,
      });
      const idx = nodes.indexOf(node);
      if (idx !== -1) {
        nodes[idx] = replacement;
      }
    }
    return nodes;
  }

  onDidChangeTreeData = this.viewManagerService.refreshSecretsViewEmitter.event;

  shouldShowTree(): boolean {
    return this.contextService.shouldShowSecretsAnalysis;
  }

  filterIssues(issues: Issue<SecretIssueData>[]): Issue<SecretIssueData>[] {
    return issues;
  }

  getRunTestMessage = () => messages.runTest;

  getIssueTitle = (issue: Issue<SecretIssueData>) => issue.title;

  getIssueRange(issue: Issue<SecretIssueData>): Range {
    return this.languages.createRange(
      issue.additionalData.rows[0],
      issue.additionalData.cols[0],
      issue.additionalData.rows[1],
      issue.additionalData.cols[1],
    );
  }

  override getOpenIssueCommand(
    issue: Issue<SecretIssueData>,
    folderPath: string,
    filePath: string,
    _filteredIssues: Issue<SecretIssueData>[],
  ): Command {
    return {
      command: SNYK_OPEN_ISSUE_COMMAND,
      title: '',
      arguments: [
        {
          issueType: OpenCommandIssueType.SecretsIssue,
          issue: {
            id: issue.id,
            folderPath,
            filePath,
            range: this.getIssueRange(issue),
          } as SecretIssueCommandArg,
        } as OpenIssueCommandArg,
      ],
    };
  }
}
