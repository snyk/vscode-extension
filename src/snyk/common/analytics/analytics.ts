import { configuration } from '../configuration';
import { Logger } from '../logger/logger';
import { IAnalytics, Iteratively } from './itly';

export const analytics: IAnalytics = new Iteratively(
  Logger,
  configuration.shouldReportEvents,
  configuration.isDevelopment,
);
