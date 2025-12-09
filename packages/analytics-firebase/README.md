# @techartists/react-native-ta-analytics-adaptor-firebase

Firebase Analytics adaptor for `@techartists/react-native-ta-analytics`, plus an optional Crashlytics logging adaptor.

## Install
```sh
npm install @techartists/react-native-ta-analytics-adaptor-firebase @react-native-firebase/app @react-native-firebase/analytics
# If you also want the Crashlytics logging adaptor:
npm install @react-native-firebase/crashlytics
```

## Usage (Firebase Analytics)
```ts
import {
  ConsoleAnalyticsAdaptor,
  TAAnalytics,
  TAAnalyticsConfig,
} from '@techartists/react-native-ta-analytics';
import { FirebaseAnalyticsAdaptor } from '@techartists/react-native-ta-analytics-adaptor-firebase';

const analytics = new TAAnalytics(
  new TAAnalyticsConfig({
    analyticsVersion: '1.0.0',
    adaptors: [
      new ConsoleAnalyticsAdaptor(),
      new FirebaseAnalyticsAdaptor({
        // optional overrides
        enabledInstallTypes: ['AppStore', 'TestFlight', 'Xcode'],
        eventNameMaxLength: 40,
      }),
    ],
  })
);

await analytics.start();
analytics.userID = 'user-123'; // forwarded to Firebase Analytics userId
```

### What it does (Analytics adaptor)
- Trims event names (40 chars) and user property keys/values (24/100 chars).
- Guards against reserved Firebase events/properties when running from Xcode builds.
- Converts params to Firebase-friendly primitives and logs via `analytics().logEvent`.
- Exposes `getUserPseudoID()` (app instance ID) once start has run.

### Crashlytics adaptor (optional)
`FirebaseCrashlyticsAdaptor` remains available for mirroring events/user properties into Crashlytics logs/attributes for crash correlation. It trims names/values to Crashlytics limits and forwards `analytics.userID` to `crashlytics().setUserId`.
