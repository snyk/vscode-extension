import * as vscode from "vscode";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import { DEEPCODE_SEVERITIES } from "../../constants/analysis";
import {
  DEEPCODE_CLOUD_BACKEND
} from "../../constants/settings";

class DeepCodeSettingsWatcher implements DeepCode.DeepCodeWatcherInterface {
  
  private prepareBackendUrlFromSettings(url: string) {
    const SLASH = "/";
    const lastletter = url.charAt(url.length - 1);
    return lastletter === SLASH ? url : `${url}/`;
  }

  private async changeDeepCodeCloudBackend(
    extension: DeepCode.ExtensionInterface
  ): Promise<void> {
    const deepcodeCloudBackend = vscode.workspace
      .getConfiguration()
      .inspect(DEEPCODE_CLOUD_BACKEND);
    if (deepcodeCloudBackend) {
      const { globalValue, defaultValue } = deepcodeCloudBackend;
      if (globalValue && globalValue !== defaultValue) {
        const backendUrl = this.prepareBackendUrlFromSettings(`${globalValue}`);
        extension.config.changeDeepCodeUrl(backendUrl);
        await extension.store.cleanStore();
        await extension.store.actions.setBackendConfigStatus(true);
        extension.cancelFirstSaveFlag();
        await extension.activateActions();
        return;
      }
      if (!globalValue) {
        await extension.store.cleanStore();
        extension.cancelFirstSaveFlag();
      }
    }
  }

  public activate(extension: DeepCode.ExtensionInterface): void {
    vscode.workspace.onDidChangeConfiguration(
      (event: vscode.ConfigurationChangeEvent): void => {
        if (event.affectsConfiguration(DEEPCODE_CLOUD_BACKEND)) {
          this.changeDeepCodeCloudBackend(extension);
        }
      }
    );
  }
}

export default DeepCodeSettingsWatcher;
