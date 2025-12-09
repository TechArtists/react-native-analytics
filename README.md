# @techartists/react-native-ta-analytics

Monorepo for the TAAnalytics React Native SDK with pluggable adaptors.

## Packages
- `@techartists/react-native-ta-analytics` (packages/core): core event buffer, predefined events/user properties, adaptor interface, and helpers.
- `@techartists/react-native-ta-analytics-adaptor-firebase` (packages/analytics-firebase): Firebase Analytics adaptor (trims names/params, guards reserved names, exposes userID/appInstanceID) plus an optional Crashlytics logging adaptor.
- `@techartists/react-native-ta-analytics-adaptor-mixpanel` (packages/analytics-mixpanel): sends events/user properties to Mixpanel and forwards `userID` to `identify`/`reset`.

## Install
Core (required):
```sh
npm install @techartists/react-native-ta-analytics @react-native-async-storage/async-storage
```
> AsyncStorage must be in your app's `package.json` for React Native autolinking. Without it, the SDK falls back to in-memory storage and counters reset every cold start.

Firebase Analytics adaptor (optional):
```sh
npm install @techartists/react-native-ta-analytics-adaptor-firebase @react-native-firebase/app @react-native-firebase/analytics
# If you also want Crashlytics logging support from the same package:
npm install @react-native-firebase/crashlytics
```

Mixpanel adaptor (optional):
```sh
npm install @techartists/react-native-ta-analytics-adaptor-mixpanel mixpanel-react-native
```

## Integrate in your app
1. Install packages you need (core required, adaptors optional) using the commands above. Make sure `@react-native-async-storage/async-storage` is in your app `package.json` so autolinking picks it up.
2. iOS: run `cd ios && pod install` after adding deps. Firebase users must add `GoogleService-Info.plist`; Mixpanel has no extra native setup.
3. Android: ensure Firebase `google-services.json` is configured if you use Firebase; otherwise no extra steps for core or Mixpanel.
4. Initialize analytics early (e.g., app bootstrap):
```ts
import {
  ConsoleAnalyticsAdaptor,
  TAAnalytics,
  TAAnalyticsConfig,
  Events,
  ViewAnalyticsModel,
} from '@techartists/react-native-ta-analytics';
import { FirebaseAnalyticsAdaptor } from '@techartists/react-native-ta-analytics-adaptor-firebase';
import { MixpanelAnalyticsAdaptor } from '@techartists/react-native-ta-analytics-adaptor-mixpanel';

const analytics = new TAAnalytics(
  new TAAnalyticsConfig({
    analyticsVersion: '1.0.0',
    adaptors: [
      new ConsoleAnalyticsAdaptor(),
      new FirebaseAnalyticsAdaptor(), // optional
      new MixpanelAnalyticsAdaptor('YOUR_TOKEN'), // optional
    ],
    appVersion: '1.0.0',
    buildNumber: '1',
    enableAppLifecycleEvents: true,
  })
);

await analytics.start();
await analytics.track(Events.ENGAGEMENT, { name: 'demo' });
await analytics.trackViewShow(new ViewAnalyticsModel('home'));
analytics.userID = 'user-123';
```
5. Crashlytics logging (optional): add `new FirebaseCrashlyticsAdaptor()` from the Firebase adaptor package to the `adaptors` array once Crashlytics is configured.

## Quick start
```ts
import {
  ConsoleAnalyticsAdaptor,
  Events,
  TAAnalytics,
  TAAnalyticsConfig,
  ViewAnalyticsModel,
} from '@techartists/react-native-ta-analytics';
import { FirebaseAnalyticsAdaptor } from '@techartists/react-native-ta-analytics-adaptor-firebase';
import { MixpanelAnalyticsAdaptor } from '@techartists/react-native-ta-analytics-adaptor-mixpanel';

const analytics = new TAAnalytics(
  new TAAnalyticsConfig({
    analyticsVersion: '1.0.0',
    adaptors: [
      new ConsoleAnalyticsAdaptor(),
      // Optional: log to Firebase Analytics.
      new FirebaseAnalyticsAdaptor(),
      // Optional: send to Mixpanel.
      new MixpanelAnalyticsAdaptor('YOUR_TOKEN'),
    ],
    appVersion: '2.3.1',
    buildNumber: '100',
    enableAppLifecycleEvents: true,
  })
);

await analytics.start({
  firstOpenParameterCallback: () => ({ source: 'app' }),
});

await analytics.track(Events.ENGAGEMENT, { name: 'demo' });
await analytics.trackViewShow(new ViewAnalyticsModel('home'));
await analytics.trackButtonTap('subscribe', new ViewAnalyticsModel('paywall'));
```

### Crashlytics adaptor notes
- Trims event names and user properties to Crashlytics limits and logs events as `ta_event:<name>`.
- Writes user properties as Crashlytics attributes and forwards `analytics.userID = 'abc'` to `crashlytics().setUserId`.
- Constructor options let you override trim lengths, prefix, and whether params are logged.

### Mixpanel adaptor notes
- Trims event names/user properties and forwards `analytics.userID = 'abc'` to `mixpanel.identify` (or `reset` when cleared).
- Uses `people.set`/`unset` for user properties and supports optional `flushInterval`/`loggingEnabled`.

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

## Storage
A simple in-memory store ships by default, but if `@react-native-async-storage/async-storage` is available it will be used automatically. Add it directly to your app (RN autolinking only scans your app's `package.json`) or inject your own `StorageAdapter` (wrapping AsyncStorage, MMKV, etc.) to persist lifetime counters and user properties across launches.

## Workspace commands
- `yarn` — install all workspace deps.
- `yarn test` / `yarn lint` / `yarn typescript` — run per-package scripts.
- `yarn example` (from `packages/core`) — install example app deps.

## License

MIT
