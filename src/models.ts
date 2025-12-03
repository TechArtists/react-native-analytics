import type { LogLevel } from './logger';

// Values we accept/forward to adaptors.
export type AnalyticsParameterValue = string | number | boolean;

export type AnalyticsParams = Record<string, AnalyticsParameterValue>;

export type AnalyticsParamsWithNil = Record<
  string,
  AnalyticsParameterValue | null | undefined
>;

// Controls how often an event is allowed to fire.
export enum EventLogCondition {
  LogAlways = 'logAlways',
  LogOnlyOncePerLifetime = 'logOnlyOncePerLifetime',
  LogOnlyOncePerAppSession = 'logOnlyOncePerAppSession',
}

// Raw event name + metadata (trimmed later by adaptors).
export class EventAnalyticsModel {
  constructor(
    public rawValue: string,
    public isInternalEvent: boolean = false
  ) {}

  eventBy(prefixing: string) {
    return new EventAnalyticsModel(
      `${prefixing}${this.rawValue}`,
      this.isInternalEvent
    );
  }
}

// Event name after adaptor-specific trimming.
export class EventAnalyticsModelTrimmed {
  constructor(public rawValue: string) {}
}

// Raw user property name + metadata (trimmed later by adaptors).
export class UserPropertyAnalyticsModel {
  constructor(
    public rawValue: string,
    public isInternalUserProperty: boolean = false
  ) {}

  userPropertyBy(prefixing: string) {
    return new UserPropertyAnalyticsModel(
      `${prefixing}${this.rawValue}`,
      this.isInternalUserProperty
    );
  }
}

// User property name after adaptor-specific trimming.
export class UserPropertyAnalyticsModelTrimmed {
  constructor(public rawValue: string) {}
}

export interface FunnelStep {
  funnelName?: string;
  step?: number;
  isOptionalStep?: boolean;
  isFinalStep?: boolean;
}

// Main view being shown (used to enrich UI-related events).
export class ViewAnalyticsModel {
  constructor(
    public name: string,
    public type?: string,
    public funnelStep?: FunnelStep
  ) {}
}

// Secondary view inside/over a main view (e.g., dialog).
export class SecondaryViewAnalyticsModel {
  constructor(
    public name: string,
    public mainView: ViewAnalyticsModel,
    public type?: string
  ) {}
}

export type InstallType = 'AppStore' | 'Xcode' | 'XcodeAndDebuggerAttached' | 'TestFlight';

export type ProcessType = 'app' | 'appExtension';

export interface PrefixConfig {
  eventPrefix: string;
  userPropertyPrefix: string;
}

export interface AnalyticsProvider {
  set(
    userProperty: UserPropertyAnalyticsModel,
    value: string | null
  ): Promise<void>;
  get(
    userProperty: UserPropertyAnalyticsModel
  ): Promise<string | undefined>;
}

export interface AnalyticsStartOptions {
  installType: InstallType;
  analytics: AnalyticsProvider;
}

// Adaptors forward trimmed events/user properties to a destination.
export interface AnalyticsAdaptor {
  startFor(options: AnalyticsStartOptions): Promise<void>;
  track(
    trimmedEvent: EventAnalyticsModelTrimmed,
    params?: AnalyticsParams
  ): void;
  set(
    trimmedUserProperty: UserPropertyAnalyticsModelTrimmed,
    value: string | null
  ): void;
  trimEvent(event: EventAnalyticsModel): EventAnalyticsModelTrimmed;
  trimUserProperty(
    userProperty: UserPropertyAnalyticsModel
  ): UserPropertyAnalyticsModelTrimmed;
  readonly name?: string;
}

// Optional: adaptors can expose user ID helpers if the underlying platform supports it.
export interface AnalyticsAdaptorWithReadOnlyUserPseudoID
  extends AnalyticsAdaptor {
  getUserPseudoID(): string | undefined;
}

export interface AnalyticsAdaptorWithWriteOnlyUserID
  extends AnalyticsAdaptor {
  setUserID(userID: string | null): void;
}

export interface AnalyticsAdaptorWithReadWriteUserID
  extends AnalyticsAdaptorWithWriteOnlyUserID {
  getUserID(): string | undefined;
}

export type TrackEventFilter = (
  event: EventAnalyticsModel,
  params?: AnalyticsParamsWithNil
) => boolean;

export type SignupMethod =
  | 'email'
  | 'apple'
  | 'google'
  | 'facebook'
  | string;

export type PaywallExitReason =
  | 'closed paywall'
  | 'cancelled payment confirmation'
  | 'new subscription'
  | 'restored subscription'
  | `other ${string}`;

export type SubscriptionType =
  | 'trial'
  | 'paid intro pay as you go'
  | 'paid intro pay up front'
  | 'paid regular'
  | `other ${string}`;

export interface TAPaywallAnalytics {
  analyticsPlacement: string;
  anayticsID?: string;
  analyticsName?: string;
}

export interface TASubscriptionStartAnalytics {
  subscriptionType: SubscriptionType;
  paywall: TAPaywallAnalytics;
  productID: string;
  price: number;
  currency: string;
}

export type DebugHandler = (message: string, level?: LogLevel) => void;
