import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import {
  EventAnalyticsModelTrimmed,
  UserPropertyAnalyticsModelTrimmed,
} from '@techartists/react-native-ta-analytics';
import type {
  AnalyticsAdaptor,
  AnalyticsAdaptorWithReadOnlyUserPseudoID,
  AnalyticsAdaptorWithWriteOnlyUserID,
  AnalyticsParams,
  AnalyticsStartOptions,
  EventAnalyticsModel,
  InstallType,
  UserPropertyAnalyticsModel,
} from '@techartists/react-native-ta-analytics';

type AnalyticsParamValue = string | number | boolean;

export interface FirebaseAnalyticsAdaptorOptions {
  enabledInstallTypes?: InstallType[];
  shouldStartFirebase?: boolean;
  eventNameMaxLength?: number;
  userPropertyKeyMaxLength?: number;
  userPropertyValueMaxLength?: number;
}

export interface FirebaseCrashlyticsAdaptorOptions {
  /**
   * Maximum length for event names when logging to Crashlytics.
   * Defaults to 80 characters.
   */
  eventNameMaxLength?: number;
  /**
   * Maximum length for user property keys. Crashlytics caps these at 40 chars.
   */
  userPropertyKeyMaxLength?: number;
  /**
   * Maximum length for user property values. Crashlytics caps these at 100 chars.
   */
  userPropertyValueMaxLength?: number;
  /**
   * Maximum length for the log line sent to Crashlytics.
   */
  logMessageMaxLength?: number;
  /**
   * Whether to append event params to the log line (stringified).
   */
  logParams?: boolean;
  /**
   * Prefix to prepend to event names in Crashlytics logs.
   */
  eventLogPrefix?: string;
}

const DEFAULT_OPTIONS: Required<FirebaseCrashlyticsAdaptorOptions> = {
  eventNameMaxLength: 80,
  userPropertyKeyMaxLength: 40,
  userPropertyValueMaxLength: 100,
  logMessageMaxLength: 512,
  logParams: true,
  eventLogPrefix: 'ta_event:',
};

const DEFAULT_ANALYTICS_OPTIONS: Required<FirebaseAnalyticsAdaptorOptions> = {
  enabledInstallTypes: ['AppStore', 'TestFlight'],
  shouldStartFirebase: true,
  eventNameMaxLength: 40,
  userPropertyKeyMaxLength: 24,
  userPropertyValueMaxLength: 100,
};

const RESERVED_FIREBASE_USER_PROPERTIES = [
  'first_open_time',
  'last_deep_link_referrer',
  'user_id',
];

const RESERVED_FIREBASE_EVENTS = [
  'ad_activeview',
  'ad_click',
  'ad_exposure',
  'ad_query',
  'ad_reward',
  'adunit_exposure',
  'app_background',
  'app_clear_data',
  'app_exception',
  'app_remove',
  'app_store_refund',
  'app_store_subscription_cancel',
  'app_store_subscription_convert',
  'app_store_subscription_renew',
  'app_update',
  'app_upgrade',
  'dynamic_link_app_open',
  'dynamic_link_app_update',
  'dynamic_link_first_open',
  'error',
  'firebase_campaign',
  'first_open',
  'first_visit',
  'in_app_purchase',
  'notification_dismiss',
  'notification_foreground',
  'notification_open',
  'notification_receive',
  'os_update',
  'session_start',
  'session_start_with_rollout',
  'user_engagement',
];

/**
 * Firebase Analytics adaptor with reserved-name checks and trimming to Firebase limits.
 */
export class FirebaseAnalyticsAdaptor
  implements
    AnalyticsAdaptor,
    AnalyticsAdaptorWithWriteOnlyUserID,
    AnalyticsAdaptorWithReadOnlyUserPseudoID
{
  readonly name = 'FirebaseAnalyticsAdaptor';
  readonly wrappedValue = analytics();

  private readonly options: Required<FirebaseAnalyticsAdaptorOptions>;
  private currentInstallType?: InstallType;
  private currentUserID: string | null = null;
  private userPseudoID: string | undefined;

  constructor(options: FirebaseAnalyticsAdaptorOptions = {}) {
    this.options = { ...DEFAULT_ANALYTICS_OPTIONS, ...options };
  }

  async startFor({ installType }: AnalyticsStartOptions) {
    if (!this.options.enabledInstallTypes.includes(installType)) {
      throw new Error(
        `[FirebaseAnalyticsAdaptor] Install type '${installType}' is not enabled`
      );
    }
    this.currentInstallType = installType;

    if (this.options.shouldStartFirebase) {
      // Ensure the native app is initialized (RNFB config happens natively).
      await analytics().setAnalyticsCollectionEnabled(true);
    }

    try {
      const id = await analytics().getAppInstanceId();
      this.userPseudoID = id ?? undefined;
    } catch {
      this.userPseudoID = undefined;
    }
  }

  track(
    trimmedEvent: EventAnalyticsModelTrimmed,
    params?: AnalyticsParams
  ): void {
    void (async () => {
      this.throwIfReservedEvent(trimmedEvent.rawValue);
      const converted = this.validEventParams(trimmedEvent, params);
      try {
        await analytics().logEvent(trimmedEvent.rawValue, converted);
      } catch {
        // ignore logging errors from analytics client
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
      this.truncate(
        userProperty.rawValue,
        this.options.userPropertyKeyMaxLength
      )
    );
  }

  set(
    trimmedUserProperty: UserPropertyAnalyticsModelTrimmed,
    value: string | null
  ): void {
    void (async () => {
      this.throwIfReservedUserProperty(trimmedUserProperty.rawValue);
      const key = this.truncate(
        trimmedUserProperty.rawValue,
        this.options.userPropertyKeyMaxLength
      );
      const safeValue =
        value === null
          ? null
          : this.truncate(value, this.options.userPropertyValueMaxLength);
      try {
        await analytics().setUserProperty(key, safeValue);
      } catch {
        // ignore property errors from analytics client
      }
    })();
  }

  setUserID(userID: string | null): void {
    void (async () => {
      this.currentUserID = userID;
      const trimmed =
        userID === null
          ? null
          : this.truncate(userID, this.options.userPropertyValueMaxLength);
      try {
        await analytics().setUserId(trimmed);
      } catch {
        // ignore user id errors from analytics client
      }
    })();
  }

  getUserID(): string | undefined {
    return this.currentUserID ?? undefined;
  }

  getUserPseudoID(): string | undefined {
    return this.userPseudoID;
  }

  private throwIfReservedEvent(eventRawValue: string) {
    if (
      this.currentInstallType === 'Xcode' &&
      RESERVED_FIREBASE_EVENTS.includes(eventRawValue)
    ) {
      throw new Error(
        `[FirebaseAnalyticsAdaptor] using a reserved firebase event name '${eventRawValue}'`
      );
    }
  }

  private throwIfReservedUserProperty(userPropertyRawValue: string) {
    if (
      this.currentInstallType === 'Xcode' &&
      RESERVED_FIREBASE_USER_PROPERTIES.includes(userPropertyRawValue)
    ) {
      throw new Error(
        `[FirebaseAnalyticsAdaptor] using a reserved firebase user property '${userPropertyRawValue}'`
      );
    }
  }

  private validEventParams(
    trimmedEvent: EventAnalyticsModelTrimmed,
    params?: AnalyticsParams
  ): Record<string, AnalyticsParamValue> | undefined {
    if (!params) {
      return undefined;
    }
    const converted: Record<string, AnalyticsParamValue> = {};
    for (const [key, value] of Object.entries(params)) {
      const keyTrimmed = this.truncate(key, this.options.eventNameMaxLength);
      if (typeof value === 'string') {
        converted[keyTrimmed] = this.truncate(
          value,
          this.options.userPropertyValueMaxLength
        );
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        converted[keyTrimmed] = value;
      } else {
        throw new Error(
          `[FirebaseAnalyticsAdaptor] Unsupported parameter type for event '${trimmedEvent.rawValue}' key '${key}'`
        );
      }
    }
    return converted;
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }
    if (maxLength <= 3) {
      return value.slice(0, maxLength);
    }
    return `${value.slice(0, maxLength - 3)}...`;
  }
}

/**
 * Simple adaptor that mirrors TAAnalytics events/user properties into Firebase Crashlytics
 * logs and attributes so crashes can be correlated with analytics signals.
 */
export class FirebaseCrashlyticsAdaptor
  implements AnalyticsAdaptor, AnalyticsAdaptorWithWriteOnlyUserID
{
  readonly name = 'FirebaseCrashlyticsAdaptor';
  readonly wrappedValue = crashlytics();

  private readonly options: Required<FirebaseCrashlyticsAdaptorOptions>;

  constructor(options: FirebaseCrashlyticsAdaptorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async startFor({ installType }: AnalyticsStartOptions) {
    // Store install type as an attribute for crash reports.
    await crashlytics().setAttribute(
      'ta_install_type',
      this.truncate(`${installType}`, this.options.userPropertyValueMaxLength)
    );
  }

  track(
    trimmedEvent: EventAnalyticsModelTrimmed,
    params?: AnalyticsParams
  ): void {
    const baseName = `${this.options.eventLogPrefix}${trimmedEvent.rawValue}`;
    const paramsString =
      this.options.logParams && params ? formatParams(params) : '';
    const message = paramsString ? `${baseName} ${paramsString}` : baseName;
    crashlytics().log(this.truncate(message, this.options.logMessageMaxLength));
  }

  set(
    trimmedUserProperty: UserPropertyAnalyticsModelTrimmed,
    value: string | null
  ): void {
    void (async () => {
      const key = this.truncate(
        trimmedUserProperty.rawValue,
        this.options.userPropertyKeyMaxLength
      );
      const safeValue = value ?? '';
      try {
        await crashlytics().setAttribute(
          key,
          this.truncate(safeValue, this.options.userPropertyValueMaxLength)
        );
      } catch {
        // ignore errors from crashlytics client
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
    void (async () => {
      const sanitized = userID
        ? this.truncate(userID, this.options.userPropertyValueMaxLength)
        : '';
      try {
        await crashlytics().setUserId(sanitized);
      } catch {
        // ignore errors from crashlytics client
      }
    })();
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }
    if (maxLength <= 3) {
      return value.slice(0, maxLength);
    }
    return `${value.slice(0, maxLength - 3)}...`;
  }
}

const formatParams = (params: AnalyticsParams) =>
  Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(', ');
