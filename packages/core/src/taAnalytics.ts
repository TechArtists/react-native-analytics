import { AppState, AppStateStatus, Platform } from 'react-native';

import { Events, UserProperties } from './constants';
import type { TAAnalyticsConfig } from './config';
import { EventBuffer } from './event-buffer';
import { TALogger } from './logger';
import { StuckUIManager } from './stuckManager';
import {
  addSubscriptionParams,
  filterNilParams,
  isReadOnlyPseudoIDAdaptor,
  isReadWriteUserIDAdaptor,
  isWriteOnlyUserIDAdaptor,
} from './analytics-helpers';
import type {
  AnalyticsAdaptor,
  AnalyticsParams,
  AnalyticsParamsWithNil,
  AnalyticsProvider,
  PaywallExitReason,
  SignupMethod,
  TAPaywallAnalytics,
  TASubscriptionStartAnalytics,
  UserPropertyAnalyticsModel,
} from './models';
import {
  EventAnalyticsModel,
  EventLogCondition,
  SecondaryViewAnalyticsModel,
  ViewAnalyticsModel,
} from './models';
import { stringifyOptional, toISODate } from './utils';

export interface StartOptions {
  customInstallUserPropertiesCompletion?: () => void | Promise<void>;
  shouldTrackFirstOpen?: boolean;
  firstOpenParameterCallback?: () => AnalyticsParams | undefined;
}

const STORAGE_KEY = 'TAAnalytics';
const USER_ID_STORAGE_KEY = 'userID';

export class TAAnalytics implements AnalyticsProvider {
  static readonly userdefaultsKeyPrefix = STORAGE_KEY;

  readonly config: TAAnalyticsConfig;

  // MARK: - State
  private eventQueueBuffer: EventBuffer;

  private appSessionEvents = new Set<string>();

  lastViewShow: ViewAnalyticsModel | null = null;

  stuckUIManager: StuckUIManager | null = null;

  // Optional user identifiers exposed by adaptors (e.g., Crashlytics/Firebase).
  get userPseudoID(): string | undefined {
    const adaptor = this.eventQueueBuffer.startedAdaptors.find(
      isReadOnlyPseudoIDAdaptor
    );
    return adaptor?.getUserPseudoID();
  }

  get userID(): string | undefined {
    const adaptor = this.eventQueueBuffer.startedAdaptors.find(
      isReadWriteUserIDAdaptor
    );
    return adaptor?.getUserID();
  }

  set userID(value: string | undefined) {
    // Persist the last requested user id so we can restore it on next launch.
    void this.setInStorage(USER_ID_STORAGE_KEY, value ?? null);
    this.eventQueueBuffer.startedAdaptors.forEach((adaptor) => {
      if (isWriteOnlyUserIDAdaptor(adaptor)) {
        adaptor.setUserID(value ?? null);
      }
    });
  }

  private storageCache: Record<string, any> | null = null;

  private appStateSubscription?: { remove: () => void } | (() => void);
  private isFirstAppOpenThisProcess = true;

  constructor(config: TAAnalyticsConfig) {
    this.config = config;
    this.eventQueueBuffer = new EventBuffer();
  }

  // MARK: - Lifecycle

  /**
   * Bootstraps analytics: loads storage, starts adaptors, sets default user properties,
   * bumps cold launch counters, and optionally sends first-open/app lifecycle events.
   */
  async start(options: StartOptions = {}) {
    const {
      customInstallUserPropertiesCompletion,
      shouldTrackFirstOpen = true,
      firstOpenParameterCallback,
    } = options;

    await this.ensureStorageLoaded();
    // Bring adaptors up, populate defaults, then send any automatic events.
    this.logStartupDetails();
    await this.startAdaptors();
    await this.restoreUserIDFromStorage();
    await this.configureUserProperties();
    await this.incrementColdLaunchCount();
    await this.sendAppVersionEventUpdatedIfNeeded();
    await this.sendOSUpdateEventIfNeeded();

    if (this.isFirstOpen) {
      await this.handleFirstOpen(
        customInstallUserPropertiesCompletion,
        shouldTrackFirstOpen,
        firstOpenParameterCallback
      );
    }

    if (this.config.enableAppLifecycleEvents) {
      this.addAppLifecycleObservers();
    }
  }

  // MARK: - Core tracking and user properties

  /**
   * Track an event with optional params and log-condition guards.
   */
  async track(
    event: EventAnalyticsModel,
    params?: AnalyticsParamsWithNil,
    logCondition: EventLogCondition = EventLogCondition.LogAlways
  ) {
    await this.ensureStorageLoaded();
    if (!this.config.trackEventFilter(event, params)) {
      return;
    }

    const paramsWithoutNil = filterNilParams(params);
    const prefixedEvent = this.prefixEventIfNeeded(event);

    if (
      logCondition === EventLogCondition.LogOnlyOncePerLifetime &&
      (await this.boolFromStorage(`onlyOnce_${prefixedEvent.rawValue}`))
    ) {
      // Already sent in lifetime.
      return;
    }
    if (logCondition === EventLogCondition.LogOnlyOncePerLifetime) {
      await this.setInStorage(`onlyOnce_${prefixedEvent.rawValue}`, true);
    }

    if (logCondition === EventLogCondition.LogOnlyOncePerAppSession) {
      if (this.appSessionEvents.has(prefixedEvent.rawValue)) {
        // Already sent this app session.
        return;
      }
      this.appSessionEvents.add(prefixedEvent.rawValue);
    }

    this.eventQueueBuffer.addEvent(prefixedEvent, paramsWithoutNil);
  }

  /**
   * Persist and forward a user property change.
   */
  async set(userProperty: UserPropertyAnalyticsModel, value: string | null) {
    await this.ensureStorageLoaded();
    const prefixedUserProperty = this.prefixUserPropertyIfNeeded(userProperty);
    await this.setInStorage(
      `userProperty_${prefixedUserProperty.rawValue}`,
      value
    );
    this.eventQueueBuffer.startedAdaptors.forEach((adaptor) =>
      adaptor.set(adaptor.trimUserProperty(prefixedUserProperty), value)
    );
  }

  /**
   * Read a stored user property, if present.
   */
  async get(userProperty: UserPropertyAnalyticsModel) {
    await this.ensureStorageLoaded();
    const prefixedUserProperty = this.prefixUserPropertyIfNeeded(userProperty);
    const stored = await this.stringFromStorage(
      `userProperty_${prefixedUserProperty.rawValue}`
    );
    return stored ?? undefined;
  }

  /**
   * Tear down lifecycle observers and cancel stuck UI tracking.
   */
  async stop() {
    if (typeof this.appStateSubscription === 'function') {
      this.appStateSubscription();
    } else {
      this.appStateSubscription?.remove?.();
    }
    this.appStateSubscription = undefined;
    this.stuckUIManager = null;
  }

  get isFirstOpen(): boolean {
    return this.coldLaunchCount === 1;
  }

  get coldLaunchCount(): number {
    return (this.storageCache?.coldLaunchCount as number) ?? 0;
  }

  // MARK: - Convenience API

  /**
   * Track a primary view show and optionally start stuck-UI watchdog.
   */
  async trackViewShow(view: ViewAnalyticsModel, stuckTimeoutSeconds?: number) {
    this.stuckUIManager?.trackCorrectedStuckEventIfNeeded();
    this.stuckUIManager = null;

    const params: AnalyticsParams = {};
    this.addParametersForView(view, params, '');

    if (stuckTimeoutSeconds !== undefined) {
      this.stuckUIManager = new StuckUIManager(
        params,
        stuckTimeoutSeconds,
        this
      );
    }

    this.lastViewShow = view;
    await this.set(
      UserProperties.LAST_VIEW_SHOW,
      this.formatLastViewShow(view)
    );
    await this.track(Events.UI_VIEW_SHOW, params);
  }

  /**
   * Track a secondary view (e.g., modal) while attributing it to the main view.
   */
  async trackSecondaryViewShow(view: SecondaryViewAnalyticsModel) {
    const params: AnalyticsParams = {
      secondary_view_name: view.name,
    };
    if (view.type) {
      params.secondary_view_type = view.type;
    }

    this.addParametersForView(view.mainView, params, '');

    await this.track(Events.UI_VIEW_SHOW, params);
  }

  /**
   * Track a button tap, attaching view context and optional detail/index metadata.
   */
  async trackButtonTap(
    symbolicName: string,
    view: ViewAnalyticsModel | SecondaryViewAnalyticsModel,
    detail?: string,
    isDefaultDetail?: boolean,
    index?: number
  ) {
    const params: AnalyticsParams = { name: symbolicName };
    if (typeof index === 'number') {
      params.order = index + 1;
    }
    if (detail !== undefined) {
      params.detail = detail;
    }
    if (isDefaultDetail !== undefined) {
      params.is_default_detail = isDefaultDetail;
    }

    if (view instanceof SecondaryViewAnalyticsModel) {
      params.secondary_view_name = view.name;
      if (view.type) {
        params.secondary_view_type = view.type;
      }
      this.addParametersForView(view.mainView, params, 'view_');
    } else {
      this.addParametersForView(view, params, 'view_');
    }

    await this.track(Events.UI_BUTTON_TAP, params);
  }

  /**
   * Track onboarding entry/exit.
   */
  async trackOnboardingEnter(extraParams?: AnalyticsParams) {
    await this.track(Events.ONBOARDING_ENTER, extraParams);
  }

  async trackOnboardingExit(extraParams?: AnalyticsParams) {
    await this.track(Events.ONBOARDING_EXIT, extraParams);
  }

  /**
   * Track account signup entry/exit with optional signup method.
   */
  async trackAccountSignupEnter(
    method?: SignupMethod,
    extraParams?: AnalyticsParams
  ) {
    const params: AnalyticsParamsWithNil = { ...extraParams };
    if (method) {
      params.method = method;
    }
    await this.track(Events.ACCOUNT_SIGNUP_ENTER, params);
  }

  async trackAccountSignupExit(
    method: SignupMethod,
    extraParams?: AnalyticsParams
  ) {
    const params: AnalyticsParamsWithNil = { ...extraParams, method };
    await this.track(Events.ACCOUNT_SIGNUP_EXIT, params);
  }

  /**
   * Track paywall entry/exit and purchase taps with paywall metadata.
   */
  async trackPaywallEnter(paywall: TAPaywallAnalytics) {
    const params: AnalyticsParams = {
      placement: paywall.analyticsPlacement,
    };
    if (paywall.anayticsID) {
      params.id = paywall.anayticsID;
    }
    if (paywall.analyticsName) {
      params.name = paywall.analyticsName;
    }
    await this.track(Events.PAYWALL_ENTER, params);
    await this.trackViewShow(
      new ViewAnalyticsModel('paywall', paywall.analyticsPlacement)
    );
  }

  async trackPaywallExit(
    paywall: TAPaywallAnalytics,
    reason: PaywallExitReason
  ) {
    const params: AnalyticsParams = {
      placement: paywall.analyticsPlacement,
      reason,
    };
    if (paywall.anayticsID) {
      params.id = paywall.anayticsID;
    }
    if (paywall.analyticsName) {
      params.name = paywall.analyticsName;
    }
    await this.track(Events.PAYWALL_EXIT, params);
  }

  async trackPaywallPurchaseTap(
    buttonName: string,
    productIdentifier: string,
    paywall: TAPaywallAnalytics
  ) {
    const params: AnalyticsParams = {
      button_name: buttonName,
      product_id: productIdentifier,
      placement: paywall.analyticsPlacement,
    };
    if (paywall.anayticsID) {
      params.paywall_id = paywall.anayticsID;
    }
    if (paywall.analyticsName) {
      params.paywall_name = paywall.analyticsName;
    }

    await this.track(Events.PAYWALL_PURCHASE_TAP, params);
    await this.trackButtonTap(
      buttonName,
      new ViewAnalyticsModel('paywall', paywall.analyticsPlacement)
    );
  }

  /**
   * Track subscription start/restore events.
   */
  async trackSubscriptionStartIntro(sub: TASubscriptionStartAnalytics) {
    const params: AnalyticsParams = {};
    addSubscriptionParams(params, sub);
    await this.track(Events.SUBSCRIPTION_START_INTRO, params);
    await this.trackSubscriptionStartNew(sub);
  }

  async trackSubscriptionStartPaidRegular(sub: TASubscriptionStartAnalytics) {
    const params: AnalyticsParams = {};
    addSubscriptionParams(params, sub);
    await this.track(Events.SUBSCRIPTION_START_PAID_REGULAR, params);
    await this.trackSubscriptionStartNew(sub);
  }

  async trackSubscriptionStartNew(sub: TASubscriptionStartAnalytics) {
    const params: AnalyticsParams = {};
    addSubscriptionParams(params, sub);
    await this.track(Events.SUBSCRIPTION_START_NEW, params);
  }

  async trackSubscriptionRestore(sub: TASubscriptionStartAnalytics) {
    const params: AnalyticsParams = {};
    addSubscriptionParams(params, sub);
    await this.track(Events.SUBSCRIPTION_RESTORE, params);
  }

  /**
   * Track engagement; when possible attach last-view context.
   */
  async trackEngagement(name: string) {
    const params: AnalyticsParams = { name };
    if (this.lastViewShow) {
      this.addParametersForView(this.lastViewShow, params, 'view_');
    }
    await this.track(Events.ENGAGEMENT, params);
  }

  /**
   * Track a primary engagement and a secondary ENGAGEMENT_PRIMARY event.
   */
  async trackEngagementPrimary(name: string) {
    const params: AnalyticsParams = { name };
    if (this.lastViewShow) {
      this.addParametersForView(this.lastViewShow, params, 'view_');
    }
    await this.track(Events.ENGAGEMENT, params);
    await this.track(Events.ENGAGEMENT_PRIMARY, params);
  }

  /**
   * Track debug breadcrumbs for diagnostics.
   */
  async trackDebugEvent(reason: string, extraParams?: AnalyticsParams) {
    const params: AnalyticsParamsWithNil = { reason, ...extraParams };
    await this.track(new EventAnalyticsModel('debug'), params);
  }

  /**
   * Track errors and corrected errors with optional error details.
   */
  async trackErrorEvent(
    reason: string,
    error?: Error,
    extraParams?: AnalyticsParams
  ) {
    const params: AnalyticsParamsWithNil = { reason, ...extraParams };
    if (error) {
      const anyErr = error as any;
      params.error_domain = anyErr.domain ?? error.name;
      params.error_code = anyErr.code;
      params.error_description = error.message;
    }
    await this.track(Events.ERROR, params);
  }

  /**
   * Track a corrected error after recovery, mirroring error metadata.
   */
  async trackErrorCorrectedEvent(
    reason: string,
    error?: Error,
    extraParams?: AnalyticsParams
  ) {
    const params: AnalyticsParamsWithNil = { reason, ...extraParams };
    if (error) {
      const anyErr = error as any;
      params.error_domain = anyErr.domain ?? error.name;
      params.error_code = anyErr.code;
      params.error_description = error.message;
    }
    await this.track(Events.ERROR_CORRECTED, params);
  }

  // MARK: - Private helpers

  /**
   * Log initial configuration details for debugging.
   */
  private logStartupDetails() {
    TALogger.log(
      `Starting analytics installType='${
        this.config.installType
      }' processType='${
        this.config.currentProcessType
      }' enabledProcessTypes='${this.config.enabledProcessTypes.join(',')}'`,
      'info'
    );
  }

  /**
   * Start all configured adaptors, skipping ones that fail or time out.
   */
  private async startAdaptors() {
    const startedAdaptors: AnalyticsAdaptor[] = [];
    for (const adaptor of this.config.adaptors) {
      const startedAdaptor = await this.startAdaptorWithTimeout(adaptor);
      if (startedAdaptor) {
        startedAdaptors.push(startedAdaptor);
      }
    }
    this.eventQueueBuffer.setupAdaptors(startedAdaptors);
  }

  /**
   * Start an adaptor with a timeout guard to avoid blocking startup.
   */
  private async startAdaptorWithTimeout(adaptor: AnalyticsAdaptor) {
    // Race adaptor start against a max timeout to avoid blocking forever.
    const timeoutPromise = new Promise<never>((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(
          new Error(`Timeout after ${this.config.maxTimeoutForAdaptorStart}ms`)
        );
      }, this.config.maxTimeoutForAdaptorStart);
    });

    try {
      await Promise.race([
        adaptor.startFor({
          installType: this.config.installType,
          analytics: this,
        }),
        timeoutPromise,
      ]);
      TALogger.log(
        `Adaptor '${adaptor.name ?? adaptor.constructor.name}' started`,
        'info'
      );
      return adaptor;
    } catch (error) {
      TALogger.log(
        `Adaptor '${
          adaptor.name ?? adaptor.constructor.name
        }' failed to start: ${(error as Error).message}`,
        'warn'
      );
      return null;
    }
  }

  /**
   * Seed core user properties such as analytics version and cold launch count.
   */
  private async configureUserProperties() {
    await this.set(
      UserProperties.ANALYTICS_VERSION,
      this.config.analyticsVersion
    );
    const nextColdLaunchCount =
      (await this.getNextCounterValueFrom(
        UserProperties.APP_COLD_LAUNCH_COUNT
      )) ?? 1;
    await this.set(
      UserProperties.APP_COLD_LAUNCH_COUNT,
      `${nextColdLaunchCount}`
    );
  }

  /**
   * Calculate install-time properties and optionally send first-open.
   */
  private async handleFirstOpen(
    customInstallUserPropertiesCompletion?: () => void | Promise<void>,
    shouldTrackFirstOpen: boolean = true,
    firstOpenParameterCallback?: () => AnalyticsParams | undefined
  ) {
    await this.calculateAndSetUserProperties();
    if (customInstallUserPropertiesCompletion) {
      await customInstallUserPropertiesCompletion();
    }
    if (shouldTrackFirstOpen) {
      await this.trackFirstOpen(firstOpenParameterCallback);
    }
  }

  /**
   * Fire the our_first_open event, allowing custom params.
   */
  private async trackFirstOpen(
    firstOpenParameterCallback?: () => AnalyticsParams | undefined
  ) {
    const params = firstOpenParameterCallback?.();
    await this.maybeTrackTAFirstOpen(() => params);
  }

  /**
   * Compute install user properties once and cache them.
   */
  private async calculateAndSetUserProperties() {
    for (const userProperty of this.config.installUserProperties) {
      const existing = await this.get(userProperty);
      if (existing !== undefined) {
        continue;
      }
      // Only compute install properties once; later runs reuse stored values.
      const value = this.calculateInstallUserPropertyValue(userProperty);
      if (value !== undefined) {
        await this.set(userProperty, value);
      }
    }
  }

  /**
   * Derive install-time user property values from config/platform.
   */
  private calculateInstallUserPropertyValue(
    userProperty: UserPropertyAnalyticsModel
  ): string | undefined {
    switch (userProperty.rawValue) {
      case UserProperties.INSTALL_DATE.rawValue:
        return toISODate(new Date());
      case UserProperties.INSTALL_VERSION.rawValue:
        return this.config.appVersion;
      case UserProperties.INSTALL_OS_VERSION.rawValue:
        return this.config.osVersion ?? `${Platform.Version ?? ''}`;
      case UserProperties.INSTALL_IS_JAILBROKEN.rawValue:
        return this.config.installOverrides?.isJailbroken?.toString();
      case UserProperties.INSTALL_UI_APPEARANCE.rawValue:
        return this.config.installOverrides?.uiAppearance;
      case UserProperties.INSTALL_DYNAMIC_TYPE.rawValue:
        return this.config.installOverrides?.dynamicType;
      default:
        return undefined;
    }
  }

  /**
   * Send OUR_FIRST_OPEN only once in app processes.
   */
  private async maybeTrackTAFirstOpen(
    paramsCallback: () => AnalyticsParams | undefined
  ) {
    if (this.config.currentProcessType === 'app' && this.isFirstOpen) {
      await this.track(
        Events.OUR_FIRST_OPEN,
        paramsCallback(),
        EventLogCondition.LogOnlyOncePerLifetime
      );
      return true;
    }
    return false;
  }

  /**
   * Attach AppState listeners to emit APP_OPEN/APP_CLOSE.
   */
  private addAppLifecycleObservers() {
    try {
      const subscription = AppState.addEventListener(
        'change',
        (state: AppStateStatus) => {
          if (state === 'active') {
            this.handleAppBecameActive().catch(() => undefined);
          } else if (state === 'background') {
            this.handleAppEnteredBackground().catch(() => undefined);
          }
        }
      ) as unknown;
      if (subscription && typeof subscription === 'object') {
        this.appStateSubscription = subscription as { remove: () => void };
      }
    } catch (error) {
      TALogger.log(
        `Failed to attach AppState listener: ${(error as Error).message}`,
        'warn'
      );
    }
  }

  /**
   * Handle foreground transitions by bumping counters and emitting APP_OPEN.
   */
  private async handleAppBecameActive() {
    const nextOpenCount = await this.getNextCounterValueFrom(
      UserProperties.APP_OPEN_COUNT
    );
    await this.set(UserProperties.APP_OPEN_COUNT, `${nextOpenCount}`);

    const isColdLaunch = this.isFirstAppOpenThisProcess;
    this.isFirstAppOpenThisProcess = false;
    const params: AnalyticsParamsWithNil = { is_cold_launch: isColdLaunch };

    if (this.lastViewShow) {
      this.addParametersForView(this.lastViewShow, params, 'view_');
    }

    await this.track(Events.APP_OPEN, params);
  }

  /**
   * Handle background transitions by emitting APP_CLOSE with view context.
   */
  private async handleAppEnteredBackground() {
    const params: AnalyticsParams = {};
    if (this.lastViewShow) {
      this.addParametersForView(this.lastViewShow, params, 'view_');
    }
    await this.track(Events.APP_CLOSE, params);
  }

  /**
   * Enrich analytics params with view metadata and optional funnel details.
   */
  private addParametersForView(
    view: ViewAnalyticsModel,
    params: AnalyticsParamsWithNil,
    prefix: string
  ) {
    params[`${prefix}name`] = view.name;
    if (view.type) {
      params[`${prefix}type`] = view.type;
    }
    if (view.funnelStep) {
      const { funnelName, step, isOptionalStep, isFinalStep } = view.funnelStep;
      if (funnelName !== undefined) {
        params[`${prefix}funnel_name`] = funnelName;
      }
      if (step !== undefined) {
        params[`${prefix}funnel_step`] = step;
      }
      if (isOptionalStep !== undefined) {
        params[`${prefix}funnel_step_is_optional`] = isOptionalStep;
      }
      if (isFinalStep !== undefined) {
        params[`${prefix}funnel_step_is_final`] = isFinalStep;
      }
    }
  }

  /**
   * Format a compact string for LAST_VIEW_SHOW storage.
   */
  private formatLastViewShow(view: ViewAnalyticsModel) {
    return `${view.name};${stringifyOptional(view.type)};${stringifyOptional(
      view.funnelStep?.funnelName
    )};${stringifyOptional(view.funnelStep?.step)};${stringifyOptional(
      view.funnelStep?.isOptionalStep
    )};${stringifyOptional(view.funnelStep?.isFinalStep)}`;
  }

  /**
   * Increment cold launch counter cached in storage.
   */
  private async incrementColdLaunchCount() {
    const nextValue = this.coldLaunchCount + 1;
    await this.setInStorage('coldLaunchCount', nextValue);
  }

  /**
   * Emit app version update event when version/build changes.
   */
  private async sendAppVersionEventUpdatedIfNeeded() {
    if (!this.config.appVersion) {
      return;
    }
    const currentBuild = this.config.buildNumber ?? '';
    const defaultsAppVersion = await this.stringFromStorage('appVersion');
    const defaultsBuild = await this.stringFromStorage('build');

    if (
      defaultsAppVersion !== this.config.appVersion ||
      defaultsBuild !== currentBuild
    ) {
      await this.setInStorage('appVersion', this.config.appVersion);
      await this.setInStorage('build', currentBuild);

      await this.track(Events.APP_VERSION_UPDATE, {
        from_version: defaultsAppVersion,
        to_version: this.config.appVersion,
        from_build: defaultsBuild,
        to_build: currentBuild,
      });
    }
  }

  /**
   * Emit OS update event when platform version changes.
   */
  private async sendOSUpdateEventIfNeeded() {
    const osString = this.config.osVersion ?? `${Platform.Version ?? ''}`;
    const defaultsOSVersion = await this.stringFromStorage('osVersion');
    if (defaultsOSVersion !== osString) {
      await this.setInStorage('osVersion', osString);
      if (defaultsOSVersion) {
        await this.track(Events.OS_VERSION_UPDATE, {
          from_version: defaultsOSVersion,
          to_version: osString,
        });
      }
    }
  }

  /**
   * Apply prefixes to internal vs app-defined events.
   */
  private prefixEventIfNeeded(event: EventAnalyticsModel) {
    if (event.isInternalEvent) {
      return event.eventBy(
        this.config.automaticallyTrackedEventsPrefixConfig.eventPrefix
      );
    }
    return event.eventBy(
      this.config.manuallyTrackedEventsPrefixConfig.eventPrefix
    );
  }

  /**
   * Apply prefixes to internal vs app-defined user properties.
   */
  private prefixUserPropertyIfNeeded(userProperty: UserPropertyAnalyticsModel) {
    if (userProperty.isInternalUserProperty) {
      return userProperty.userPropertyBy(
        this.config.automaticallyTrackedEventsPrefixConfig.userPropertyPrefix
      );
    }
    return userProperty.userPropertyBy(
      this.config.manuallyTrackedEventsPrefixConfig.userPropertyPrefix
    );
  }

  /**
   * Bump a counter property, defaulting when it doesn't exist.
   */
  private async getNextCounterValueFrom(
    userProperty: UserPropertyAnalyticsModel,
    defaultIfNotExists: number = 1
  ) {
    const existingLaunchID = await this.get(userProperty);
    const previousLaunchID = existingLaunchID
      ? parseInt(existingLaunchID, 10)
      : NaN;
    if (Number.isFinite(previousLaunchID)) {
      return previousLaunchID + 1;
    }
    return defaultIfNotExists;
  }

  /**
   * Lazily hydrate storage cache from configured storage adapter.
   */
  private async ensureStorageLoaded() {
    if (this.storageCache) {
      return;
    }
    const stored = await this.config.storage.getItem(STORAGE_KEY);
    this.storageCache = stored ? JSON.parse(stored) : {};
  }

  /**
   * Update storage cache and persist it.
   */
  private async setInStorage(key: string, value: any) {
    await this.ensureStorageLoaded();
    if (!this.storageCache) {
      this.storageCache = {};
    }
    if (value === null || value === undefined) {
      delete this.storageCache[key];
    } else {
      this.storageCache[key] = value;
    }
    await this.config.storage.setItem(
      STORAGE_KEY,
      JSON.stringify(this.storageCache)
    );
  }

  /**
   * Read a typed value from cached storage.
   */
  private async objectFromStorage<T>(key: string): Promise<T | undefined> {
    await this.ensureStorageLoaded();
    return this.storageCache?.[key] as T | undefined;
  }

  /**
   * Convenience string getter from storage.
   */
  private async stringFromStorage(key: string) {
    const value = await this.objectFromStorage<string>(key);
    return value ?? null;
  }

  /**
   * Convenience boolean getter from storage.
   */
  private async boolFromStorage(key: string) {
    const value = await this.objectFromStorage<boolean>(key);
    return value ?? false;
  }

  /**
   * Restore persisted user id (if any) into adaptors after they start.
   */
  private async restoreUserIDFromStorage() {
    const persistedUserID = await this.stringFromStorage(USER_ID_STORAGE_KEY);
    if (persistedUserID === null) {
      return;
    }
    this.userID = persistedUserID;
  }
}
