# react-native-ta-analytics

React Native port of the `TAAnalytics` Swift SDK: an opinionated analytics orchestrator with predefined events/user properties, buffering, and pluggable adaptors.

## Installation

```sh
npm install react-native-ta-analytics @react-native-async-storage/async-storage
```
> AsyncStorage must be in your app's `package.json` for React Native autolinking. Without it, the SDK falls back to in-memory storage and counters reset every cold start.

## Quick start

```ts
import {
  ConsoleAnalyticsAdaptor,
  EventLogCondition,
  Events,
  TAAnalytics,
  TAAnalyticsConfig,
  ViewAnalyticsModel,
} from 'react-native-ta-analytics';

const analytics = new TAAnalytics(
  new TAAnalyticsConfig({
    analyticsVersion: '1.0.0',            // saved as a user property
    adaptors: [new ConsoleAnalyticsAdaptor()], // plug in Mixpanel/Amplitude/etc adaptors here
    appVersion: '2.3.1',                  // optional, used for automatic version change events
    buildNumber: '100',
    enableAppLifecycleEvents: true,       // auto APP_OPEN / APP_CLOSE using AppState
  })
);

await analytics.start({
  firstOpenParameterCallback: () => ({ source: 'app' }),
});

await analytics.track(Events.ENGAGEMENT, { name: 'demo' });
await analytics.trackViewShow(new ViewAnalyticsModel('home'));
await analytics.trackButtonTap('subscribe', new ViewAnalyticsModel('paywall'));
await analytics.track(
  new EventAnalyticsModel('custom_event'),
  { foo: 'bar' },
  EventLogCondition.LogOnlyOncePerLifetime
);

// keep the instance around for UI callbacks
const analyticsRef = React.useRef<TAAnalytics | null>(analytics);
const onTap = () => {
  const instance = analyticsRef.current;
  if (!instance) return;
  instance.track(Events.ENGAGEMENT, { name: 'button_tap' });
};
```

## Configuration hints

- `analyticsVersion`: required, stored as `analytics_version` user property.
- `adaptors`: array of analytics adaptors to forward events to.
- `appVersion` / `buildNumber`: enables automatic `app_version_update` events.
- `automaticallyTrackedEventsPrefixConfig` / `manuallyTrackedEventsPrefixConfig`: set prefixes for internal vs app-sent events/properties.
- `enableAppLifecycleEvents`: true to auto track APP_OPEN/APP_CLOSE via `AppState`.
- `storage`: plug your own `StorageAdapter` (AsyncStorage/MMKV/etc.) to persist counters/properties across launches.

## Built-in helpers

- `trackViewShow`, `trackSecondaryViewShow`, `trackButtonTap`
- `trackPaywallEnter/Exit/PurchaseTap`
- `trackSubscriptionStartIntro/PaidRegular/New/Restore`
- `trackEngagement` / `trackEngagementPrimary`
- `trackOnboardingEnter/Exit`, `trackAccountSignupEnter/Exit`
- `trackErrorEvent`, `trackErrorCorrectedEvent`, `trackDebugEvent`

### Events & user properties

Predefined constants mirror the Swift SDK (`Events.*`, `UserProperties.*`). Internal events/properties can be prefixed separately via `automaticallyTrackedEventsPrefixConfig` / `manuallyTrackedEventsPrefixConfig`.

### Adaptors

- `ConsoleAnalyticsAdaptor`: logs trimmed events/user properties
- `EventEmitterAdaptor`: subscribe to tracked events/user property changes

You can implement your own adaptor by conforming to `AnalyticsAdaptor` (`startFor`, `track`, `set`, and trimming helpers).

## Storage

A simple in-memory store ships by default, but if `@react-native-async-storage/async-storage` is available it will be used automatically. Add it directly to your app (RN autolinking only scans your app's `package.json`) or inject your own `StorageAdapter` (wrapping AsyncStorage, MMKV, etc.) to persist lifetime counters and user properties across launches.

## Scripts

- `yarn typescript` — type check
- `yarn test --runInBand` — run Jest suite
- `yarn lint` — lint
- `yarn prepare` — build (bob) for publishing

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT
