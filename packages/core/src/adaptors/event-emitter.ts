import {
  AnalyticsAdaptor,
  AnalyticsStartOptions,
  EventAnalyticsModel,
  EventAnalyticsModelTrimmed,
  UserPropertyAnalyticsModel,
  UserPropertyAnalyticsModelTrimmed,
} from '../models';

class SimpleEventEmitter<T> {
  private listeners = new Set<(payload: T) => void>();

  emit(payload: T) {
    this.listeners.forEach((listener) => listener(payload));
  }

  subscribe(listener: (payload: T) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export class EventEmitterAdaptor implements AnalyticsAdaptor {
  readonly name = 'EventEmitterAdaptor';

  readonly events = new SimpleEventEmitter<EventAnalyticsModelTrimmed>();
  readonly userProperties =
    new SimpleEventEmitter<UserPropertyAnalyticsModelTrimmed>();
  readonly wrappedValue = {
    events: this.events,
    userProperties: this.userProperties,
  };

  async startFor(_: AnalyticsStartOptions) {
    return;
  }

  track(trimmedEvent: EventAnalyticsModelTrimmed): void {
    this.events.emit(trimmedEvent);
  }

  set(trimmedUserProperty: UserPropertyAnalyticsModelTrimmed): void {
    this.userProperties.emit(trimmedUserProperty);
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
