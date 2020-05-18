import * as vscode from "vscode";
import { statusCodes } from "../../constants/statusCodes";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import { startDeepCodeCommand } from "../../utils/vscodeCommandsUtils";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import { IDE_NAME } from "../../constants/general";
import http from "../../http/requests";

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

class DeepCodeErrorHandler implements DeepCode.ErrorHandlerInterface {
  private async generalError(): Promise<void> {
    const { msg: errorMsg, button: tryButton } = deepCodeMessages.error;
    const button = await vscode.window.showErrorMessage(errorMsg, tryButton);
    if (button === tryButton) {
      startDeepCodeCommand();
    }
  }

  private async serverErrorHandler(extension: DeepCode.ExtensionInterface | any): Promise<void> {
    const { msg } = deepCodeMessages.noConnection;
    vscode.window.showErrorMessage(msg);
    
    setTimeout(async () => {
      startDeepCodeCommand();
    }, 5000);
  }

  public async processError(
    extension: DeepCode.ExtensionInterface | any,
    error: DeepCode.errorType,
    options: { [key: string]: any } = {}
  ): Promise<void> {
    const {
      unauthorizedUser,
      unauthorizedContent,
      unauthorizedBundleAccess,
      notFound,
      serverError,
      badGateway,
      serviceUnavailable,
      timeout
    } = statusCodes;
    await this.sendErrorToServer(extension, error, options);

    if (error.error) {
      const {code, message } = error.error;
      // TODO: move it to 'tsc'
      if (code === "ENOTFOUND" && message === 'getaddrinfo ENOTFOUND www.deepcode.ai') {
        return this.serverErrorHandler(extension);
      }
    }
    
    switch (error.statusCode) {
      case unauthorizedUser:
        console.log('unauthorizedUser');
        return this.unauthorizedAccess(extension);
      case notFound:
        console.log('notFound');
        return this.unauthorizedAccess(extension);
      case unauthorizedContent:
      case unauthorizedBundleAccess:
      case serverError:
      case badGateway:
      case serviceUnavailable:
      case timeout:
        return this.serverErrorHandler(extension);
      default:
        return this.generalError();
    }
  }

  private async sendErrorToServer(
    extension: DeepCode.ExtensionInterface,
    error: DeepCode.errorType,
    options: { [key: string]: any }
  ): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      // please disable request sending in dev mode to avoid unnecessary reports to server
      await http.sendError({
        //for testing edpoint use source: 'test'
        source: IDE_NAME,
        type: `${error.statusCode || ""} ${error.name || ""}`.trim(),
        message: options.message || errorsLogs.undefinedError,
        ...(extension.token && { sessionToken: extension.token }),
        ...(options.endpoint && { path: options.endpoint }),
        ...(options.bundleId && { bundleId: options.bundleId }),
        ...(options.data && { data: options.data })
      });
    }
  }

  private async unauthorizedAccess(extension: DeepCode.ExtensionInterface): Promise<void> {
    do {
      await extension.initiateLogin();
    } while (!extension.token)

    await sleep(2000);
    await extension.activateExtensionAnalyzeActions();
  }

}

export default DeepCodeErrorHandler;
