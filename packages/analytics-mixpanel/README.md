# @techartists/react-native-ta-analytics-adaptor-mixpanel

Mixpanel adaptor for `@techartists/react-native-ta-analytics`. Forwards events/user properties to Mixpanel and supports setting the Mixpanel distinct id.

## Install
```sh
npm install @techartists/react-native-ta-analytics-adaptor-mixpanel mixpanel-react-native
```

## Usage
```ts
import {
  ConsoleAnalyticsAdaptor,
  TAAnalytics,
  TAAnalyticsConfig,
} from '@techartists/react-native-ta-analytics';
import { MixpanelAnalyticsAdaptor } from '@techartists/react-native-ta-analytics-adaptor-mixpanel';

const analytics = new TAAnalytics(
  new TAAnalyticsConfig({
    analyticsVersion: '1.0.0',
    adaptors: [
      new ConsoleAnalyticsAdaptor(),
      new MixpanelAnalyticsAdaptor('YOUR_TOKEN', {
        loggingEnabled: true,
        flushInterval: 30,
      }),
    ],
  })
);

await analytics.start();
analytics.userID = 'distinct-user-id'; // forwarded to Mixpanel identify/reset
```

### Notes
- Trims event names and user properties to Mixpanel-safe lengths (overrides available via constructor options).
- Uses `people.set`/`unset` for user properties and `identify`/`reset` for user ids.
- Options also cover logging, automatic events, allowed install types, and flush interval; Mixpanel client is exposed via `wrappedValue` for SDK-specific calls.
