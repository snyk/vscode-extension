import { IExtension } from '../../base/modules/interfaces';
import { ILog } from '../logger/interfaces';
import { configuration } from './instance';
import {
  DEFAULT_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY_CONFIG,
  AutoConfigureMcpServerConfig,
  SecureAtInceptionExecutionFrequencyConfig,
} from './configuration';
import {
  MEMENTO_AUTO_CONFIGURE_MCP_SERVER_CONFIG,
  MEMENTO_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY_CONFIG,
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

  const currentAutoConfigureMcpServerConfig = configuration.getAutoConfigureMcpServerConfig();
  const currentSecureAtInceptionExecutionFrequencyConfig = configuration.getSecureAtInceptionExecutionFrequencyConfig();

  let previousAutoConfigureMcpServerConfig = extension.context.getGlobalStateValue<AutoConfigureMcpServerConfig>(
    MEMENTO_AUTO_CONFIGURE_MCP_SERVER_CONFIG,
  );

  let previousSecureAtInceptionExecutionFrequencyConfig =
    extension.context.getGlobalStateValue<SecureAtInceptionExecutionFrequencyConfig>(
      MEMENTO_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY_CONFIG,
    );

  await extension.context.updateGlobalStateValue(
    MEMENTO_AUTO_CONFIGURE_MCP_SERVER_CONFIG,
    currentAutoConfigureMcpServerConfig,
  );
  await extension.context.updateGlobalStateValue(
    MEMENTO_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY_CONFIG,
    currentSecureAtInceptionExecutionFrequencyConfig,
  );

  if (!previousAutoConfigureMcpServerConfig) {
    previousAutoConfigureMcpServerConfig = { autoConfigureMcpServer: false };
  }

  if (!previousSecureAtInceptionExecutionFrequencyConfig) {
    previousSecureAtInceptionExecutionFrequencyConfig = DEFAULT_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY_CONFIG;
  }

  const autoConfigureMcpServerConfigFields = Object.keys(currentAutoConfigureMcpServerConfig) as Array<
    keyof AutoConfigureMcpServerConfig
  >;

  const secureAtInceptionExecutionFrequencyConfigFields = Object.keys(
    currentSecureAtInceptionExecutionFrequencyConfig,
  ) as Array<keyof SecureAtInceptionExecutionFrequencyConfig>;

  autoConfigureMcpServerConfigFields
    .filter(field => currentAutoConfigureMcpServerConfig[field] !== previousAutoConfigureMcpServerConfig[field])
    .forEach(field =>
      sendConfigChangedAnalytics(
        extension,
        logger,
        user,
        field,
        previousAutoConfigureMcpServerConfig[field],
        currentAutoConfigureMcpServerConfig[field],
      ),
    );

  secureAtInceptionExecutionFrequencyConfigFields
    .filter(
      field =>
        currentSecureAtInceptionExecutionFrequencyConfig[field] !==
        previousSecureAtInceptionExecutionFrequencyConfig[field],
    )
    .forEach(field =>
      sendConfigChangedAnalytics(
        extension,
        logger,
        user,
        field,
        previousSecureAtInceptionExecutionFrequencyConfig[field],
        currentSecureAtInceptionExecutionFrequencyConfig[field],
      ),
    );

  await configureMcpHosts(vscodeContext, configuration);
}

function sendConfigChangedAnalytics(
  extension: IExtension,
  logger: ILog,
  user: User,
  field: keyof AutoConfigureMcpServerConfig | keyof SecureAtInceptionExecutionFrequencyConfig,
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
