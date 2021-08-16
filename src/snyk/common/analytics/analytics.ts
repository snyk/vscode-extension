import { configuration } from '../configuration/instance';
import { Logger } from '../logger/logger';
import { IAnalytics, Iteratively } from './itly';

export const analytics: IAnalytics = new Iteratively(
  Logger,
  configuration.shouldReportEvents,
  configuration.isDevelopment,
);
