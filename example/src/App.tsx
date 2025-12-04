import * as React from 'react';

import { StyleSheet, View, Text, Button } from 'react-native';
import {
  ConsoleAnalyticsAdaptor,
  Events,
  TAAnalytics,
  TAAnalyticsConfig,
  ViewAnalyticsModel,
} from 'react-native-ta-analytics';


export default function App() {
  const [status, setStatus] = React.useState<string>('init');
  const analyticsRef = React.useRef<TAAnalytics | null>(null);

  React.useEffect(() => {
    const analytics = new TAAnalytics(
      new TAAnalyticsConfig({
        analyticsVersion: '1.0',
        adaptors: [new ConsoleAnalyticsAdaptor()],
        enableAppLifecycleEvents: false,
        appVersion: '1.0.0',
        buildNumber: '1',
      })
    );
    analyticsRef.current = analytics;

    const bootstrap = async () => {
      try {
        await analytics.start({
          firstOpenParameterCallback: () => ({ source: 'example' }),
        });
        await analytics.track(Events.ENGAGEMENT, { name: 'example_start' });
        await analytics.trackViewShow(new ViewAnalyticsModel('home'));
        setStatus('analytics started');
      } catch (error) {
        setStatus(`error: ${(error as Error).message ?? error}`);
      }
    };

    void bootstrap();
  }, []);

  async function handleButtonTap() {
    const analytics = analyticsRef.current;
    if (!analytics) {
      setStatus('analytics not ready yet');
      return;
    }
    try {
      await analytics.track(Events.ENGAGEMENT, { name: 'button_tap' });
      setStatus('tracked button tap');
    } catch (error) {
      setStatus(`error: ${(error as Error).message ?? error}`);
    }
  }

  return (
    <View style={styles.container}>
      <Text>Status: {status}</Text>
      <Button
        onPress={handleButtonTap}
        title="Test TA Analytics Example App"
        color="#841584"
        accessibilityLabel="Test TA Analytics Example App"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
