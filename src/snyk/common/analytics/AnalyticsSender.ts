import { ILog } from '../logger/interfaces';
import { IConfiguration } from '../configuration/configuration';
import { sleep } from '@amplitude/experiment-node-server/dist/src/util/time';
import { IVSCodeCommands } from '../vscode/commands';
import { SNYK_REPORT_ANALTYICS } from '../constants/commands';

interface EventPair {
  event: AbstractAnalyticsEvent;
  callback: (value: void) => void;
}

// This is just a marker interface, to ensure type security when sending events
export interface AbstractAnalyticsEvent {}

export class AnalyticsSender {
  private static instance: AnalyticsSender;
  private eventQueue: EventPair[] = [];
  private configuration: IConfiguration;
  private logger: ILog;
  private commandExecutor: IVSCodeCommands;

  private constructor(logger: ILog, configuration: IConfiguration, commandExecutor: IVSCodeCommands) {
    this.logger = logger;
    this.configuration = configuration;
    this.commandExecutor = commandExecutor;

    void this.start();
  }

  public static getInstance(
    logger: ILog,
    configuration: IConfiguration,
    commandExecutor: IVSCodeCommands,
  ): AnalyticsSender {
    if (!AnalyticsSender.instance) {
      AnalyticsSender.instance = new AnalyticsSender(logger, configuration, commandExecutor);
    }
    return AnalyticsSender.instance;
  }

  private async start(): Promise<void> {
    // noinspection InfiniteLoopJS
    while (true) {
      const authToken = await this.configuration.getToken();

      if (this.eventQueue.length === 0 || !authToken || authToken.trim() === '') {
        await sleep(1000);
        continue;
      }

      const copyForSending = [...this.eventQueue];
      for (let i = 0; i < copyForSending.length; i++) {
        const eventPair = copyForSending[i];
        try {
          const args = [];
          args.push(eventPair.event);
          await this.commandExecutor.executeCommand(SNYK_REPORT_ANALTYICS, args);
          eventPair.callback();
        } catch (e) {
          this.logger.error(e);
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
