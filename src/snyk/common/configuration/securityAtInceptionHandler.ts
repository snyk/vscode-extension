import { IExtension } from '../../base/modules/interfaces';
import { ILog } from '../logger/interfaces';
import { configuration } from './instance';
import { DEFAULT_SECURITY_AT_INCEPTION, SecurityAtInceptionConfig } from './configuration';
import { MEMENTO_SECURITY_AT_INCEPTION_CONFIG } from '../constants/globalState';
import { User } from '../user';
import { AnalyticsSender } from '../analytics/AnalyticsSender';
import { AnalyticsEvent } from '../analytics/AnalyticsEvent';
import { vsCodeCommands } from '../vscode/commands';

export async function handleSecurityAtInceptionChange(extension: IExtension, logger: ILog, user: User): Promise<void> {
  if (!extension.context) {
    return;
  }

  const currentConfig = configuration.getSecurityAtInceptionConfig();
  let previousConfig = extension.context.getGlobalStateValue<SecurityAtInceptionConfig>(
    MEMENTO_SECURITY_AT_INCEPTION_CONFIG,
  );

  // Persist current config to memento
  await extension.context.updateGlobalStateValue(MEMENTO_SECURITY_AT_INCEPTION_CONFIG, currentConfig);

  if (!previousConfig) {
    previousConfig = DEFAULT_SECURITY_AT_INCEPTION;
  }

  const fields = Object.keys(currentConfig) as Array<keyof SecurityAtInceptionConfig>;

  fields
    .filter(field => currentConfig[field] !== previousConfig[field])
    .map(field =>
      sendConfigChangedAnalytics(extension, logger, user, field, previousConfig[field], currentConfig[field]),
    );
}

function sendConfigChangedAnalytics(
  extension: IExtension,
  logger: ILog,
  user: User,
  field: keyof SecurityAtInceptionConfig,
  oldValue: string | boolean,
  newValue: string | boolean,
): void {
  const analyticsSender = AnalyticsSender.getInstance(logger, configuration, vsCodeCommands, extension.contextService);

  const event = new AnalyticsEvent(user.anonymousId, 'Config changed', []);
  event.getExtension().set(`config::${field}::oldValue`, oldValue);
  event.getExtension().set(`config::${field}::newValue`, newValue);

  analyticsSender.logEvent(event, () => {
    logger.info(`Analytics event sent for config change: securityAtInception.${field}`);
  });
}
