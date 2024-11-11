// noinspection InfiniteLoopJS

import { ILog } from '../logger/interfaces';
import { IConfiguration } from '../configuration/configuration';
import { sleep } from '@amplitude/experiment-node-server/dist/src/util/time';
import { IVSCodeCommands } from '../vscode/commands';
import { SNYK_REPORT_ANALYTICS } from '../constants/commands';
import { IContextService } from '../services/contextService';
import { SNYK_CONTEXT } from '../constants/views';

interface EventPair {
  event: AbstractAnalyticsEvent;
  callback: (value: void) => void;
}

// This is just a marker interface, to ensure type security when sending events
export interface AbstractAnalyticsEvent {}

export class AnalyticsSender {
  private static instance: AnalyticsSender;
  private eventQueue: EventPair[] = [];

  constructor(
    private logger: ILog,
    private configuration: IConfiguration,
    private commandExecutor: IVSCodeCommands,
    private contextService: IContextService,
  ) {
    void this.start();
  }

  public static getInstance(
    logger: ILog,
    configuration: IConfiguration,
    commandExecutor: IVSCodeCommands,
    contextService: IContextService,
  ): AnalyticsSender {
    if (!AnalyticsSender.instance) {
      AnalyticsSender.instance = new AnalyticsSender(logger, configuration, commandExecutor, contextService);
    }
    return AnalyticsSender.instance;
  }

  private async start(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const authToken = await this.configuration.getToken();
      const initialized: boolean = (this.contextService.viewContext[SNYK_CONTEXT.INITIALIZED] as boolean) ?? false;
      const hasEvents = this.eventQueue.length > 0;
      const authenticated = authToken && authToken.trim() !== '';
      const iAmTired = !(initialized && authenticated && hasEvents);

      if (iAmTired) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(5000);
        continue;
      }

      const copyForSending = [...this.eventQueue];
      for (let i = 0; i < copyForSending.length; i++) {
        const eventPair = copyForSending[i];
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.commandExecutor.executeCommand(SNYK_REPORT_ANALYTICS, JSON.stringify(eventPair.event));
          eventPair.callback();
        } catch (error) {
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          this.logger.error(`could not send ${eventPair.event} ${error}`);
        } finally {
          // let's not rely on indexes in the eventQueue array not having changed
          const index = this.eventQueue.indexOf(eventPair);
          if (index > -1) {
            this.eventQueue.splice(index, 1);
          }
        }
      }
    }
  }

  public logEvent(event: AbstractAnalyticsEvent, callback: (value: void) => void): void {
    this.eventQueue.push({ event, callback });
  }
}
