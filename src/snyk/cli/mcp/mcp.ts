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

const SERVER_KEY = 'Snyk';
const RULE_START = '###BEGIN SNYK GLOBAL RULE###';
const RULE_END = '###END SNYK GLOBAL RULE###';

export async function configureMcpHosts(vscodeContext: vscode.ExtensionContext, configuration: IConfiguration) {
  /* eslint-disable @typescript-eslint/no-unsafe-assignment */
  /* eslint-disable @typescript-eslint/no-unsafe-member-access */
  // @ts-expect-error backward compatibility for older VS Code versions
  if (vscode.lm?.registerMcpServerDefinitionProvider) {
    configureCopilot(vscodeContext, configuration);
  }
  if (vscode.env.appName.toLowerCase().includes('windsurf')) {
    await configureWindsurf(vscodeContext, configuration);
  }
}

export function configureCopilot(vscodeContext: vscode.ExtensionContext, configuration: IConfiguration) {
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
      return;
    }
    // Get the MCP config path for Windsurf
    const baseDir = path.join(os.homedir(), '.codeium', 'windsurf');
    const configPath = path.join(baseDir, 'mcp_config.json');
    const memoriesDir = path.join(baseDir, 'memories');
    const globalRulesPath = path.join(memoriesDir, 'global_rules.md');

    if (!fs.existsSync(baseDir)) {
      Logger.debug(`Windsurf base directory not found at ${baseDir}, skipping MCP configuration.`);
      return;
    }

    const config: McpConfig = { mcpServers: {} };
    if (fs.existsSync(configPath)) {
      try {
        const raw = JSON.parse(await fs.promises.readFile(configPath, 'utf8'));
        if (raw && typeof raw === 'object' && 'mcpServers' in raw && raw.mcpServers === 'object') {
          config.mcpServers = (raw as McpConfig).mcpServers ?? {};
        }
      } catch (err) {
        Logger.error('parsing Windsurf MCP config, resetting to empty.');
      }
    }

    const cliPath = await configuration.getCliPath();
    config.mcpServers[SERVER_KEY] = {
      command: cliPath,
      args: ['mcp', '-t', 'stdio'],
      env: {},
    };
    if (configuration.organization) {
      config.mcpServers[SERVER_KEY].env.SNYK_CFG_ORG = configuration.organization;
    }
    if (configuration.snykApiEndpoint) {
      config.mcpServers[SERVER_KEY].env.SNYK_API = configuration.snykApiEndpoint;
    }
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    Logger.debug(`Updated Windsurf MCP config at ${configPath}`);

    try {
      let snykRules: string;
      try {
        snykRules = await fs.promises.readFile(
          path.join(vsCodeContext.extensionPath, 'out', 'assets', 'snyk_rules.md'),
          'utf8',
        );
      } catch {
        Logger.error(`Failed to read bundled snyk_rules.md`);
        return;
      }

      await fs.promises.mkdir(path.dirname(memoriesDir), { recursive: true });
      const block = `${RULE_START}\n${snykRules.trim()}\n${RULE_END}\n`;

      if (fs.existsSync(globalRulesPath)) {
        let globalContent = await fs.promises.readFile(globalRulesPath, 'utf8');
        const updated = upsertDelimitedBlock(globalContent, RULE_START, RULE_END, block);
        if (updated !== globalContent) {
          await fs.promises.writeFile(globalRulesPath, updated, 'utf8');
          Logger.debug(`Updated Snyk block in ${globalRulesPath}`);
        } else {
          Logger.debug('Global rules already contain up-to-date Snyk block.');
        }
      } else {
        await fs.promises.writeFile(globalRulesPath, block, 'utf8');
        Logger.debug(`Created ${globalRulesPath} with Snyk block.`);
      }
    } catch (err) {
      Logger.error('Failed to update Windsurf configuration');
    }
  } catch (err) {
    Logger.error('Failed to update Windsurf MCP config');
  }
}

/**
 * Replace or append a delimited block inside a file.
 * - If both markers exist: replace content between them (inclusive of markers is preserved by passing full `block`).
 * - If not found: append block with a separating newline if needed.
 */
function upsertDelimitedBlock(source: string, start: string, end: string, fullBlockToInsert: string): string {
  // Normalize newlines to \n for regex ops
  const src = source.replace(/\r\n/g, '\n');

  const startIdx = src.indexOf(start);
  const endIdx = src.indexOf(end);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace from start marker to end marker (inclusive)
    const before = src.slice(0, startIdx);
    const after = src.slice(endIdx + end.length);
    // Ensure single trailing newline around seams
    return `${trimTrailingNewlines(before)}\n${fullBlockToInsert.trim()}\n${trimLeadingNewlines(after)}`;
  }

  // No existing block: append, ensuring file ends with a newline first
  const prefix = src.length ? `${trimTrailingNewlines(src)}\n\n` : '';
  return `${prefix}${fullBlockToInsert.trim()}\n`;
}

function trimTrailingNewlines(s: string): string {
  return s.replace(/\s*$/g, '').replace(/\r?\n*$/g, '');
}
function trimLeadingNewlines(s: string): string {
  return s.replace(/^\r?\n*/g, '');
}
