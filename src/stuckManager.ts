import { TALogger } from './logger';
import type { AnalyticsParams } from './models';
import type { TAAnalytics } from './taAnalytics';

export class StuckUIManager {
  private waitingForCorrectionAfterStuckStartDate?: number;
  static REASON = 'stuck on ui_view_show';

  constructor(
    private viewParams: AnalyticsParams,
    private initialDelaySeconds: number,
    private analytics: TAAnalytics
  ) {
    // If the view is still shown after the timeout, emit a stuck UI error.
    setTimeout(() => {
      (async () => {
        try {
          await this.handleStuckTimerExpired();
        } catch (error) {
          TALogger.log(
            `Failed to track stuck UI event: ${(error as Error).message}`,
            'warn'
          );
        }
      })();
    }, initialDelaySeconds * 1000);
  }

  private async handleStuckTimerExpired() {
    const params: AnalyticsParams = {};
    Object.entries(this.viewParams).forEach(
      ([key, value]) => (params[`view_${key}`] = value)
    );
    params.duration = this.initialDelaySeconds;
    await this.analytics.trackErrorEvent(StuckUIManager.REASON, undefined, params);
    this.markCorrectionStart();
  }

  private markCorrectionStart() {
    this.waitingForCorrectionAfterStuckStartDate = Date.now();
  }

  trackCorrectedStuckEventIfNeeded() {
    if (!this.waitingForCorrectionAfterStuckStartDate) {
      return;
    }
    const elapsedSeconds =
      (Date.now() - this.waitingForCorrectionAfterStuckStartDate) / 1000;
    if (elapsedSeconds > 30) {
      return;
    }
    const params: AnalyticsParams = {};
    Object.entries(this.viewParams).forEach(
      ([key, value]) => (params[`view_${key}`] = value)
    );
    params.duration = this.initialDelaySeconds + elapsedSeconds;
    void this.analytics.trackErrorCorrectedEvent(
      StuckUIManager.REASON,
      undefined,
      params
    );
  }
}
