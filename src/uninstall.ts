import axios from 'axios';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { dirname, posix } from 'path';
import { ILog } from './interfaces/loggerInterface';
import { Iteratively } from './snyk/analytics/itly';
import { SNYK_NAME_EXTENSION } from './snyk/constants/general';
import { User } from './snyk/services/userService';

/**
 * The script is responsible for reporting uninstall event to the Iteratively.
 * As 'vscode' module is not available within uninstall hook, some of the extension code might be duplicated to eliminate this dependency.
 *
 * Some of the code is based on `vscode-icons` extension example:
 * https://github.com/vscode-icons/vscode-icons/blob/master/src/uninstall.ts
 */

class UninstallLogger implements ILog {
  info = (message: string) => this.log('Info', message);
  warn = (message: string) => this.log('Warn', message);
  error = (message: string) => this.log('Error', message);
  debug = (message: string) => this.log('Debug', message);

  log = (level: 'Info' | 'Warn' | 'Error' | 'Debug', message: string) => console.log(level, message);
}

async function isSingleInstallation(): Promise<boolean> {
  const regex = new RegExp(`(.+[\\|/]extensions[\\|/])(?:.*${SNYK_NAME_EXTENSION})`);
  const matches = regex.exec(dirname(__filename));
  const vscodeExtensionDirPath: string = (matches && matches.length > 0 && matches[1]) || './';

  const extensionNameRegExp = new RegExp(`.*${SNYK_NAME_EXTENSION}`);
  const existingInstallations: number = (await fs.readdir(vscodeExtensionDirPath)).filter((filename: string) =>
    extensionNameRegExp.test(filename),
  ).length;
  return existingInstallations === 1;
}

function getAppDataDirPath(): string {
  switch (process.platform) {
    case 'darwin':
      return `${homedir()}/Library/Application Support`;
    case 'linux':
      return `${homedir()}/.config`;
    case 'win32':
      return process.env.APPDATA as string;
    default:
      return '/var/local';
  }
}

async function getAppUserPath(dirPath: string): Promise<string> {
  const vscodeAppName = /[\\|/]\.vscode-oss-dev/i.test(dirPath)
    ? 'code-oss-dev'
    : /[\\|/]\.vscode-oss/i.test(dirPath)
    ? 'Code - OSS'
    : /[\\|/]\.vscode-insiders/i.test(dirPath)
    ? 'Code - Insiders'
    : /[\\|/]\.vscode/i.test(dirPath)
    ? 'Code'
    : 'user-data';
  // workaround until `process.env.VSCODE_PORTABLE` gets available
  const vscodePortable = async (): Promise<string | undefined> => {
    if (vscodeAppName !== 'user-data') {
      return undefined;
    }
    const vscodeCwd = process.env.VSCODE_CWD as string;
    const isInsiders = await fs.stat(posix.join(vscodeCwd, 'code-insiders-portable-data'));
    let dataDir: string;
    switch (process.platform) {
      case 'darwin':
        dataDir = `code-${isInsiders ? 'insiders-' : ''}portable-data`;
        break;
      default:
        dataDir = 'data';
        break;
    }
    return posix.join(vscodeCwd, dataDir);
  };

  const appPath = process.env.VSCODE_PORTABLE || (await vscodePortable()) || getAppDataDirPath();
  return posix.join(appPath, vscodeAppName, 'User');
}

async function getUserId(authToken: string): Promise<string> {
  const http = axios.create({
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `token ${authToken}`,
    },
    responseType: 'json',
  });

  const { data } = await http.get<User>('https://snyk.io/api/v1/user/me');
  return data.id;
}

async function getSnykSettings(): Promise<[string | undefined, boolean]> {
  const vscodeSettingsFilePath = posix.join(await getAppUserPath(dirname(__filename)), 'settings.json');

  const raw = await fs.readFile(vscodeSettingsFilePath, 'utf8');

  const tokenLine = /(?<!\/\/\s*)"snyk\.token":\s*"(\S*)"/.exec(raw);
  const token = tokenLine == null ? undefined : tokenLine[1];

  const telemetryLine = /(?<!\/\/\s*)"snyk\.yesTelemetry":\s*(\S*)/.exec(raw);
  const yesTelemetry = telemetryLine == null ? true : telemetryLine[1].replace(/,/g, '') === 'true';

  return [token, yesTelemetry];
}

async function reportUninstall(): Promise<void> {
  // Ensure no extension update is happening
  const singleInstallation = await isSingleInstallation();
  if (!singleInstallation) {
    return;
  }

  const [token, yesTelemetry] = await getSnykSettings();
  if (!token) {
    return;
  }

  const analytics = new Iteratively(new UninstallLogger(), yesTelemetry, !!process.env.SNYK_VSCE_DEVELOPMENT);
  analytics.load();

  const userId = await getUserId(token);

  // Report event
  analytics.logPluginIsUninstalled(userId);
}

void reportUninstall();
