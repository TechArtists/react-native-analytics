import { TALogger } from './logger';
import type {
  AnalyticsAdaptor,
  AnalyticsParams,
  AnalyticsParameterValue,
  EventAnalyticsModel,
} from './models';

type DeferredQueuedEvent = {
  event: EventAnalyticsModel;
  dateAdded: number;
  params?: AnalyticsParams;
};

export class EventBuffer {
  private eventQueue: DeferredQueuedEvent[] = [];

  constructor() {}

  startedAdaptors: AnalyticsAdaptor[] = [];

  addEvent(event: EventAnalyticsModel, params?: AnalyticsParams) {
    if (!this.startedAdaptors.length) {
      // No adaptors yet: queue the event until start completes.
      this.eventQueue.push({ event, params, dateAdded: Date.now() });
      return;
    }
    this.trackEventInStartedAdaptors(event, params);
  }

  setupAdaptors(adaptors: AnalyticsAdaptor[]) {
    this.startedAdaptors = adaptors;
    this.flushDeferredEventQueue();
  }

  private trackEventInStartedAdaptors(
    event: EventAnalyticsModel,
    params?: AnalyticsParams
  ) {
    this.startedAdaptors.forEach((adaptor) => {
      const trimmedEvent = adaptor.trimEvent(event);
      adaptor.track(trimmedEvent, params);

      const adaptorName = adaptor.name ?? adaptor.constructor.name;
      const paramsString = formatParams(params);
      if (paramsString) {
        TALogger.log(
          `Adaptor '${adaptorName}' logged event '${trimmedEvent.rawValue}' with params [${paramsString}]`,
          'info'
        );
      } else {
        TALogger.log(
          `Adaptor '${adaptorName}' logged event '${trimmedEvent.rawValue}'`,
          'info'
        );
      }
    });
  }

  private flushDeferredEventQueue() {
    if (!this.startedAdaptors.length) {
      return;
    }

    while (this.eventQueue.length) {
      const deferredEvent = this.eventQueue.shift();
      if (!deferredEvent) {
        continue;
      }
      const elapsedSeconds =
        (Date.now() - deferredEvent.dateAdded) / 1000;
      const params: AnalyticsParams = {
        ...(deferredEvent.params ?? {}),
        timeDelta: elapsedSeconds,
      };
      this.trackEventInStartedAdaptors(deferredEvent.event, params);
    }
  }
}

const formatParams = (params?: AnalyticsParams) => {
  if (!params || !Object.keys(params).length) {
    return '';
  }
  return Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${formatParamValue(value)}`)
    .join(', ');
};

const formatParamValue = (value: AnalyticsParameterValue) => {
  if (typeof value === 'string') {
    return value;
  }
  return `${value}`;
};
