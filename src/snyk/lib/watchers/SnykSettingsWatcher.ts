import * as vscode from "vscode";
import { SnykWatcherInterface, ExtensionInterface } from "../../../interfaces/SnykInterfaces";
import { errorsLogs } from "../../messages/errorsServerLogMessages";

class SnykSettingsWatcher implements SnykWatcherInterface {

  private async onChangeConfiguration(extension: ExtensionInterface, key: string): Promise<void> {
    if (key === 'snyk.advancedMode') {
      return extension.checkAdvancedMode();
    }
    const extensionConfig = vscode.workspace.getConfiguration('snyk');
    // @ts-ignore */}
    const url: string = extensionConfig.get('url');

    const cleaned = url.replace(/\/$/, '');
    if (cleaned !== url) {
      extensionConfig.update('url', cleaned, true);
    } else {
      await extension.startExtension();
    }
  }

  public activate(extension: ExtensionInterface): void {
    vscode.workspace.onDidChangeConfiguration(
      async (event: vscode.ConfigurationChangeEvent): Promise<void> => {
        const change = [
          'snyk.url', 'snyk.token', 'snyk.codeEnabled', 'snyk.advancedMode'
        ].find(config => event.affectsConfiguration(config));
        if (change) {
          try {
            await this.onChangeConfiguration(extension, change);
          } catch (error) {
            await extension.processError(error, {
              message: errorsLogs.configWatcher,
              data: {
                configurationKey: change,
              }
            })
          }
        }
      }
    );
  }
}

export default SnykSettingsWatcher;
