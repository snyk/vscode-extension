import * as vscode from 'vscode';
import { IConfiguration } from '../../common/configuration/configuration';
import { Logger } from '../../common/logger/logger';
import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import { upsertDelimitedBlock } from './text';

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
const RULE_START = '<!--###BEGIN SNYK GLOBAL RULE###-->';
const RULE_END = '<!--###END SNYK GLOBAL RULE###-->';

export async function configureMcpHosts(vscodeContext: vscode.ExtensionContext, configuration: IConfiguration) {
  const appName = vscode.env.appName.toLowerCase();
  const isWindsurf = appName.includes('windsurf');
  const isCursor = appName.includes('cursor');
  const isVsCode = appName.includes('visual studio code');

  if (isCursor) {
    await configureCursor(vscodeContext, configuration);
    return;
  }
  if (isWindsurf) {
    await configureWindsurf(vscodeContext, configuration);
    return;
  }
  if (isVsCode) {
    configureCopilot(vscodeContext, configuration);
    return;
  }
}

export function configureCopilot(vscodeContext: vscode.ExtensionContext, configuration: IConfiguration) {
  const sai = configuration.getSecurityAtInceptionConfig();
  try {
    if (sai.autoConfigureMcpServer) {
      type LmApi = {
        registerMcpServerDefinitionProvider?: (id: string, provider: unknown) => vscode.Disposable;
      };
      const lmApi: LmApi | undefined = (vscode as unknown as { lm?: LmApi }).lm;
      if (!lmApi?.registerMcpServerDefinitionProvider) return;
      vscodeContext.subscriptions.push(
        lmApi.registerMcpServerDefinitionProvider('snyk-security-scanner', {
          onDidChangeMcpServerDefinitions: new vscode.EventEmitter<void>().event,
          provideMcpServerDefinitions: async () => {
            const output: unknown[][] = [];

            const cliPath = await configuration.getCliPath();
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

            const McpCtor = (
              vscode as unknown as {
                McpStdioServerDefinition?: new (name: string, command: string, args: string[], env: Env) => unknown;
              }
            ).McpStdioServerDefinition;
            if (typeof McpCtor === 'function') {
              const def = new McpCtor(SERVER_KEY, cliPath, args, env);
              output.push([def]);
            }

            return output;
          },
        }),
      );
    }
  } catch (err) {
    Logger.debug(
      `VS Code MCP Server Definition Provider API is not available. This feature requires VS Code version > 1.101.0.`,
    );
  }

  // Rules publishing for Copilot
  (async () => {
    if (!sai.publishSecurityAtInceptionRules) return;
    try {
      const rulesContent = await readBundledRules(vscodeContext);
      if (sai.persistRulesInProjects) {
        await writeLocalRulesForIde(path.join('.github', 'instructions', 'snyk_rules.instructions.md'), rulesContent);
      } else {
        const globalPath = getCopilotGlobalRulesPath();
        await writeGlobalRules(globalPath, rulesContent);
      }
    } catch {
      Logger.error('Failed to publish Copilot rules');
    }
  })().catch(() => undefined);
}

export async function configureWindsurf(vscodeContext: vscode.ExtensionContext, configuration: IConfiguration) {
  const sai = configuration.getSecurityAtInceptionConfig();
  try {
    if (sai.autoConfigureMcpServer) {
      const baseDir = path.join(os.homedir(), '.codeium', 'windsurf');
      const configPath = path.join(baseDir, 'mcp_config.json');
      if (!fs.existsSync(baseDir)) {
        Logger.debug(`Windsurf base directory not found at ${baseDir}, skipping MCP configuration.`);
      } else {
        const cliPath = await configuration.getCliPath();
        const env: Env = {};
        if (configuration.organization) env.SNYK_CFG_ORG = configuration.organization;
        if (configuration.snykApiEndpoint) env.SNYK_API = configuration.snykApiEndpoint;
        await ensureMcpServerInJson(configPath, SERVER_KEY, cliPath, ['mcp', '-t', 'stdio'], env);
        Logger.debug(`Ensured Windsurf MCP config at ${configPath}`);
      }
    }
  } catch {
    Logger.error('Failed to update Windsurf MCP config');
  }

  try {
    if (!sai.publishSecurityAtInceptionRules) return;
    const rulesContent = await readBundledRules(vscodeContext);
    if (sai.persistRulesInProjects) {
      await writeLocalRulesForIde(path.join('.windsurf', 'rules', 'snyk_rules.md'), rulesContent);
    } else {
      const globalPath = path.join(os.homedir(), '.codeium', 'windsurf', 'memories', 'global_rules.md');
      await writeGlobalRules(globalPath, rulesContent);
    }
  } catch {
    Logger.error('Failed to publish Windsurf rules');
  }
}

export async function configureCursor(vscodeContext: vscode.ExtensionContext, configuration: IConfiguration) {
  const sai = configuration.getSecurityAtInceptionConfig();
  try {
    if (sai.autoConfigureMcpServer) {
      const configPath = path.join(os.homedir(), '.cursor', 'mcp.json');
      const cliPath = await configuration.getCliPath();
      const env: Env = {};
      if (configuration.organization) env.SNYK_CFG_ORG = configuration.organization;
      if (configuration.snykApiEndpoint) env.SNYK_API = configuration.snykApiEndpoint;
      await ensureMcpServerInJson(configPath, SERVER_KEY, cliPath, ['mcp', '-t', 'stdio'], env);
      Logger.debug(`Ensured Cursor MCP config at ${configPath}`);
    }
  } catch {
    Logger.error('Failed to update Cursor MCP config');
  }

  try {
    if (!sai.publishSecurityAtInceptionRules) return;
    const rulesContent = await readBundledRules(vscodeContext);
    if (sai.persistRulesInProjects) {
      await writeLocalRulesForIde(path.join('.cursor', 'rules', 'snyk_rules.mdc'), rulesContent);
    } else {
      void vscode.window.showInformationMessage(
        'Cursor does not support global rules. Only local rules can be persisted.',
      );
    }
  } catch {
    Logger.error('Failed to publish Cursor rules');
  }
}

async function ensureMcpServerInJson(
  filePath: string,
  serverKey: string,
  command: string,
  args: string[],
  env: Env,
): Promise<void> {
  let raw: unknown = undefined;
  if (fs.existsSync(filePath)) {
    try {
      raw = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    } catch {
      // ignore parse error; will recreate minimal structure
    }
  }
  type RawConfig = { mcpServers?: Record<string, McpServer> };
  const config: McpConfig = { mcpServers: {} };
  if (raw && typeof raw === 'object' && raw !== null && Object.prototype.hasOwnProperty.call(raw, 'mcpServers')) {
    const servers = (raw as RawConfig).mcpServers;
    if (servers && typeof servers === 'object') {
      config.mcpServers = servers;
    }
  }

  const existing = config.mcpServers[serverKey];
  const desired: McpServer = { command, args, env };

  const needsWrite =
    !existing ||
    existing.command !== desired.command ||
    JSON.stringify(existing.args) !== JSON.stringify(desired.args) ||
    JSON.stringify(existing.env || {}) !== JSON.stringify(desired.env || {});

  if (!needsWrite) return;

  config.mcpServers[serverKey] = desired;
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
}

async function readBundledRules(vsCodeContext: vscode.ExtensionContext): Promise<string> {
  return await fs.promises.readFile(path.join(vsCodeContext.extensionPath, 'out', 'assets', 'snyk_rules.md'), 'utf8');
}

async function writeLocalRulesForIde(relativeRulesPath: string, rulesContent: string): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showInformationMessage('No workspace folder found. Local rules require an open workspace.');
    return;
  }
  for (const folder of folders) {
    const root = folder.uri.fsPath;
    const rulesPath = path.join(root, relativeRulesPath);
    await fs.promises.mkdir(path.dirname(rulesPath), { recursive: true });
    let existing = '';
    try {
      existing = await fs.promises.readFile(rulesPath, 'utf8');
    } catch {
      // ignore
    }
    if (existing !== rulesContent) {
      await fs.promises.writeFile(rulesPath, rulesContent, 'utf8');
      Logger.debug(`Wrote local rules to ${rulesPath}`);
    } else {
      Logger.debug(`Local rules already up to date at ${rulesPath}.`);
    }
  }
}

function getCopilotGlobalRulesPath(): string {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const base = isWindows
    ? path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'prompts')
    : isMac
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'prompts')
    : path.join(os.homedir(), '.config', 'Code', 'User', 'prompts');
  return path.join(base, 'snyk_instructions.md');
}

async function writeGlobalRules(targetFile: string, rulesContent: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
  const block = `${RULE_START}\n${rulesContent.trim()}\n${RULE_END}\n`;
  let current = '';
  try {
    current = await fs.promises.readFile(targetFile, 'utf8');
  } catch {
    // file may not exist yet
  }
  const updated = upsertDelimitedBlock(current, RULE_START, RULE_END, block);
  if (updated !== current) {
    await fs.promises.writeFile(targetFile, updated, 'utf8');
    Logger.debug(`Upserted delimited global rules into ${targetFile}`);
  } else {
    Logger.debug(`Delimited global rules already up to date at ${targetFile}.`);
  }
}
