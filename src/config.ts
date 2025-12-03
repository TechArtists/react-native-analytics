import { DEFAULT_INSTALL_USER_PROPERTIES } from './constants';
import type {
  AnalyticsAdaptor,
  InstallType,
  PrefixConfig,
  ProcessType,
  TrackEventFilter,
  UserPropertyAnalyticsModel,
} from './models';
import { createDefaultStorageAdapter } from './storage';
import type { StorageAdapter } from './storage';

// Configuration surface for TAAnalytics. Mirrors the Swift config: process/install
// type detection, adaptor list, prefixing, and install-time user property defaults.
export interface TAAnalyticsConfigOptions {
  /** Version of your analytics schema, stored as a user property. */
  analyticsVersion: string;
  /** Adaptors that consume tracked events/user properties. */
  adaptors: AnalyticsAdaptor[];
  /** Process type (app vs extension). Defaults to 'app'. */
  currentProcessType?: ProcessType;
  /** Which process types are allowed to log. Defaults to both app and appExtension. */
  enabledProcessTypes?: ProcessType[];
  /** Install channel (App Store/TestFlight/etc). Defaults to 'Xcode'. */
  installType?: InstallType;
  /** Storage backend for counters/user properties. Defaults to in-memory (volatile). */
  storage?: StorageAdapter;
  /** Which install-time user properties to precompute. */
  installUserProperties?: UserPropertyAnalyticsModel[];
  /** Max time (ms) to wait for an adaptor to start before skipping it. */
  maxTimeoutForAdaptorStart?: number;
  /** Optional custom flush interval for adaptors. */
  flushIntervalForAdaptors?: number;
  /** Prefix for internal auto-tracked events/properties. */
  automaticallyTrackedEventsPrefixConfig?: PrefixConfig;
  /** Prefix for manually tracked events/properties. */
  manuallyTrackedEventsPrefixConfig?: PrefixConfig;
  /** Optional filter to drop events before dispatch. */
  trackEventFilter?: TrackEventFilter;
  /** App version/build used to emit app_version_update events. */
  appVersion?: string;
  buildNumber?: string;
  /** OS version override; otherwise derived from Platform.Version. */
  osVersion?: string;
  /** If true (default), hook AppState to emit APP_OPEN/APP_CLOSE. */
  enableAppLifecycleEvents?: boolean;
  /** Optional overrides for install-time properties (jailbreak/UI/dynamic type). */
  installOverrides?: {
    isJailbroken?: boolean;
    uiAppearance?: string;
    dynamicType?: string;
  };
}

export class TAAnalyticsConfig {
  readonly analyticsVersion: string;
  readonly adaptors: AnalyticsAdaptor[];
  readonly currentProcessType: ProcessType;
  readonly enabledProcessTypes: ProcessType[];
  readonly installType: InstallType;
  readonly storage: StorageAdapter;
  readonly installUserProperties: UserPropertyAnalyticsModel[];
  readonly maxTimeoutForAdaptorStart: number;
  readonly automaticallyTrackedEventsPrefixConfig: PrefixConfig;
  readonly manuallyTrackedEventsPrefixConfig: PrefixConfig;
  readonly trackEventFilter: TrackEventFilter;
  readonly flushIntervalForAdaptors?: number;
  readonly appVersion?: string;
  readonly buildNumber?: string;
  readonly osVersion?: string;
  readonly enableAppLifecycleEvents: boolean;
  readonly installOverrides?: TAAnalyticsConfigOptions['installOverrides'];

  constructor(options: TAAnalyticsConfigOptions) {
    this.analyticsVersion = options.analyticsVersion;
    this.adaptors = options.adaptors;
    this.currentProcessType = options.currentProcessType ?? 'app';
    this.enabledProcessTypes = options.enabledProcessTypes ?? ['app', 'appExtension'];
    this.installType = options.installType ?? 'Xcode';
    this.storage = options.storage ?? createDefaultStorageAdapter();
    this.installUserProperties =
      options.installUserProperties ?? DEFAULT_INSTALL_USER_PROPERTIES;
    this.maxTimeoutForAdaptorStart = options.maxTimeoutForAdaptorStart ?? 10000;
    this.automaticallyTrackedEventsPrefixConfig =
      options.automaticallyTrackedEventsPrefixConfig ??
      ({ eventPrefix: '', userPropertyPrefix: '' } as PrefixConfig);
    this.manuallyTrackedEventsPrefixConfig =
      options.manuallyTrackedEventsPrefixConfig ??
      ({ eventPrefix: '', userPropertyPrefix: '' } as PrefixConfig);
    this.trackEventFilter = options.trackEventFilter ?? (() => true);
    this.flushIntervalForAdaptors = options.flushIntervalForAdaptors;
    this.appVersion = options.appVersion;
    this.buildNumber = options.buildNumber;
    this.osVersion = options.osVersion;
    this.enableAppLifecycleEvents =
      options.enableAppLifecycleEvents !== false;
    this.installOverrides = options.installOverrides;
  }
}
