import * as vscode from "vscode";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import { DEEPCODE_SEVERITIES } from "../../constants/analysis";
import { HIDE_INFORMATION_ISSUES_SSETTING } from "../../constants/settings";

class DeepCodeSettingsWatcher implements DeepCode.DeepCodeWatcherInterface {
  private handleInformationIssuesStatus(
    extension: DeepCode.ExtensionInterface
  ): void {
    const settings = vscode.workspace.getConfiguration();
    const updateWorkspaceSetting = (value: boolean): void => {
      settings.update(
        HIDE_INFORMATION_ISSUES_SSETTING,
        value,
        vscode.ConfigurationTarget.Workspace
      );
    };
    const hideInfoIssuesSetting = settings.inspect(
      HIDE_INFORMATION_ISSUES_SSETTING
    );

    if (hideInfoIssuesSetting) {
      const {
        globalValue,
        workspaceValue,
        defaultValue
      } = hideInfoIssuesSetting;
      let hideInAnalysis: boolean = !!defaultValue;

      if (globalValue) {
        hideInAnalysis = !!globalValue;
        updateWorkspaceSetting(hideInAnalysis);
      } else {
        if (workspaceValue === undefined) {
          updateWorkspaceSetting(hideInAnalysis);
        } else {
          hideInAnalysis = !!workspaceValue;
        }
      }
      extension.analyzer.configureIssuesDisplayBySeverity(
        DEEPCODE_SEVERITIES.information,
        !!hideInAnalysis
      );
    }
  }

  public activate(extension: DeepCode.ExtensionInterface): void {
    this.handleInformationIssuesStatus(extension);

    vscode.workspace.onDidChangeConfiguration(
      (event: vscode.ConfigurationChangeEvent): void => {
        if (event.affectsConfiguration(HIDE_INFORMATION_ISSUES_SSETTING)) {
          this.handleInformationIssuesStatus(extension);
        }
      }
    );
  }
}

export default DeepCodeSettingsWatcher;
