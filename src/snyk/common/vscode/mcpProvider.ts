import * as vscode from 'vscode';
import { McpConfig } from '../languageServer/types';
import { Logger } from '../logger/logger';

export interface IMcpProvider {
  registerMcpServer(mcpConfig: McpConfig): void;
}

export class McpProvider implements IMcpProvider {
  registerMcpServer(mcpConfig: McpConfig): void {
    try {
      /* eslint-disable @typescript-eslint/no-unsafe-argument */
      /* eslint-disable @typescript-eslint/no-unsafe-call */
      /* eslint-disable @typescript-eslint/no-unsafe-member-access */
      // @ts-expect-error backward compatibility for older VS Code versions
      vscode.lm.registerMcpServerDefinitionProvider('snyk-security-scanner', {
        onDidChangeMcpServerDefinitions: new vscode.EventEmitter<void>().event,
        provideMcpServerDefinitions: () => {
          // @ts-expect-error backward compatibility for older VS Code versions
          const output: vscode.McpServerDefinition[][] = [];
          // @ts-expect-error backward compatibility for older VS Code versions
          output.push(new vscode.McpStdioServerDefinition('Snyk', mcpConfig.command, mcpConfig.args, mcpConfig.env));

          return output;
        },
      });
    } catch (err) {
      Logger.debug(
        `VS Code MCP Server Definition Provider API is not available. This feature requires VS Code version > 1.101.0.`,
      );
    }
  }
}
