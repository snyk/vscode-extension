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
  const filePath = path.join('.github', 'instructions', 'snyk_rules.instructions.md');
  try {
    if (securityAtInception.secureAtInceptionExecutionFrequency === 'Manual') {
      // Delete rules from project
      await deleteLocalRulesForIde(filePath);
      return;
    }
    const rulesContent = await readBundledRules(vscodeContext);
    await writeLocalRulesForIde(filePath, rulesContent);
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

  const localPath = path.join('.windsurf', 'rules', 'snyk_rules.md');
  try {
    if (securityAtInception.secureAtInceptionExecutionFrequency === 'Manual') {
      // Delete rules from project
      await deleteLocalRulesForIde(localPath);
      return;
    }
    const rulesContent = await readBundledRules(vscodeContext);
    await writeLocalRulesForIde(localPath, rulesContent);
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
      const env = await getSnykMcpEnv(configuration);

      await ensureMcpServerInJson(configPath, SERVER_KEY, cliPath, ['mcp', '-t', 'stdio'], env);
      Logger.debug(`Ensured Cursor MCP config at ${configPath}`);
    }
  } catch {
    Logger.error('Failed to update Cursor MCP config');
  }

  try {
    if (securityAtInception.secureAtInceptionExecutionFrequency === 'Manual') {
      // Delete rules from project (Cursor doesn't support global rules)
      await deleteLocalRulesForIde(path.join('.cursor', 'rules', 'snyk_rules.mdc'));
      return;
    }
    const rulesContent = await readBundledRules(vscodeContext);
    await writeLocalRulesForIde(path.join('.cursor', 'rules', 'snyk_rules.mdc'), rulesContent);
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
  return await fs.promises.readFile(
    path.join(vsCodeContext.extensionPath, 'out', 'assets', 'snyk_rules_always_apply.md'),
    'utf8',
  );
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

async function deleteLocalRulesForIde(relativeRulesPath: string): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return;
  }
  for (const folder of folders) {
    const root = folder.uri.fsPath;
    const rulesPath = path.join(root, relativeRulesPath);
    try {
      if (fs.existsSync(rulesPath)) {
        await fs.promises.unlink(rulesPath);
        Logger.debug(`Deleted local rules from ${rulesPath}`);
      }
    } catch (err) {
      Logger.debug(`Failed to delete local rules from ${rulesPath}: ${err}`);
    }
  }
}

async function getSnykMcpEnv(configuration: IConfiguration): Promise<Env> {
  const env: Env = {};
  if (configuration.organization) {
    env.SNYK_CFG_ORG = configuration.organization;
  }
  if (configuration.snykApiEndpoint) {
    env.SNYK_API = configuration.snykApiEndpoint;
  }
  const trustedFolders = configuration.getTrustedFolders();
  if (trustedFolders.length > 0) {
    env.TRUSTED_FOLDERS = trustedFolders.join(';');
  }
  const token = await configuration.getToken();
  const authMethod = configuration.getAuthenticationMethod();
  if ((authMethod === 'pat' || authMethod === 'token') && token) {
    env.SNYK_TOKEN = token;
  }

  return env;
}
