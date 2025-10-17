import { IExtension } from '../../base/modules/interfaces';
import { ILog } from '../logger/interfaces';
import { configuration } from './instance';
import { DEFAULT_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY } from './configuration';
import {
  MEMENTO_AUTO_CONFIGURE_MCP_SERVER,
  MEMENTO_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY,
} from '../constants/globalState';
import { User } from '../user';
import { AnalyticsSender } from '../analytics/AnalyticsSender';
import { AnalyticsEvent } from '../analytics/AnalyticsEvent';
import { vsCodeCommands } from '../vscode/commands';
import { configureMcpHosts } from '../../cli/mcp/mcp';
import * as vscode from 'vscode';

export async function handleSecurityAtInceptionChange(
  extension: IExtension,
  logger: ILog,
  user: User,
  vscodeContext: vscode.ExtensionContext,
): Promise<void> {
  if (!extension.context) {
    return;
  }

  const currentAutoConfigureMcpServerConfig = configuration.getAutoConfigureMcpServer();
  const currentSecureAtInceptionExecutionFrequencyConfig = configuration.getSecureAtInceptionExecutionFrequency();

  let previousAutoConfigureMcpServerConfig =
    extension.context.getGlobalStateValue<boolean>(MEMENTO_AUTO_CONFIGURE_MCP_SERVER) ?? false;

  let previousSecureAtInceptionExecutionFrequencyConfig =
    extension.context.getGlobalStateValue<string>(MEMENTO_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY) ??
    DEFAULT_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY;

  if (currentAutoConfigureMcpServerConfig !== previousAutoConfigureMcpServerConfig) {
    await extension.context.updateGlobalStateValue(
      MEMENTO_AUTO_CONFIGURE_MCP_SERVER,
      currentAutoConfigureMcpServerConfig,
    );

    sendConfigChangedAnalytics(
      extension,
      logger,
      user,
      'autoConfigureSnykMcpServer',
      previousAutoConfigureMcpServerConfig,
      currentAutoConfigureMcpServerConfig,
    );
  }

  if (currentSecureAtInceptionExecutionFrequencyConfig !== previousSecureAtInceptionExecutionFrequencyConfig) {
    await extension.context.updateGlobalStateValue(
      MEMENTO_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY,
      currentSecureAtInceptionExecutionFrequencyConfig,
    );

    sendConfigChangedAnalytics(
      extension,
      logger,
      user,
      'secureAtInceptionExecutionFrequency',
      previousSecureAtInceptionExecutionFrequencyConfig,
      currentSecureAtInceptionExecutionFrequencyConfig,
    );
  }

  await configureMcpHosts(vscodeContext, configuration);
}

function sendConfigChangedAnalytics(
  extension: IExtension,
  logger: ILog,
  user: User,
  field: string,
  oldValue: boolean | string,
  newValue: boolean | string,
): void {
  const analyticsSender = AnalyticsSender.getInstance(logger, configuration, vsCodeCommands, extension.contextService);

  const event = new AnalyticsEvent(user.anonymousId, 'Config changed', []);
  event.getExtension().set(`config::${field}::oldValue`, oldValue);
  event.getExtension().set(`config::${field}::newValue`, newValue);

  analyticsSender.logEvent(event, () => {
    logger.info(`Analytics event sent for config change: securityAtInception.${field}`);
  });
}
