import * as vscode from 'vscode';
import { IConfiguration } from '../../common/configuration/configuration';
import { Logger } from '../../common/logger/logger';
import * as fs from 'fs';
import * as os from 'os';
import path from 'path';

type Env = Record<string, string>;
interface McpServer {
  command: string;
  args: string[];
  env: Env;
}
interface McpConfig {
  mcpServers: Record<string, McpServer>;
}

export async function configureMcpHosts(vscodeContext: vscode.ExtensionContext, configuration: IConfiguration) {
  /* eslint-disable @typescript-eslint/no-unsafe-assignment */
  /* eslint-disable @typescript-eslint/no-unsafe-member-access */
  // @ts-expect-error backward compatibility for older VS Code versions
  if (vscode.lm?.registerMcpServerDefinitionProvider) {
    await configureCopilot(vscodeContext, configuration);
  }
  if (vscode.env.appName.toLowerCase().includes('windsurf')) {
    await configureWindsurf(vscodeContext, configuration);
  }
}

export async function configureCopilot(vscodeContext: vscode.ExtensionContext, configuration: IConfiguration) {
  try {
    vscodeContext.subscriptions.push(
      /* eslint-disable @typescript-eslint/no-unsafe-argument */
      /* eslint-disable @typescript-eslint/no-unsafe-call */
      // @ts-expect-error backward compatibility for older VS Code versions
      vscode.lm.registerMcpServerDefinitionProvider('snyk-security-scanner', {
        onDidChangeMcpServerDefinitions: new vscode.EventEmitter<void>().event,
        provideMcpServerDefinitions: async () => {
          // @ts-expect-error backward compatibility for older VS Code versions
          const output: vscode.McpServerDefinition[][] = [];

          /* eslint-disable @typescript-eslint/no-unsafe-call */
          const cliPath = await configuration.getCliPath();
          /* eslint-disable @typescript-eslint/no-unsafe-return */
          const args = ['mcp', '-t', 'stdio'];
          const env: Env = {};
          if (configuration.organization) {
            env.SNYK_CFG_ORG = configuration.organization ?? '';
          }
          if (configuration.snykApiEndpoint) {
            env.SNYK_API = configuration.snykApiEndpoint ?? '';
          }

          Object.entries(process.env).forEach(([key, value]) => {
            env[key] = value ?? '';
          });

          // @ts-expect-error backward compatibility for older VS Code versions
          output.push(new vscode.McpStdioServerDefinition('Snyk', cliPath, args, env));

          return output;
        },
      }),
    );
  } catch (err) {
    Logger.debug(
      `VS Code MCP Server Definition Provider API is not available. This feature requires VS Code version > 1.101.0.`,
    );
  }
}

export async function configureWindsurf(vsCodeContext: vscode.ExtensionContext, configuration: IConfiguration) {
  try {
    if (!configuration.getSecurityAtInception()) {
      return
    }
    // Get the MCP config path for Windsurf
    const baseDir = path.join(os.homedir(), '.codeium', 'windsurf');
    const configPath = path.join(baseDir, 'mcp_config.json');
    const memoriesDir = path.join(baseDir, 'memories');
    const rulesPath = path.join(memoriesDir, 'snyk_rules.md');

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.mkdirSync(memoriesDir, { recursive: true });
    // Load or create the config file
    let config: McpConfig = { mcpServers: {} };
    if (fs.existsSync(configPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (raw && typeof raw === 'object' && 'mcpServers' in raw && typeof (raw as any).mcpServers === 'object') {
          config.mcpServers = (raw as McpConfig).mcpServers ?? {};
        }
      } catch (err) {
        Logger.error('parsing Windsurf MCP config, resetting to empty.');
      }
    }

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    const cliPath = await configuration.getCliPath();
    config.mcpServers['Snyk'] = {
      command: cliPath,
      args: ['mcp', '-t', 'stdio'],
      env: {},
    };
    if (configuration.organization) {
      config.mcpServers['Snyk'].env.SNYK_CFG_ORG = configuration.organization;
    }
    if (configuration.snykApiEndpoint) {
      config.mcpServers['Snyk'].env.SNYK_API = configuration.snykApiEndpoint;
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    Logger.debug(`Updated Windsurf MCP config at ${configPath}`);

    try {
      const assetPath = path.join(vsCodeContext.extensionPath, 'out', 'assets', 'snyk_rules.md');
      const assetContent = fs.readFileSync(assetPath, 'utf8');
      fs.writeFileSync(rulesPath, assetContent, 'utf8');
      Logger.debug(`Copied snyk_rules.md to ${rulesPath}`);
    } catch (err) {
      console.error('Failed to copy snyk_rules.md', err);
    }
  } catch (err) {
    Logger.error('Failed to update Windsurf MCP config');
  }
}