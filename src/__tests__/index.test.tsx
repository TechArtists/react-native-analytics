import {
  EventAnalyticsModel,
  EventLogCondition,
  Events,
  MemoryStorageAdapter,
  TAAnalytics,
  TAAnalyticsConfig,
  EventAnalyticsModelTrimmed,
  UserPropertyAnalyticsModelTrimmed,
} from '..';
import type {
  AnalyticsAdaptor,
  AnalyticsAdaptorWithReadWriteUserID,
  AnalyticsParams,
  AnalyticsStartOptions,
  UserPropertyAnalyticsModel,
} from '..';

class TestAdaptor implements AnalyticsAdaptor {
  trackedEvents: { event: EventAnalyticsModelTrimmed; params?: AnalyticsParams }[] =
    [];
  setCalls: { userProperty: UserPropertyAnalyticsModelTrimmed; value: string | null }[] =
    [];

  name = 'TestAdaptor';

  async startFor(_: AnalyticsStartOptions): Promise<void> {
    return;
  }

  track(event: EventAnalyticsModelTrimmed, params?: AnalyticsParams): void {
    this.trackedEvents.push({ event, params });
  }

  set(
    userProperty: UserPropertyAnalyticsModelTrimmed,
    value: string | null
  ): void {
    this.setCalls.push({ userProperty, value });
  }

  trimEvent(event: EventAnalyticsModel): EventAnalyticsModelTrimmed {
    return new EventAnalyticsModelTrimmed(event.rawValue);
  }

  trimUserProperty(
    userProperty: UserPropertyAnalyticsModel
  ): UserPropertyAnalyticsModelTrimmed {
    return new UserPropertyAnalyticsModelTrimmed(userProperty.rawValue);
  }
}

class UserIdAdaptor
  implements
    AnalyticsAdaptor,
    AnalyticsAdaptorWithReadWriteUserID
{
  name = 'UserIdAdaptor';
  trackedUserID: string | undefined;

  async startFor(_: AnalyticsStartOptions): Promise<void> {
    return;
  }

  track(): void {}

  set(): void {}

  trimEvent(event: EventAnalyticsModel): EventAnalyticsModelTrimmed {
    return new EventAnalyticsModelTrimmed(event.rawValue);
  }

  trimUserProperty(
    userProperty: UserPropertyAnalyticsModel
  ): UserPropertyAnalyticsModelTrimmed {
    return new UserPropertyAnalyticsModelTrimmed(userProperty.rawValue);
  }

  setUserID(userID: string | null): void {
    this.trackedUserID = userID ?? undefined;
  }

  getUserID(): string | undefined {
    return this.trackedUserID;
  }
}

const makeAnalytics = (adaptor: TestAdaptor) =>
  new TAAnalytics(
    new TAAnalyticsConfig({
      analyticsVersion: '1.0',
      adaptors: [adaptor],
      storage: new MemoryStorageAdapter(),
      enableAppLifecycleEvents: false,
    })
  );

it('buffers events tracked before start and flushes them once adaptors are ready', async () => {
  const adaptor = new TestAdaptor();
  const analytics = makeAnalytics(adaptor);

  await analytics.track(new EventAnalyticsModel('foo'), { bar: 'baz' });
  expect(adaptor.trackedEvents).toHaveLength(0);

  await analytics.start();
  const fooEvent = adaptor.trackedEvents.find(
    (entry) => entry.event.rawValue === 'foo'
  );
  expect(fooEvent).toBeDefined();
  expect(fooEvent?.params?.bar).toBe('baz');
  expect(fooEvent?.params?.timeDelta).toBeDefined();
});

it('only logs once per lifetime for logOnlyOncePerLifetime', async () => {
  const adaptor = new TestAdaptor();
  const analytics = makeAnalytics(adaptor);
  await analytics.start();

  const event = new EventAnalyticsModel('unique');
  await analytics.track(event, undefined, EventLogCondition.LogOnlyOncePerLifetime);
  await analytics.track(event, undefined, EventLogCondition.LogOnlyOncePerLifetime);

  const occurrences = adaptor.trackedEvents.filter(
    (item) => item.event.rawValue === 'unique'
  );
  expect(occurrences).toHaveLength(1);
});

it('applies prefixes differently for internal vs manual events', async () => {
  const adaptor = new TestAdaptor();
  const analytics = new TAAnalytics(
    new TAAnalyticsConfig({
      analyticsVersion: '1.0',
      adaptors: [adaptor],
      storage: new MemoryStorageAdapter(),
      automaticallyTrackedEventsPrefixConfig: {
        eventPrefix: 'auto_',
        userPropertyPrefix: 'auto_',
      },
      manuallyTrackedEventsPrefixConfig: {
        eventPrefix: 'manual_',
        userPropertyPrefix: 'manual_',
      },
      enableAppLifecycleEvents: false,
    })
  );

  await analytics.start();
  await analytics.track(Events.ERROR, { reason: 'oops' });
  await analytics.track(new EventAnalyticsModel('custom'), { foo: 'bar' });

  const names = adaptor.trackedEvents.map((e) => e.event.rawValue);
  expect(names).toContain('auto_error');
  expect(names).toContain('manual_custom');
});

it('increments cold launch count across app starts when storage persists', async () => {
  const sharedStorage = new MemoryStorageAdapter();

  const firstAdaptor = new TestAdaptor();
  const analyticsFirstRun = new TAAnalytics(
    new TAAnalyticsConfig({
      analyticsVersion: '1.0',
      adaptors: [firstAdaptor],
      storage: sharedStorage,
      enableAppLifecycleEvents: false,
    })
  );

  await analyticsFirstRun.start();
  const firstColdLaunch = firstAdaptor.setCalls.find(
    (call) => call.userProperty.rawValue === 'app_cold_launch_count'
  );
  expect(firstColdLaunch?.value).toBe('1');

  const secondAdaptor = new TestAdaptor();
  const analyticsSecondRun = new TAAnalytics(
    new TAAnalyticsConfig({
      analyticsVersion: '1.0',
      adaptors: [secondAdaptor],
      storage: sharedStorage,
      enableAppLifecycleEvents: false,
    })
  );

  await analyticsSecondRun.start();
  const secondColdLaunch = secondAdaptor.setCalls.find(
    (call) => call.userProperty.rawValue === 'app_cold_launch_count'
  );
  expect(secondColdLaunch?.value).toBe('2');
});

it('propagates userID to adaptors that support it', async () => {
  const adaptor = new UserIdAdaptor();
  const analytics = new TAAnalytics(
    new TAAnalyticsConfig({
      analyticsVersion: '1.0',
      adaptors: [adaptor],
      storage: new MemoryStorageAdapter(),
      enableAppLifecycleEvents: false,
    })
  );

  await analytics.start();
  analytics.userID = 'abc123';

  expect(adaptor.trackedUserID).toBe('abc123');
  expect(analytics.userID).toBe('abc123');
});
