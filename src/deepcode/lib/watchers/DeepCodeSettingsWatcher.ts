import * as vscode from "vscode";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";

class DeepCodeSettingsWatcher implements DeepCode.DeepCodeWatcherInterface {
  
  private async onChangeBaseURL(extension: DeepCode.ExtensionInterface): Promise<void> {
    const extensionConfig = vscode.workspace.getConfiguration('deepcode');
    // @ts-ignore */}
    const url: string = extensionConfig.get('url');
    
    const cleaned = url.replace(/\/$/, '');
    if (cleaned !== url) {
      extensionConfig.update('url', cleaned, true);
    } else {
      await extension.store.cleanStore();
      await extension.activateExtensionAnalyzeActions();
    }
  }

  public activate(extension: DeepCode.ExtensionInterface): void {
    vscode.workspace.onDidChangeConfiguration(
      (event: vscode.ConfigurationChangeEvent): void => {
        if (event.affectsConfiguration('deepcode.url')) {
          this.onChangeBaseURL(extension);
        }
      }
    );
  }
}

export default DeepCodeSettingsWatcher;
