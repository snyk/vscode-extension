import * as vscode from 'vscode';
import { configuration } from '../../configuration';
import { snykMessages } from '../../messages/snykMessages';
import { viewInBrowser } from '../../utils/vscodeCommandsUtils';

export interface ISnykCode {
    isEnabled(): Promise<boolean>;
    enable(): Promise<boolean>;
}

export class SnykCode {
    public async isEnabled(): Promise<boolean> {
        const apiEnabled = false; // todo: fetch sast bool from api
        if (!apiEnabled) {
          const pressedButton = await vscode.window.showInformationMessage(
            snykMessages.codeDisabled.msg,
            snykMessages.codeDisabled.enableCode,
            snykMessages.codeDisabled.remindLater,
          );

          if (pressedButton === snykMessages.codeDisabled.enableCode) {
            viewInBrowser(configuration.snykCodeUrl);
          } else {
            // todo: Remind later? how often? every week? every extension activation?
          }
        }

        const inSettingsEnabled = configuration.codeEnabled;

        // todo: remove old settings entry if enabled

        return inSettingsEnabled;
      }

      public async enable(): Promise<boolean> {
        // TODO: set only if org level setting is true
        const apiEnabled = false;
        if (!apiEnabled) {
          return false;;
        }

        await configuration.setCodeEnabled(true);

        return true;
      }
}