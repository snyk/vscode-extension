import * as vscode from "vscode";
import DeepCode from "../interfaces/DeepCodeInterfaces";

class DeepCodeConfig implements DeepCode.ExtensionConfigInterface {
  public deepcode: DeepCode.DeepCodeConfig;
  constructor() {
    this.deepcode = this.createExtensionConfig();
  }

  private createExtensionConfig() {
    const extensionConfig = {
      deepcodeUrl: "",
      get termsConditionsUrl(): string {
        return `${this.deepcodeUrl}tc?utm_source=vsc`;
      },
      changeDeepCodeUrl: (url: string): void => {
        this.deepcode.deepcodeUrl = url;
      }
    };
    return extensionConfig;
  }
}

export default DeepCodeConfig;
