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
- `trackSubscriptionStartIntro/PaidRegular/New`, `trackSubscriptionRestore`
- `trackPurchaseNonConsumableOneTime/Consumable/New`
- `trackEngagement` / `trackEngagementPrimary`
- `trackOnboardingEnter/Exit`, `trackOnboardingQuestionnaireEnter/Exit`, `trackAccountSignupEnter/Exit`
- `trackErrorEvent`, `trackErrorCorrectedEvent`, `trackDebugEvent`

### Purchase/subscription event payload
- Events: `subscription_start_intro`, `subscription_start_paid_regular`, `subscription_start_new`, `subscription_restore`, `purchase_non_consumable_one_time`, `purchase_consumable`, `purchase_new` (automatically sent alongside either purchase event).
- Params (shared): `placement` (string), `product_id` (string), `type` (`trial`, `paid intro pay as you go`, `paid intro pay up front`, `paid regular`, or custom string), `paywall_id?` (string), `paywall_name?` (string), `value` (float), `price` (float), `currency` (string), `quantity` (always `1`).

### Suggested onboarding/paywall flow
- `onboarding_enter` (start of onboarding; `onboarding_exit` when the user reaches the home screen)
- `onboarding_questionnaire_enter` / `onboarding_questionnaire_exit` around the question stack
- `paywall_enter` / `paywall_exit`
- `account_signup_enter` / `account_signup_exit`

## Storage
A simple in-memory store ships by default, but if `@react-native-async-storage/async-storage` is available it will be used automatically. Add it directly to your app (RN autolinking only scans your app's `package.json`) or inject your own `StorageAdapter` (wrapping AsyncStorage, MMKV, etc.) to persist lifetime counters and user properties across launches.

## Workspace commands
- `yarn` — install all workspace deps.
- `yarn test` / `yarn lint` / `yarn typescript` — run per-package scripts.
- `yarn example` (from `packages/core`) — install example app deps.

## License

MIT
