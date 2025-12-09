import { Mixpanel } from 'mixpanel-react-native';
import {
  EventAnalyticsModelTrimmed,
  UserPropertyAnalyticsModelTrimmed,
} from '@techartists/react-native-ta-analytics';
import type {
  AnalyticsAdaptor,
  AnalyticsAdaptorWithWriteOnlyUserID,
  AnalyticsParams,
  AnalyticsStartOptions,
  EventAnalyticsModel,
  InstallType,
  UserPropertyAnalyticsModel,
} from '@techartists/react-native-ta-analytics';

type MixpanelWithFlush = Mixpanel & { setFlushInterval?: (n: number) => void };

export interface MixpanelAdaptorOptions {
  /**
   * Max length of event names before truncation.
   */
  eventNameMaxLength?: number;
  /**
   * Max length of user property keys before truncation.
   */
  userPropertyKeyMaxLength?: number;
  /**
   * Max length of user property values before truncation.
   */
  userPropertyValueMaxLength?: number;
  /**
   * Enable Mixpanel logging for debugging.
   */
  loggingEnabled?: boolean;
  /**
   * Whether Mixpanel should track automatic events. Defaults to false to mirror the native example.
   */
  trackAutomaticEvents?: boolean;
  /**
   * Allowed install types; throws if current install type not permitted.
   */
  enabledInstallTypes?: InstallType[];
  /**
   * Optional flush interval override (seconds).
   */
  flushInterval?: number;
}

const DEFAULTS: Required<MixpanelAdaptorOptions> = {
  eventNameMaxLength: 40,
  userPropertyKeyMaxLength: 24,
  userPropertyValueMaxLength: 100,
  loggingEnabled: false,
  trackAutomaticEvents: false,
  enabledInstallTypes: ['AppStore', 'TestFlight', 'Xcode', 'XcodeAndDebuggerAttached'],
  flushInterval: 60,
};

/**
 * Mixpanel adaptor: forwards events and user properties to Mixpanel.
 */
export class MixpanelAnalyticsAdaptor
  implements AnalyticsAdaptor, AnalyticsAdaptorWithWriteOnlyUserID
{
  readonly name = 'MixpanelAnalyticsAdaptor';
  get wrappedValue(): Mixpanel | null {
    return this.mixpanel;
  }

  private mixpanel: Mixpanel | null = null;
  private readonly options: Required<MixpanelAdaptorOptions>;
  private readonly token: string;

  constructor(token: string, options: MixpanelAdaptorOptions = {}) {
    this.token = token;
    this.options = { ...DEFAULTS, ...options };
  }

  async startFor(_: AnalyticsStartOptions) {
    if (!this.options.enabledInstallTypes.includes(_.installType)) {
      throw new Error(
        `[MixpanelAnalyticsAdaptor] Install type '${_.installType}' is not enabled`
      );
    }
    this.mixpanel = new Mixpanel(this.token, this.options.trackAutomaticEvents);
    await this.mixpanel.init();
    if (this.options.flushInterval) {
      (this.mixpanel as MixpanelWithFlush).setFlushInterval?.(
        this.options.flushInterval
      );
    }
    if (this.options.loggingEnabled) {
      this.mixpanel.setLoggingEnabled(true);
    }
  }

  track(
    trimmedEvent: EventAnalyticsModelTrimmed,
    params?: AnalyticsParams
  ): void {
    if (!this.mixpanel) {
      return;
    }
    const validParams = this.validEventParams(trimmedEvent, params);
    this.mixpanel.track(trimmedEvent.rawValue, validParams);
  }

  set(
    trimmedUserProperty: UserPropertyAnalyticsModelTrimmed,
    value: string | null
  ): void {
    if (!this.mixpanel) {
      return;
    }
    const people = this.mixpanel.getPeople();
    void (async () => {
      try {
        if (value === null) {
          await people.unset(trimmedUserProperty.rawValue);
        } else {
          await people.set(
            trimmedUserProperty.rawValue,
            this.truncate(value, this.options.userPropertyValueMaxLength)
          );
        }
      } catch {
        // ignore errors from Mixpanel client
      }
    })();
  }

  trimEvent(event: EventAnalyticsModel): EventAnalyticsModelTrimmed {
    return new EventAnalyticsModelTrimmed(
      this.truncate(event.rawValue, this.options.eventNameMaxLength)
    );
  }

  trimUserProperty(
    userProperty: UserPropertyAnalyticsModel
  ): UserPropertyAnalyticsModelTrimmed {
    return new UserPropertyAnalyticsModelTrimmed(
      this.truncate(userProperty.rawValue, this.options.userPropertyKeyMaxLength)
    );
  }

  setUserID(userID: string | null): void {
    if (!this.mixpanel) {
      return;
    }
    if (userID) {
      this.mixpanel.identify(
        this.truncate(userID, this.options.userPropertyValueMaxLength)
      );
    } else {
      this.mixpanel.reset();
    }
  }

  private truncate(value: string, maxLength: number) {
    if (value.length <= maxLength) {
      return value;
    }
    if (maxLength <= 3) {
      return value.slice(0, maxLength);
    }
    return `${value.slice(0, maxLength - 3)}...`;
  }

  private validEventParams(
    event: EventAnalyticsModelTrimmed,
    params?: AnalyticsParams
  ): Record<string, string | number | boolean> | undefined {
    if (!params) {
      return undefined;
    }
    const result: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(params)) {
      let trimmedKey = key;
      if (trimmedKey.length > 255) {
        trimmedKey = trimmedKey.slice(0, 255);
        // Log trimming in debug flows.
        // eslint-disable-next-line no-console
        console.warn(
          `[MixpanelAnalyticsAdaptor] Trimmed key for event ${event.rawValue} from ${key} to ${trimmedKey}`
        );
      }

      if (typeof value === 'string') {
        const trimmedValue =
          value.length > 100 ? value.slice(0, 100) : value;
        if (trimmedValue !== value) {
          // eslint-disable-next-line no-console
          console.warn(
            `[MixpanelAnalyticsAdaptor] Trimmed value for key '${trimmedKey}' in event '${event.rawValue}'`
          );
        }
        result[trimmedKey] = trimmedValue;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        result[trimmedKey] = value;
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[MixpanelAnalyticsAdaptor] Unsupported parameter value for key '${trimmedKey}' in event '${event.rawValue}'. Skipping.`
        );
      }
    }
    return result;
  }
}
