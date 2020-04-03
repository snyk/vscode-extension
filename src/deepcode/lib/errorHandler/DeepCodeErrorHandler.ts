import * as vscode from "vscode";
import * as open from "open";
import {
  statusCodes,
  ATTEMPTS_AMMOUNT,
  SERVER_CONNECTION_TIMEOUT,
} from "../../constants/statusCodes";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import { startDeepCodeCommand } from "../../utils/vscodeCommandsUtils";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import { IDE_NAME } from "../../constants/general";
import http from "../../http/requests";

class DeepCodeErrorHandler implements DeepCode.ErrorHandlerInterface {
  private unauthorizedErrorSolveAttemts: number = ATTEMPTS_AMMOUNT;
  private firstWorkspaceFlag: boolean = false;

  private async generalError(): Promise<void> {
    const { msg: errorMsg, button: tryButton } = deepCodeMessages.error;
    const button = await vscode.window.showErrorMessage(errorMsg, tryButton);
    if (button === tryButton) {
      startDeepCodeCommand();
    }
  }

  private async serverErrorHandler(extension: DeepCode.ExtensionInterface | any,): Promise<void> {
    let ATTEMPTS_AMMOUNT = await extension.store.selectors.getServerConnectionAttempts();

    if (!ATTEMPTS_AMMOUNT) {
      await extension.store.actions.setServerConnectionAttempts(10);
      return;
    }
    
    const { msg } = deepCodeMessages.noConnection;
    vscode.window.showErrorMessage(msg);
    
    setTimeout(async () => {
      startDeepCodeCommand();
      await extension.store.actions.setServerConnectionAttempts(--ATTEMPTS_AMMOUNT);
    }, SERVER_CONNECTION_TIMEOUT);
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
      bigPayload,
      serverError,
      badGateway,
      serviceUnavailable,
      timeout
    } = statusCodes;
    await this.sendErrorToServer(extension, error, options);

    if (error.error) {
      const {code, message } = error.error;
      if (code === "ENOTFOUND" && message === 'getaddrinfo ENOTFOUND www.deepcode.ai') {
        return this.serverErrorHandler(extension);
      }
    }
    
    switch (error.statusCode) {
      case unauthorizedUser:
        return this.unauthorizedUser(extension);
      case bigPayload:
        return this.bigPayloadHandler();
      case unauthorizedContent:
      case unauthorizedBundleAccess:
      case notFound:
        return this.unauthorizedBundleOrContent(extension, options);
      case serverError:
      case badGateway:
      case serviceUnavailable:
      case timeout:
        return this.serverErrorHandler(extension);
      default:
        return this.generalError();
    }
  }

  public async sendErrorToServer(
    extension: DeepCode.ExtensionInterface,
    error: DeepCode.errorType,
    options: { [key: string]: any }
  ): Promise<void> {
    const { errorDetails } = options;
    const body = {
      //for testing edpoint use source: 'test'
      source: IDE_NAME,
      type: `${error.statusCode || ""} ${error.name || ""}`.trim(),
      message: errorDetails.message || errorsLogs.undefinedError,
      ...(extension.token && { sessionToken: extension.token }),
      ...(errorDetails.endpoint && { path: errorDetails.endpoint }),
      ...(errorDetails.bundleId && { bundleId: errorDetails.bundleId }),
      ...(errorDetails.data && { data: errorDetails.data })
    };
    try {
      if (process.env.NODE_ENV === "production") {
        // please disable request sending in dev mode to avoid unnecessary reports to server
        await http.sendError(body);
      }

    } catch (err) {
      const updatedBody = {
        ...body,
        type: `${err.statusCode || ""} ${err.name || ""}`.trim(),
        message: errorsLogs.errorReportFail,
        data: {
          failedErrorReport: {
            ...body
          }
        }
      };

      await http.sendError(updatedBody);
    }
  }

  private async unauthorizedUser(
    extension: DeepCode.ExtensionInterface
  ): Promise<void> {
    await extension.store.actions.setLoggedInStatus(false);
    extension.token = "";
    extension.store.actions.setSessionToken("");
    const { msg, button } = deepCodeMessages.unauthorized;
    const loginAgainBtn = await vscode.window.showWarningMessage(msg, button);
    if (loginAgainBtn === button) {
      startDeepCodeCommand();
    }
  }

  private async unauthorizedBundleOrContent(
    extension: DeepCode.ExtensionInterface,
    options: { [key: string]: any }
  ): Promise<void> {
    if (options.loginNotFound) {
      startDeepCodeCommand();
      return;
    }
    if (!this.unauthorizedErrorSolveAttemts) {
      this.unauthorizedErrorSolveAttemts = ATTEMPTS_AMMOUNT;
      startDeepCodeCommand();
      return;
    }
    this.unauthorizedErrorSolveAttemts -= 1;
    await extension.performBundlesActions(options.workspacePath);
  }

  private async bigPayloadHandler(): Promise<void> {
    const { msg, button } = deepCodeMessages.payloadSizeError;
    const res = await vscode.window.showErrorMessage(msg, button);
    if (button === res) {
      startDeepCodeCommand();
    }
  }
}

export default DeepCodeErrorHandler;
