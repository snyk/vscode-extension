import * as vscode from "vscode";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";

class DeepCodeSettingsWatcher implements DeepCode.DeepCodeWatcherInterface {
  
  private async onChangeConfiguration(extension: DeepCode.ExtensionInterface): Promise<void> {
    const extensionConfig = vscode.workspace.getConfiguration('deepcode');
    // @ts-ignore */}
    const url: string = extensionConfig.get('url');
    
    const cleaned = url.replace(/\/$/, '');
    if (cleaned !== url) {
      extensionConfig.update('url', cleaned, true);
    } else {
      await extension.startExtension();
    }
  }

  public activate(extension: DeepCode.ExtensionInterface): void {
    vscode.workspace.onDidChangeConfiguration(
      (event: vscode.ConfigurationChangeEvent): void => {
        if (
          event.affectsConfiguration('deepcode.url') || 
          event.affectsConfiguration('deepcode.token') ||
          event.affectsConfiguration('deepcode.uploadApproved')
        ) {
          this.onChangeConfiguration(extension);
        }
      }
    );
  }
}

export default DeepCodeSettingsWatcher;
