import { TALogger } from '../logger';
import {
  AnalyticsAdaptor,
  AnalyticsParams,
  AnalyticsStartOptions,
  EventAnalyticsModel,
  EventAnalyticsModelTrimmed,
  UserPropertyAnalyticsModel,
  UserPropertyAnalyticsModelTrimmed,
} from '../models';
import { trimString } from '../utils';

export class ConsoleAnalyticsAdaptor implements AnalyticsAdaptor {
  readonly name = 'ConsoleAnalyticsAdaptor';
  readonly wrappedValue = null;

  async startFor(_: AnalyticsStartOptions) {
    return;
  }

  track(
    trimmedEvent: EventAnalyticsModelTrimmed,
    params?: AnalyticsParams
  ): void {
    const paramsString = params ? formatParams(params) : '';
    TALogger.log(
      `sendEvent '${trimmedEvent.rawValue}'${
        paramsString ? ` params [${paramsString}]` : ''
      }`,
      'info'
    );
  }

  set(
    trimmedUserProperty: UserPropertyAnalyticsModelTrimmed,
    value: string | null
  ): void {
    TALogger.log(
      `setUserProperty '${trimmedUserProperty.rawValue}' value '${
        value ?? '<nil>'
      }'`,
      'info'
    );
  }

  trimEvent(event: EventAnalyticsModel): EventAnalyticsModelTrimmed {
    return new EventAnalyticsModelTrimmed(trimString(event.rawValue, 40));
  }

  trimUserProperty(
    userProperty: UserPropertyAnalyticsModel
  ): UserPropertyAnalyticsModelTrimmed {
    return new UserPropertyAnalyticsModelTrimmed(
      trimString(userProperty.rawValue, 24)
    );
  }
}

const formatParams = (params: AnalyticsParams) =>
  Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(', ');
