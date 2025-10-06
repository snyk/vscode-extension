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
    await configureCopilot(vscodeContext, configuration);
    return;
  }
}

export async function configureCopilot(vscodeContext: vscode.ExtensionContext, configuration: IConfiguration) {
  const securityAtInception = configuration.getSecurityAtInceptionConfig();
  try {
    if (securityAtInception.autoConfigureMcpServer) {
      vscodeContext.subscriptions.push(
        /* eslint-disable @typescript-eslint/no-unsafe-argument */
        /* eslint-disable @typescript-eslint/no-unsafe-call */
        /* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
            const snykEnv = await getSnykMcpEnv(configuration);
            const processEnv: Env = {};
            Object.entries(process.env).forEach(([key, value]) => {
              processEnv[key] = value ?? '';
            });
            const env: Env = { ...processEnv, ...snykEnv };

            // @ts-expect-error backward compatibility for older VS Code versions
            output.push(new vscode.McpStdioServerDefinition(SERVER_KEY, cliPath, args, env));

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
  if (!securityAtInception.publishSecurityAtInceptionRules) return;
  try {
    const rulesContent = await readBundledRules(vscodeContext);
    if (securityAtInception.persistRulesInProjects) {
      await writeLocalRulesForIde(path.join('.github', 'instructions', 'snyk_rules.instructions.md'), rulesContent);
    } else {
      const isInsiders = vscode.env.appName.toLowerCase().includes('insiders');
      const globalPath = getCopilotGlobalRulesPath(isInsiders);
      await writeGlobalRules(globalPath, rulesContent);
    }
  } catch {
    Logger.error('Failed to publish Copilot rules');
  }
}

export async function configureWindsurf(vscodeContext: vscode.ExtensionContext, configuration: IConfiguration) {
  const securityAtInception = configuration.getSecurityAtInceptionConfig();
  try {
    if (securityAtInception.autoConfigureMcpServer) {
      const baseDir = path.join(os.homedir(), '.codeium', 'windsurf');
      const configPath = path.join(baseDir, 'mcp_config.json');
      if (!fs.existsSync(baseDir)) {
        Logger.debug(`Windsurf base directory not found at ${baseDir}, skipping MCP configuration.`);
      } else {
        const cliPath = await configuration.getCliPath();
        const env = await getSnykMcpEnv(configuration);
        await ensureMcpServerInJson(configPath, SERVER_KEY, cliPath, ['mcp', '-t', 'stdio'], env);
        Logger.debug(`Ensured Windsurf MCP config at ${configPath}`);
      }
    }
  } catch {
    Logger.error('Failed to update Windsurf MCP config');
  }

  try {
    if (!securityAtInception.publishSecurityAtInceptionRules) return;
    const rulesContent = await readBundledRules(vscodeContext);
    if (securityAtInception.persistRulesInProjects) {
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
  const securityAtInception = configuration.getSecurityAtInceptionConfig();
  try {
    if (securityAtInception.autoConfigureMcpServer) {
      const configPath = path.join(os.homedir(), '.cursor', 'mcp.json');
      const cliPath = await configuration.getCliPath();
      const env: Env = {};
      const token = await configuration.getToken();
      const authMethod = configuration.getAuthenticationMethod();
      const org = getOrganizationForMCP(configuration);
      if (org) env.SNYK_CFG_ORG = org;
      if (configuration.snykApiEndpoint) env.SNYK_API = configuration.snykApiEndpoint;
      if ((authMethod === 'pat' || authMethod === 'token') && token) {
        env.SNYK_TOKEN = token ?? '';
      }

      await ensureMcpServerInJson(configPath, SERVER_KEY, cliPath, ['mcp', '-t', 'stdio'], env);
      Logger.debug(`Ensured Cursor MCP config at ${configPath}`);
    }
  } catch {
    Logger.error('Failed to update Cursor MCP config');
  }

  try {
    if (!securityAtInception.publishSecurityAtInceptionRules) return;
    const rulesContent = await readBundledRules(vscodeContext);
    if (securityAtInception.persistRulesInProjects) {
      await writeLocalRulesForIde(path.join('.cursor', 'rules', 'snyk_rules.mdc'), rulesContent);
    } else {
      void vscode.window.showInformationMessage(
        'Cursor does not support filesystem based global rules. Only project rules can be persisted.',
      );
    }
  } catch {
    Logger.error('Failed to publish Cursor rules');
  }
}

/**
 * Organization can be per workspace folder, but we will just query each workspace folder in order until we find one (which may fall back to a higher scope).
 */
function getOrganizationForMCP(configuration: IConfiguration): string | undefined {
  for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
    const org = configuration.getOrganization(workspaceFolder);
    if (org) {
      return org;
    }
  }
  return undefined;
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

  const serverKeyLower = serverKey.toLowerCase();
  let matchedKey: string | undefined = undefined;
  for (const key of Object.keys(config.mcpServers)) {
    const lower = key.toLowerCase();
    if (lower === serverKeyLower || lower.includes(serverKeyLower)) {
      matchedKey = key;
      break;
    }
  }
  const keyToUse = matchedKey ?? serverKey;
  const existing = config.mcpServers[keyToUse];
  const desired: McpServer = { command, args, env };

  // Merge env: keep existing keys; override Snyk keys only if already present
  let resultingEnv: Env;
  if (existing && existing.env) {
    resultingEnv = { ...existing.env };
    const overrideKeys: (keyof Env)[] = ['SNYK_TOKEN', 'SNYK_CFG_ORG', 'SNYK_API'];
    for (const k of overrideKeys) {
      if (Object.hasOwn(existing.env, k) && typeof env[k] !== 'undefined') {
        resultingEnv[k] = env[k];
      }
    }
  } else {
    resultingEnv = { ...(env || {}) };
  }

  const needsWrite =
    !existing ||
    existing.command !== desired.command ||
    JSON.stringify(existing.args) !== JSON.stringify(desired.args) ||
    JSON.stringify(existing.env || {}) !== JSON.stringify(resultingEnv || {});

  if (!needsWrite) return;

  config.mcpServers[keyToUse] = { command, args, env: resultingEnv };
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
  await folders.reduce(
    (promise, folder) =>
      promise.then(async () => {
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
      }),
    Promise.resolve(),
  );
}

function getCopilotGlobalRulesPath(isInsiders: boolean): string {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const codeDirName = isInsiders ? 'Code - Insiders' : 'Code';
  const base = isWindows
    ? path.join(os.homedir(), 'AppData', 'Roaming', codeDirName, 'User', 'prompts')
    : isMac
    ? path.join(os.homedir(), 'Library', 'Application Support', codeDirName, 'User', 'prompts')
    : path.join(os.homedir(), '.config', codeDirName, 'User', 'prompts');
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

async function getSnykMcpEnv(configuration: IConfiguration): Promise<Env> {
  const env: Env = {};
  const org = getOrganizationForMCP(configuration);
  if (org) {
    env.SNYK_CFG_ORG = org;
  }
  if (configuration.snykApiEndpoint) {
    env.SNYK_API = configuration.snykApiEndpoint;
  }

  const token = await configuration.getToken();
  const authMethod = configuration.getAuthenticationMethod();
  if ((authMethod === 'pat' || authMethod === 'token') && token) {
    env.SNYK_TOKEN = token; // No need for '?? \'\''
  }

  return env;
}
